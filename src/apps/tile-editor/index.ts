import { Pane } from 'tweakpane';
import { Application, Container, Graphics } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { pointsCloseEuclidean } from '../../core/utils/geometry';
import { ExpressionParser } from './expression-parser';
import { pointInPolygon, pointNearPolyline, translatePoints } from './geometry-helpers';
import { drawDashedPath, drawDottedConnection, drawLetter, drawPolygonPath } from './render-helpers';
import { setupValuesToggle } from './ui-helpers';
import { Point } from './types';
import { solveSimpleNgonFromLengthsAndAngles } from '../../core/utils/solver';
import type { PolygonConstraint, VertexKinds } from '../../core/utils/solver-types';

interface EditorConfig {
  scale: number;
  numSides: number;
  sideLengthExpression: string;
  constantsText: string;
  edgeWidth: number;
  closedPolygonEpsilon: number;
  viewOffset: { x: number; y: number };
}

interface PolygonData {
  x: number;
  y: number;
  sides: number;
  sideLengthExpressions: string[];
  sideLengths: number[];
  interiorAngleExpressions: string[];
  interiorAngles: number[];
  points: Point[];
  isClosed: boolean;
  graphics: Graphics;
  isHovered: boolean;
}

interface ConstantEntry {
  name: string;
  value?: number;
  error?: string;
}

class TileEditor {
  private pane!: Pane;
  private editPane: Pane | null = null;
  private editPaneContainer!: HTMLElement;
  private readonly scaleBounds = { min: 1, max: 200 };
  private config: EditorConfig = {
    scale: 100,
    numSides: 4,
    sideLengthExpression: '1',
    constantsText: '',
    edgeWidth: 2,
    closedPolygonEpsilon: 1e-4,
    viewOffset: { x: 0, y: 0 },
  };
  private displayContainer: HTMLElement;
  private constants: Record<string, number> = {};
  private constantEntries: ConstantEntry[] = [];
  
  // Pixi
  private app!: Application;
  private polygonContainer!: Container;
  private labelContainer!: Container;
  private previewGraphics!: Graphics;
  private polygons: PolygonData[] = [];
  private selectedPolygon: PolygonData | null = null;
  private dashOffset = 0;
  
  // Interaction
  private draggedPolygon: PolygonData | null = null;
  private dragOffset = { x: 0, y: 0 };
  private worldMousePosition = { x: 0, y: 0 };
  private isViewDragging = false;
  private viewDragStart = { x: 0, y: 0 };
  private viewOffsetStart = { x: 0, y: 0 };

  constructor() {
    this.displayContainer = document.getElementById('values-display')!;
    this.editPaneContainer = document.getElementById('editpane-container')!;
    this.initTweakpane();
    this.initPixi();
    this.updateDisplay();
    this.setupUI();
    this.showEditPane(true);
    this.buildEditPane(null);
  }

  private setupUI() {
    const toggleBtn = document.getElementById('toggle-values');
    const valuesDisplay = document.getElementById('values-display');
    setupValuesToggle(toggleBtn, valuesDisplay, () => this.app.resize());
  }

  private async initPixi() {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    this.app = new Application();
    await this.app.init({
      background: '#1a1a1a',
      resizeTo: container,
      antialias: true,
    });
    
    // Add ResizeObserver to handle container size changes robustly
    const resizeObserver = new ResizeObserver(() => {
      this.app.resize();
      this.updateViewportCenter();
    });
    resizeObserver.observe(container);
    
    container.appendChild(this.app.canvas);
    this.app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = Math.sign(e.deltaY);
      const factor = Math.pow(1.05, -direction);
      const nextScale = this.clamp(this.config.scale * factor, this.scaleBounds.min, this.scaleBounds.max);
      if (nextScale === this.config.scale) return;
      this.config.scale = nextScale;
      this.updateDisplay();
      this.updateScale();
      this.redrawPolygons();
      this.pane.refresh();
    }, { passive: false });

    this.polygonContainer = new Container();
    this.polygonContainer.sortableChildren = true;
    this.app.stage.addChild(this.polygonContainer);

    this.labelContainer = new Container();
    this.labelContainer.zIndex = 2;
    this.polygonContainer.addChild(this.labelContainer);

    this.previewGraphics = new Graphics();
    this.previewGraphics.zIndex = 1;
    this.polygonContainer.addChild(this.previewGraphics);
    this.updateScale();
    this.updateViewportCenter();

    // Events
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    
    this.app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      this.worldMousePosition = this.globalToWorld(e.global);
      this.handlePointerMove(e);
    });
    
    this.app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.handlePointerDown(e);
    });
    
    this.app.stage.on('pointerup', () => {
      this.handlePointerUp();
    });
    
    this.app.stage.on('pointerupoutside', () => {
      this.handlePointerUp();
    });

    this.app.canvas.addEventListener('dblclick', (e) => {
      const rect = this.app.canvas.getBoundingClientRect();
      const global = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPos = this.globalToWorld(global);
      const sideLength = this.getEvaluatedSideLength();
      if (sideLength !== null && sideLength > 0) {
        this.createPolygon(worldPos.x, worldPos.y, this.config.numSides);
      }
    });

    // Update loop
    this.app.ticker.add(() => {
      this.dashOffset += 0.4 / this.config.scale;
      this.updatePreview();
      if (this.selectedPolygon) {
        this.drawPolygonInstance(this.selectedPolygon);
      }
    });
  }

  private initTweakpane() {
    const container = document.getElementById('tweakpane-container');
    if (!container) return;

    this.pane = new Pane({
      title: 'Editor Controls',
      container: container,
    });

    this.pane.addBinding(this.config, 'scale', {
      min: this.scaleBounds.min,
      max: this.scaleBounds.max,
      label: 'Scale',
    }).on('change', () => {
        this.updateDisplay();
        this.updateScale();
        this.redrawPolygons();
    });

    this.pane.addBinding(this.config, 'numSides', {
      min: 3,
      max: 20,
      step: 1,
      label: 'Number of Sides',
    }).on('change', () => this.updateDisplay());

    this.pane.addBinding(this.config, 'sideLengthExpression', {
      label: 'Side Length Expr',
    }).on('change', () => this.updateDisplay());

    this.pane.addBinding(this.config, 'edgeWidth', {
      min: 1,
      max: 12,
      step: 1,
      label: 'Edge Width',
    }).on('change', () => {
        this.updateDisplay();
        this.redrawPolygons();
    });

    this.pane.addBinding(this.config, 'closedPolygonEpsilon', {
      min: 1e-6,
      max: 1e-2,
      step: 1e-6,
      label: 'Closed Polygon Epsilon',
    }).on('change', () => {
        this.updateDisplay();
    });

    this.pane.addBinding(this.config, 'viewOffset', {
      label: 'View Offset',
    }).on('change', () => {
        this.updateDisplay();
        this.updateViewportCenter();
    });

    this.pane.addButton({
      title: 'Center View',
    }).on('click', () => {
      this.centerViewToPolygons();
    });

    const constantsBlock = document.createElement('div');
    constantsBlock.className = 'constants-block';
    const constantsLabel = document.createElement('label');
    constantsLabel.className = 'constants-label';
    constantsLabel.textContent = 'Constants';
    const constantsInput = document.createElement('textarea');
    constantsInput.className = 'constants-input';
    constantsInput.rows = 6;
    constantsInput.placeholder = 'NAME=EXPR';
    constantsInput.value = this.config.constantsText;
    constantsInput.addEventListener('input', () => {
      this.config.constantsText = constantsInput.value;
      this.applyConstantsChange();
    });
    constantsBlock.append(constantsLabel, constantsInput);
    this.pane.element.appendChild(constantsBlock);
    this.refreshConstants();
  }

  private updateDisplay() {
    const constantsDisplay = this.buildConstantsDisplay();
    const polygonInfoDisplay = this.selectedPolygon ? this.buildPolygonInfoDisplay(this.selectedPolygon) : '';
    const polygonSidesDisplay = this.selectedPolygon ? this.buildPolygonSidesDisplay(this.selectedPolygon) : '';
    const polygonAnglesDisplay = this.selectedPolygon ? this.buildPolygonAnglesDisplay(this.selectedPolygon) : '';

    this.displayContainer.innerHTML = `
      <div class="values-grid">
        <div class="values-column">
          <div class="column-header">View & Constants</div>
          <div class="value-row">
            <div class="value-label">View Offset</div>
            <div class="value-content">${this.config.viewOffset.x.toFixed(2)}, ${this.config.viewOffset.y.toFixed(2)}</div>
          </div>
          ${constantsDisplay}
        </div>
        <div class="values-column">
          <div class="column-header">Polygon Info</div>
          ${polygonInfoDisplay || '<div class="value-row"><div class="value-content">No polygon selected</div></div>'}
        </div>
        <div class="values-column">
          <div class="column-header">Side Lengths</div>
          ${polygonSidesDisplay || '<div class="value-row"><div class="value-content">No polygon selected</div></div>'}
        </div>
        <div class="values-column">
          <div class="column-header">Angles</div>
          ${polygonAnglesDisplay || '<div class="value-row"><div class="value-content">No polygon selected</div></div>'}
        </div>
      </div>
    `;
  }

  private applyConstantsChange() {
    this.refreshConstants();
    this.polygons.forEach((poly) => {
      this.tryApplyPolygonExpressions(poly, false, false);
    });
    if (this.selectedPolygon) {
      this.updateSelectedLabels();
    }
    this.updateDisplay();
  }

  private refreshConstants() {
    const values: Record<string, number> = {};
    const entries: ConstantEntry[] = [];
    const lines = this.config.constantsText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        entries.push({ name: trimmed, error: 'Expected NAME=EXPR' });
        continue;
      }
      const rawName = trimmed.slice(0, eqIndex).trim();
      const expr = trimmed.slice(eqIndex + 1).trim();
      if (!rawName) {
        entries.push({ name: '(unnamed)', error: 'Missing constant name' });
        continue;
      }
      if (!/^[a-z][a-z0-9]*$/i.test(rawName)) {
        entries.push({ name: rawName, error: 'Invalid constant name' });
        continue;
      }
      const evaluated = this.evaluateExpression(expr, values);
      if (typeof evaluated === 'number') {
        values[rawName.toLowerCase()] = evaluated;
        entries.push({ name: rawName, value: evaluated });
      } else {
        entries.push({ name: rawName, error: evaluated });
      }
    }

    this.constants = values;
    this.constantEntries = entries;
  }

  private buildConstantsDisplay(): string {
    if (this.constantEntries.length === 0) {
      return `
        <div class="value-row">
          <div class="value-label">Constants</div>
          <div class="value-content">None</div>
        </div>
      `;
    }

    return this.constantEntries
      .map((entry) => {
        const value = entry.error
          ? `<span class="error">${entry.error}</span>`
          : this.formatNumber(entry.value ?? 0);
        return `
          <div class="value-row">
            <div class="value-label">Const ${entry.name}</div>
            <div class="value-content">${value}</div>
          </div>
        `;
      })
      .join('');
  }

  private buildPolygonInfoDisplay(poly: PolygonData): string {
    const end = poly.points[poly.points.length - 1] ?? { x: 0, y: 0 };
    const divergence = Math.hypot(end.x, end.y);
    const angleSum = poly.interiorAngles.reduce((sum, angle) => sum + angle, 0);
    const expectedAngleSum = (poly.sides - 2) * Math.PI;
    const expectedAngleDiff = Math.abs(expectedAngleSum - angleSum);
    const showExpectedAngleRow = !poly.isClosed && expectedAngleDiff > this.config.closedPolygonEpsilon;
    const divergenceRow = poly.isClosed
      ? ''
      : `
        <div class="value-row">
          <div class="value-label">Start/End Divergence</div>
          <div class="value-content"><span class="error">${this.formatNumber(divergence)}</span></div>
        </div>
      `;
    const expectedAngleRow = showExpectedAngleRow
      ? `
        <div class="value-row">
          <div class="value-label">Expected Angle Sum</div>
          <div class="value-content"><span class="error">${this.formatAngle(expectedAngleSum)}</span></div>
        </div>
      `
      : '';

    return `
      <div class="value-row">
        <div class="value-label">Poly Position</div>
        <div class="value-content">${poly.x.toFixed(2)}, ${poly.y.toFixed(2)}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Poly Sides</div>
        <div class="value-content">${poly.sides}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Angle Sum</div>
        <div class="value-content">${this.formatAngle(angleSum)}</div>
      </div>
      ${expectedAngleRow}
      ${divergenceRow}
    `;
  }

  private buildPolygonSidesDisplay(poly: PolygonData): string {
    const sideLabels = this.buildEdgeLabels(poly.sides);
    return sideLabels
      .map((label, i) => `
        <div class="value-row">
          <div class="value-label">${label}</div>
          <div class="value-content">${this.formatNumber(poly.sideLengths[i] ?? 0)}</div>
        </div>
      `)
      .join('');
  }

  private buildPolygonAnglesDisplay(poly: PolygonData): string {
    const angleLabels = this.buildVertexLabels(poly.sides);
    return angleLabels
      .map((label, i) => `
        <div class="value-row">
          <div class="value-label">${label}</div>
          <div class="value-content">${this.formatAngle(poly.interiorAngles[i] ?? 0)}</div>
        </div>
      `)
      .join('');
  }

  private formatAngle(radians: number): string {
    const degrees = (radians * 180) / Math.PI;
    return `${this.formatNumber(radians)} rad / ${this.formatNumber(degrees)}°`;
  }

  private formatNumber(value: number): string {
    const fixed = value.toFixed(6);
    return fixed.replace(/\.?0+$/, '');
  }

  private getEvaluatedSideLength(): number | null {
      const res = this.evaluateExpression(this.config.sideLengthExpression);
      return typeof res === 'number' ? res : null;
  }

  private defaultInteriorAngleExpression(sides: number): string {
      return `(${sides - 2} / ${sides}) * PI`;
  }

  private buildPolygonPoints(sideLengths: number[], interiorAngles: number[]): Point[] {
      const points: Point[] = [{ x: 0, y: 0 }];
      let angle = 0;
      let current = { x: 0, y: 0 };

      for (let i = 0; i < sideLengths.length; i++) {
          current = {
              x: current.x + Math.cos(angle) * sideLengths[i],
              y: current.y + Math.sin(angle) * sideLengths[i],
          };
          points.push({ x: current.x, y: current.y });

          if (i < sideLengths.length - 1) {
              const nextAngle = interiorAngles[(i + 1) % interiorAngles.length];
              angle += Math.PI - nextAngle;
          }
      }

      return points;
  }

  private evaluateSideLengthExpression(expr: string): number | string {
      return this.evaluateExpression(expr);
  }

  private evaluateAngleExpression(expr: string): number | string {
      try {
          const parts = expr.split(',');
          const value = this.evaluateExpression(parts[0].trim());
          if (typeof value !== 'number') return value;
          if (parts.length === 1) return value;
          const unitToken = parts.slice(1).join(',').trim().toLowerCase();
          const unit = this.parseAngleUnit(unitToken);
          return unit === 'deg' ? (value * Math.PI) / 180 : value;
      } catch (err) {
          return err instanceof Error ? err.message : 'Angle expression error';
      }
  }

  private evaluatePolygonExpressions(
      sideLengthExpressions: string[],
      interiorAngleExpressions: string[],
      alertOnError: boolean
  ): { sideLengths: number[]; interiorAngles: number[]; points: Point[]; isClosed: boolean } | null {
      const hasUnknownSides = sideLengthExpressions.some((expr) => expr.trim() === '?');
      const hasUnknownAngles = interiorAngleExpressions.some((expr) => expr.trim() === '?');
      if (hasUnknownSides || hasUnknownAngles) {
          return this.solvePolygonWithUnknowns(sideLengthExpressions, interiorAngleExpressions, alertOnError);
      }

      const sideLengths: number[] = [];
      for (const expr of sideLengthExpressions) {
          const value = this.evaluateSideLengthExpression(expr);
          if (typeof value !== 'number') {
              if (alertOnError) {
                  alert(`Side length error: ${value}`);
              }
              return null;
          }
          sideLengths.push(value);
      }

      const interiorAngles: number[] = [];
      for (const expr of interiorAngleExpressions) {
          const value = this.evaluateAngleExpression(expr);
          if (typeof value !== 'number') {
              if (alertOnError) {
                  alert(`Angle error: ${value}`);
              }
              return null;
          }
          interiorAngles.push(value);
      }

      const points = this.buildPolygonPoints(sideLengths, interiorAngles);
      const end = points[points.length - 1];
      const isClosed = pointsCloseEuclidean(end, { x: 0, y: 0 }, this.config.closedPolygonEpsilon);

      return { sideLengths, interiorAngles, points, isClosed };
  }

  private solvePolygonWithUnknowns(
      sideLengthExpressions: string[],
      interiorAngleExpressions: string[],
      alertOnError: boolean
  ): { sideLengths: number[]; interiorAngles: number[]; points: Point[]; isClosed: boolean } | null {
      const constraints: PolygonConstraint[] = [];
      const sideLengths: number[] = [];
      const interiorAngles: number[] = [];
      const vertexKinds: VertexKinds = new Array(sideLengthExpressions.length).fill('convex');

      for (let i = 0; i < sideLengthExpressions.length; i++) {
          const expr = sideLengthExpressions[i].trim();
          if (expr === '?') {
              sideLengths[i] = NaN;
              continue;
          }
          const value = this.evaluateSideLengthExpression(expr);
          if (typeof value !== 'number') {
              if (alertOnError) {
                  alert(`Side length error: ${value}`);
              }
              return null;
          }
          sideLengths[i] = value;
          constraints.push({ type: 'length', i, j: (i + 1) % sideLengthExpressions.length, length: value });
      }

      for (let i = 0; i < interiorAngleExpressions.length; i++) {
          const expr = interiorAngleExpressions[i].trim();
          if (expr === '?') {
              interiorAngles[i] = NaN;
              continue;
          }
          const value = this.evaluateAngleExpression(expr);
          if (typeof value !== 'number') {
              if (alertOnError) {
                  alert(`Angle error: ${value}`);
              }
              return null;
          }
          interiorAngles[i] = value;
          constraints.push({ type: 'interiorAngle', i, angleRad: value });
          vertexKinds[i] = value > Math.PI ? 'reflex' : 'convex';
      }

      const result = solveSimpleNgonFromLengthsAndAngles(
          sideLengthExpressions.length,
          vertexKinds,
          constraints,
          { diagnostics: 'none' }
      );

      if ('kind' in result) {
          if (alertOnError) {
              alert(`Solver error: ${result.message}`);
          }
          return null;
      }

      const points = this.buildPolygonPoints(result.sideLengths, result.interiorAngles);
      const end = points[points.length - 1];
      const isClosed = pointsCloseEuclidean(end, { x: 0, y: 0 }, this.config.closedPolygonEpsilon);
      return { sideLengths: result.sideLengths, interiorAngles: result.interiorAngles, points, isClosed };
  }

  private updatePreview() {
      if (!this.app) return;
      
      this.previewGraphics.clear();
  }

  private handlePointerDown(e: FederatedPointerEvent) {
      const worldPos = this.globalToWorld(e.global);
      const clickedPoly = this.getPolygonAt(worldPos.x, worldPos.y);
      if (clickedPoly) {
          this.selectedPolygon = clickedPoly;
          this.buildEditPane(clickedPoly);
          this.updateSelectedLabels();
          this.updateDisplay();
          this.redrawPolygons();
          this.draggedPolygon = clickedPoly;
          this.dragOffset = {
              x: clickedPoly.x - worldPos.x,
              y: clickedPoly.y - worldPos.y
          };
      } else {
          this.selectedPolygon = null;
          this.buildEditPane(null);
          this.updateSelectedLabels();
          this.updateDisplay();
          this.redrawPolygons();
          this.isViewDragging = true;
          this.viewDragStart = { x: e.global.x, y: e.global.y };
          this.viewOffsetStart = { ...this.config.viewOffset };
      }
  }

  private handlePointerMove(e: FederatedPointerEvent) {
      if (this.draggedPolygon) {
          const worldPos = this.globalToWorld(e.global);
          this.draggedPolygon.x = worldPos.x + this.dragOffset.x;
          this.draggedPolygon.y = worldPos.y + this.dragOffset.y;
          this.drawPolygonInstance(this.draggedPolygon);
          if (this.selectedPolygon === this.draggedPolygon) {
            this.updateSelectedLabels();
            this.updateDisplay();
          }
      } else if (this.isViewDragging) {
          const deltaX = (e.global.x - this.viewDragStart.x) / this.config.scale;
          const deltaY = (e.global.y - this.viewDragStart.y) / this.config.scale;
          this.config.viewOffset = {
            x: this.viewOffsetStart.x + deltaX,
            y: this.viewOffsetStart.y + deltaY,
          };
          this.updateDisplay();
          this.updateViewportCenter();
      }

      this.updateHoverState();
  }

  private handlePointerUp() {
      this.draggedPolygon = null;
      if (this.isViewDragging) {
        this.isViewDragging = false;
        this.pane.refresh();
      }
  }

  private createPolygon(x: number, y: number, sides: number) {
      const g = new Graphics();
      g.zIndex = 0;
      this.polygonContainer.addChild(g);
      this.polygonContainer.addChild(this.labelContainer);
      const sideLengthExpressions = (Array(sides) as string[]).fill(this.config.sideLengthExpression);
      const interiorAngleExpressions = (Array(sides) as string[]).fill(this.defaultInteriorAngleExpression(sides));
      const evaluated = this.evaluatePolygonExpressions(sideLengthExpressions, interiorAngleExpressions, true);
      if (!evaluated || !evaluated.isClosed) {
          alert('Polygon is not closed with the current parameters.');
          g.destroy();
          return;
      }

      const poly: PolygonData = {
          x,
          y,
          sides,
          sideLengthExpressions,
          sideLengths: evaluated.sideLengths,
          interiorAngleExpressions,
          interiorAngles: evaluated.interiorAngles,
          points: evaluated.points,
          isClosed: evaluated.isClosed,
          graphics: g,
          isHovered: false
      };
      
      this.polygons.push(poly);
      this.drawPolygonInstance(poly);
  }

  private drawPolygonInstance(poly: PolygonData) {
      const isSelected = this.selectedPolygon === poly;
      const color = poly.isHovered ? 0x4a9eff : 0x444444;
      const alpha = poly.isClosed ? 0.8 : 0;
      const baseStroke = poly.isClosed ? 0xffffff : 0xff4d4d;
      const strokeColor = (poly.isHovered && !isSelected) ? 0xffd24d : baseStroke;
      const openStrokeColor = 0xff4d4d;
      
      drawPolygonPath(
        poly.graphics,
        poly.points,
        { x: poly.x, y: poly.y },
        color,
        alpha,
        strokeColor,
        this.getStrokeWidth()
      );

      if (!poly.isClosed) {
          drawDottedConnection(
            poly.graphics,
            { x: poly.points[0].x + poly.x, y: poly.points[0].y + poly.y },
            { x: poly.points[poly.points.length - 1].x + poly.x, y: poly.points[poly.points.length - 1].y + poly.y },
            openStrokeColor,
            this.getStrokeWidth(),
            this.config.scale
          );
      }

      if (isSelected) {
          drawDashedPath(
            poly.graphics,
            poly.points,
            { x: poly.x, y: poly.y },
            0x000000,
            0xffffff,
            this.getStrokeWidth(),
            poly.isClosed,
            this.dashOffset,
            this.config.scale
          );
      }
  }

  private redrawPolygons() {
      this.polygons.forEach(p => this.drawPolygonInstance(p));
  }

  private getPolygonAt(x: number, y: number): PolygonData | null {
      // Reverse iterate to pick top-most
      for (let i = this.polygons.length - 1; i >= 0; i--) {
          const p = this.polygons[i];
          const worldPoints = translatePoints(p.points, { x: p.x, y: p.y });
          if (pointInPolygon({ x, y }, worldPoints) || pointNearPolyline({ x, y }, worldPoints, this.getHitTolerance(), true)) {
              return p;
          }
      }
      return null;
  }

  private updateHoverState() {
      let hovered: PolygonData | null = null;
      hovered = this.getPolygonAt(this.worldMousePosition.x, this.worldMousePosition.y);

      this.polygons.forEach(p => {
          const wasHovered = p.isHovered;
          p.isHovered = (p === hovered);
          if (p.isHovered !== wasHovered) {
              this.drawPolygonInstance(p);
          }
      });
  }

  private evaluateExpression(expr: string, variables: Record<string, number> = this.constants): number | string {
    try {
      return new ExpressionParser(expr, variables).evaluate();
    } catch (e) {
      return e instanceof Error ? e.message : 'Error';
    }
  }

  private getStrokeWidth(): number {
    return this.config.edgeWidth / this.config.scale;
  }

  private getHitTolerance(): number {
    return Math.max(0.1, this.getStrokeWidth() * 2);
  }

  private globalToWorld(point: { x: number; y: number }): Point {
    if (!this.polygonContainer) return { x: point.x, y: point.y };
    const local = this.polygonContainer.toLocal(point);
    return { x: local.x, y: local.y };
  }

  private updateScale() {
    if (!this.polygonContainer) return;
    this.polygonContainer.scale.set(this.config.scale);
    this.updateViewportCenter();
  }

  private updateViewportCenter() {
    if (!this.app || !this.polygonContainer) return;
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;
    const offsetX = this.config.viewOffset.x * this.config.scale;
    const offsetY = this.config.viewOffset.y * this.config.scale;
    this.polygonContainer.position.set(centerX + offsetX, centerY + offsetY);
    this.polygonContainer.pivot.set(0, 0);
  }

  private centerViewToPolygons() {
    if (!this.app || !this.polygonContainer || this.polygons.length === 0) return;
    const bounds = this.getPolygonsBounds();
    if (!bounds) return;

    const padding = 40;
    const availableWidth = Math.max(1, this.app.screen.width - padding * 2);
    const availableHeight = Math.max(1, this.app.screen.height - padding * 2);
    const boundsWidth = Math.max(1e-6, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1e-6, bounds.maxY - bounds.minY);

    const scaleX = availableWidth / boundsWidth;
    const scaleY = availableHeight / boundsHeight;
    const nextScale = this.clamp(Math.min(scaleX, scaleY), this.scaleBounds.min, this.scaleBounds.max);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.config.scale = nextScale;
    this.config.viewOffset = { x: -centerX, y: -centerY };
    this.updateDisplay();
    this.updateScale();
    this.redrawPolygons();
    this.pane.refresh();
  }

  private getPolygonsBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const poly of this.polygons) {
      for (const point of poly.points) {
        const x = poly.x + point.x;
        const y = poly.y + point.y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    return { minX, minY, maxX, maxY };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private showEditPane(visible: boolean) {
    if (!this.editPaneContainer) return;
    this.editPaneContainer.style.display = visible ? 'block' : 'none';
  }

  private buildEditPane(poly: PolygonData | null) {
    if (this.editPane) {
      this.editPane.dispose();
    }

    this.editPane = new Pane({
      title: 'Polygon Editor',
      container: this.editPaneContainer,
    });

    if (!poly) {
      this.editPane.addBlade({
        view: 'text',
        label: 'Hint',
        value: "Double click anywhere in the 'Unit Cell Editor' to create a new polygon. Click on an existing polygon to edit it.",
        parse: (value: string) => String(value),
        format: (value: string) => String(value),
      });
      return;
    }

    const positionState = { position: { x: poly.x, y: poly.y } };
    this.editPane.addBinding(positionState, 'position', { label: 'Position' }).on('change', () => {
      poly.x = positionState.position.x;
      poly.y = positionState.position.y;
      this.drawPolygonInstance(poly);
      this.updateSelectedLabels();
      this.updateDisplay();
    });

    const editState: Record<string, string> = {};
    const sideLabels = this.buildEdgeLabels(poly.sides);
    const angleLabels = this.buildVertexLabels(poly.sides);

    poly.sideLengthExpressions.forEach((expr, i) => {
      editState[`side_${sideLabels[i]}`] = expr;
    });
    poly.interiorAngleExpressions.forEach((expr, i) => {
      editState[`angle_${angleLabels[i]}`] = expr;
    });

    sideLabels.forEach((label, i) => {
      this.editPane!.addBinding(editState, `side_${label}`, {
        label: `Side Length Expression ${label}`,
      }).on('change', (event) => {
        const previous = poly.sideLengthExpressions[i];
          poly.sideLengthExpressions[i] = event.value;
          if (!this.tryApplyPolygonExpressions(poly)) {
            poly.sideLengthExpressions[i] = previous;
            editState[`side_${label}`] = previous;
            this.editPane!.refresh();
          }
      });
    });

    angleLabels.forEach((label, i) => {
      this.editPane!.addBinding(editState, `angle_${label}`, {
        label: `Angle Expression ${label}`,
      }).on('change', (event) => {
        const previous = poly.interiorAngleExpressions[i];
          poly.interiorAngleExpressions[i] = event.value;
          if (!this.tryApplyPolygonExpressions(poly)) {
            poly.interiorAngleExpressions[i] = previous;
            editState[`angle_${label}`] = previous;
            this.editPane!.refresh();
          }
      });
    });
  }

  private tryApplyPolygonExpressions(
    poly: PolygonData,
    alertOnError: boolean = true,
    refreshDisplay: boolean = true
  ): boolean {
    const evaluated = this.evaluatePolygonExpressions(poly.sideLengthExpressions, poly.interiorAngleExpressions, alertOnError);
    if (!evaluated) {
      return false;
    }

    poly.sideLengths = evaluated.sideLengths;
    poly.interiorAngles = evaluated.interiorAngles;
    poly.points = evaluated.points;
    poly.isClosed = evaluated.isClosed;
    this.drawPolygonInstance(poly);
    if (this.selectedPolygon === poly) {
      this.updateSelectedLabels();
    }
    if (refreshDisplay) {
      this.updateDisplay();
    }
    return true;
  }

  private buildVertexLabels(sides: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < sides; i++) {
      labels.push(String.fromCharCode('A'.charCodeAt(0) + i));
    }
    return labels;
  }

  private buildEdgeLabels(sides: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < sides; i++) {
      const start = String.fromCharCode('A'.charCodeAt(0) + i);
      const end = String.fromCharCode('A'.charCodeAt(0) + ((i + 1) % sides));
      labels.push(`${start}${end}`);
    }
    return labels;
  }

  private parseAngleUnit(token: string): 'rad' | 'deg' {
    if (token === 'd' || token === 'deg' || token === 'degree' || token === 'degrees') return 'deg';
    if (token === 'r' || token === 'rad' || token === 'radian' || token === 'radians') return 'rad';
    throw new Error(`Unknown angle unit: ${token}`);
  }

  private updateSelectedLabels() {
    if (!this.labelContainer) return;
    this.labelContainer.removeChildren().forEach(child => child.destroy());

    if (!this.selectedPolygon) return;
    const labels = this.buildVertexLabels(this.selectedPolygon.sides);
    const points = this.selectedPolygon.points.slice(0, this.selectedPolygon.sides);
    const fontSize = 12 / this.config.scale;
    const strokeWidth = Math.max(1 / this.config.scale, fontSize * 0.12);
    const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    centroid.x /= points.length;
    centroid.y /= points.length;
    points.forEach((point, index) => {
      const dir = { x: point.x - centroid.x, y: point.y - centroid.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const offset = { x: (dir.x / len) * fontSize, y: (dir.y / len) * fontSize };
      const label = new Graphics();
      drawLetter(label, labels[index], fontSize, 0xffd24d, strokeWidth);
      label.x = this.selectedPolygon!.x + point.x + offset.x - fontSize * 0.5;
      label.y = this.selectedPolygon!.y + point.y + offset.y - fontSize * 0.5;
      this.labelContainer.addChild(label);
    });
  }
}

new TileEditor();
