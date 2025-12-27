import { Pane } from 'tweakpane';
import * as TextareaPlugin from '@pangenerator/tweakpane-textarea-plugin';
import { Application, Container, Graphics } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { pointsCloseEuclidean } from '../../core/utils/geometry';
import { ExpressionParser } from './expression-parser';
import { pointInPolygon, pointNearPolyline, translatePoints } from './geometry-helpers';
import { DRAW_CONFIG } from './draw-config';
import { drawDashedPath, drawDottedConnection, drawLetter, drawPolygonPath } from './render-helpers';
import { setupValuesToggle } from './ui-helpers';
import { Point } from './types';
import { solveSimpleNgon } from '../../core/utils/solver';
import type { PolygonConstraint, VertexKind } from '../../core/utils/solver-types';
import { showToast } from '../../core/utils/toast';

interface EditorConfig {
  scale: number;
  numSides: number;
  sideLengthExpression: string;
  constantsText: string;
  edgeWidth: number;
  drawAxes: boolean;
  axesColor: string;
  axesLineWidth: number;
  closedPolygonEpsilon: number;
  viewOffset: { x: number; y: number };
}

interface PolygonDescription {
  sides: number;
  sideLengthExpressions: string[];
  interiorAngleExpressions: string[];
  sideLengths: number[];
  interiorAngles: number[];
  points: Point[];
  isClosed: boolean;
  hasError: boolean;
  errorType: 'expression' | 'solver' | null;
  invalidSideExpressions: boolean[];
  invalidAngleExpressions: boolean[];
}

interface PolygonData {
  x: number;
  y: number;
  rotationExpression: string;
  rotation: number;
  description: PolygonDescription;
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

interface DescriptionEvaluation {
  sideLengths: number[];
  interiorAngles: number[];
  points: Point[];
  isClosed: boolean;
  hasError: boolean;
  errorType: 'expression' | 'solver' | null;
  errorMessage?: string;
  invalidSideExpressions: boolean[];
  invalidAngleExpressions: boolean[];
}

interface SavedTilingV1 {
  version: 1;
  config: {
    numSides: number;
    sideLengthExpression: string;
    edgeWidth: number;
    closedPolygonEpsilon: number;
    constantsText: string;
    drawAxes?: boolean;
    axesColor?: string;
    axesLineWidth?: number;
  };
  descriptions: Array<{
    id: string;
    sides: number;
    sideLengthExpressions: string[];
    interiorAngleExpressions: string[];
  }>;
  instances: Array<{
    descriptionId: string;
    x: number;
    y: number;
    rotationExpression: string;
  }>;
}

class TileEditor {
  private pane!: Pane;
  private editPane: Pane | null = null;
  private editPaneContainer!: HTMLElement;
  private hasSavedState = true;
  private typeExpressionBindings: {
    description: PolygonDescription | null;
    side: HTMLElement[];
    angle: HTMLElement[];
  } = { description: null, side: [], angle: [] };
  private readonly scaleBounds = { ...DRAW_CONFIG.editorControls.scale };
  private config: EditorConfig = {
    scale: DRAW_CONFIG.defaultScale,
    numSides: 4,
    sideLengthExpression: '1',
    constantsText: '',
    edgeWidth: DRAW_CONFIG.defaultEdgeWidth,
    drawAxes: true,
    axesColor: DRAW_CONFIG.defaultAxesColor,
    axesLineWidth: DRAW_CONFIG.defaultAxesLineWidth,
    closedPolygonEpsilon: DRAW_CONFIG.defaultClosedPolygonEpsilon,
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
    const displayContainer = document.getElementById('values-display');
    if (!displayContainer) {
      throw new Error('Missing #values-display');
    }
    const editPaneContainer = document.getElementById('editpane-container');
    if (!editPaneContainer) {
      throw new Error('Missing #editpane-container');
    }
    this.displayContainer = displayContainer;
    this.editPaneContainer = editPaneContainer;
    this.initTweakpane();
    this.initPixi();
    this.updateDisplay();
    this.setupUI();
    this.showEditPane(true);
    this.buildEditPane(null);
    window.addEventListener('beforeunload', (event) => {
      if (!this.shouldWarnOnUnload()) return;
      event.preventDefault();
      event.returnValue = '';
    });
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
      background: DRAW_CONFIG.backgroundColor,
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
      const clickedPoly = this.getPolygonAt(worldPos.x, worldPos.y);
      if (clickedPoly) {
        this.clonePolygonInstance(clickedPoly, worldPos);
        return;
      }
      const sideLength = this.getEvaluatedSideLength();
      if (sideLength !== null && sideLength > 0) {
        this.createPolygon(worldPos.x, worldPos.y, this.config.numSides);
      }
    });

    // Update loop
    this.app.ticker.add(() => {
      this.dashOffset += DRAW_CONFIG.dashAnimationSpeed / this.config.scale;
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
    this.pane.registerPlugin(TextareaPlugin);

    const commandsFolder = this.pane.addFolder({ title: 'Commands' });
    const tilingFolder = this.pane.addFolder({ title: 'Tiling' });
    const viewFolder = this.pane.addFolder({ title: 'View' });
    const guiFolder = this.pane.addFolder({ title: 'Gui Settings' });
    const advancedFolder = this.pane.addFolder({ title: 'Advanced/Debug' });

    commandsFolder.addButton({
      title: 'Center View',
    }).on('click', () => {
      this.centerViewToPolygons();
    });

    commandsFolder.addButton({
      title: 'Save Tiling',
    }).on('click', () => this.saveTiling());

    commandsFolder.addButton({
      title: 'Load Tiling',
    }).on('click', () => this.triggerLoadTiling());

    tilingFolder.addBinding(this.config, 'numSides', {
      min: DRAW_CONFIG.editorControls.numSides.min,
      max: DRAW_CONFIG.editorControls.numSides.max,
      step: DRAW_CONFIG.editorControls.numSides.step,
      label: 'Number of Sides',
    }).on('change', () => this.updateDisplay());

    tilingFolder.addBinding(this.config, 'sideLengthExpression', {
      label: 'Side Length Expr',
    }).on('change', () => this.updateDisplay());

    viewFolder.addBinding(this.config, 'scale', {
      min: DRAW_CONFIG.editorControls.scale.min,
      max: DRAW_CONFIG.editorControls.scale.max,
      label: 'Scale',
    }).on('change', () => {
        this.updateDisplay();
        this.updateScale();
        this.redrawPolygons();
    });

    viewFolder.addBinding(this.config, 'viewOffset', {
      label: 'View Offset',
    }).on('change', () => {
        this.updateDisplay();
        this.updateViewportCenter();
    });

    guiFolder.addBinding(this.config, 'edgeWidth', {
      min: DRAW_CONFIG.editorControls.edgeWidth.min,
      max: DRAW_CONFIG.editorControls.edgeWidth.max,
      step: DRAW_CONFIG.editorControls.edgeWidth.step,
      label: 'Edge Width',
    }).on('change', () => {
        this.updateDisplay();
        this.redrawPolygons();
    });

    guiFolder.addBinding(this.config, 'drawAxes', {
      label: 'Draw Axes',
    }).on('change', () => {
      this.updatePreview();
    });

    guiFolder.addBinding(this.config, 'axesColor', {
      label: 'Axes Color',
    }).on('change', () => {
      this.updatePreview();
    });

    guiFolder.addBinding(this.config, 'axesLineWidth', {
      min: DRAW_CONFIG.editorControls.axesLineWidth.min,
      max: DRAW_CONFIG.editorControls.axesLineWidth.max,
      step: DRAW_CONFIG.editorControls.axesLineWidth.step,
      label: 'Axes Line Width',
    }).on('change', () => {
      this.updatePreview();
    });

    advancedFolder.addBinding(this.config, 'closedPolygonEpsilon', {
      min: DRAW_CONFIG.editorControls.closedPolygonEpsilon.min,
      max: DRAW_CONFIG.editorControls.closedPolygonEpsilon.max,
      step: DRAW_CONFIG.editorControls.closedPolygonEpsilon.step,
      label: 'Closed Polygon Epsilon',
    }).on('change', () => {
        this.updateDisplay();
    });

    tilingFolder.addBinding(this.config, 'constantsText', {
      label: 'Constants',
      view: 'textarea',
      rows: 6,
      placeholder: 'NAME=EXPR',
    }).on('change', () => {
      this.applyConstantsChange();
    });
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
    const descriptions = this.getUniqueDescriptions();
    descriptions.forEach((description) => {
      this.tryApplyDescriptionExpressions(description, false, false);
    });
    this.markUnsaved();
    if (this.selectedPolygon) {
      this.updateSelectedLabels();
    }
    this.updateDisplay();
  }

  private getUniqueDescriptions(): PolygonDescription[] {
    const seen = new Set<PolygonDescription>();
    const descriptions: PolygonDescription[] = [];
    for (const poly of this.polygons) {
      if (!seen.has(poly.description)) {
        seen.add(poly.description);
        descriptions.push(poly.description);
      }
    }
    return descriptions;
  }

  private saveTiling() {
    const descriptions = this.getUniqueDescriptions();
    const descriptionIds = new Map<PolygonDescription, string>();
    const descriptionData = descriptions.map((description, index) => {
      const id = `desc_${index + 1}`;
      descriptionIds.set(description, id);
      return {
        id,
        sides: description.sides,
        sideLengthExpressions: description.sideLengthExpressions,
        interiorAngleExpressions: description.interiorAngleExpressions,
      };
    });

    const instances = this.polygons.map((poly) => ({
      descriptionId: descriptionIds.get(poly.description) ?? 'unknown',
      x: poly.x,
      y: poly.y,
      rotationExpression: poly.rotationExpression,
    }));

    const payload: SavedTilingV1 = {
      version: 1,
      config: {
        numSides: this.config.numSides,
        sideLengthExpression: this.config.sideLengthExpression,
        edgeWidth: this.config.edgeWidth,
        closedPolygonEpsilon: this.config.closedPolygonEpsilon,
        constantsText: this.config.constantsText,
        drawAxes: this.config.drawAxes,
        axesColor: this.config.axesColor,
        axesLineWidth: this.config.axesLineWidth,
      },
      descriptions: descriptionData,
      instances,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tile-editor-tiling.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.hasSavedState = true;
  }

  private triggerLoadTiling() {
    if (this.shouldWarnOnUnload()) {
      const proceed = confirm('Unsaved polygons will be lost. Continue?');
      if (!proceed) return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        this.loadTilingFromString(reader.result);
      };
      reader.readAsText(file);
    });
    input.click();
  }

  private loadTilingFromString(raw: string) {
    try {
      const parsed = JSON.parse(raw) as SavedTilingV1;
      if (!parsed || parsed.version !== 1) {
        alert('Unsupported tiling format version.');
        return;
      }
      this.applyLoadedTiling(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown load error';
      alert(`Failed to load tiling: ${message}`);
    }
  }

  private applyLoadedTiling(data: SavedTilingV1) {
    this.clearPolygons();
    this.selectedPolygon = null;
    this.buildEditPane(null);

    this.config.numSides = data.config.numSides;
    this.config.sideLengthExpression = data.config.sideLengthExpression;
    this.config.edgeWidth = data.config.edgeWidth;
    this.config.closedPolygonEpsilon = data.config.closedPolygonEpsilon;
    this.config.constantsText = data.config.constantsText;
    this.config.drawAxes = data.config.drawAxes ?? true;
    this.config.axesColor = data.config.axesColor ?? '#444444';
    this.config.axesLineWidth = data.config.axesLineWidth ?? 1;
    this.refreshConstants();

    const descriptions = new Map<string, PolygonDescription>();
    for (const desc of data.descriptions) {
      const evaluated = this.evaluateDescriptionExpressions(
        desc.sideLengthExpressions,
        desc.interiorAngleExpressions,
        true
      );
      descriptions.set(desc.id, {
        sides: desc.sides,
        sideLengthExpressions: desc.sideLengthExpressions,
        interiorAngleExpressions: desc.interiorAngleExpressions,
        sideLengths: evaluated.sideLengths,
        interiorAngles: evaluated.interiorAngles,
        points: evaluated.points,
        isClosed: evaluated.isClosed,
        hasError: evaluated.hasError,
        errorType: evaluated.errorType,
        invalidSideExpressions: evaluated.invalidSideExpressions,
        invalidAngleExpressions: evaluated.invalidAngleExpressions,
      });
    }

    for (const instance of data.instances) {
      const description = descriptions.get(instance.descriptionId);
      if (!description) continue;
      const rotationValue = this.evaluateRotationExpression(instance.rotationExpression);
      if (typeof rotationValue !== 'number') {
        alert(`Rotation error: ${rotationValue}`);
        continue;
      }
      const g = new Graphics();
      g.zIndex = 0;
      this.polygonContainer.addChild(g);
      this.polygonContainer.addChild(this.labelContainer);

      const poly: PolygonData = {
        x: instance.x,
        y: instance.y,
        rotationExpression: instance.rotationExpression,
        rotation: rotationValue,
        description,
        points: [],
        isClosed: description.isClosed,
        graphics: g,
        isHovered: false,
      };
      this.polygons.push(poly);
      this.updateInstanceFromDescription(poly);
    }

    this.pane.refresh();
    this.centerViewToPolygons();
    this.updateDisplay();
    this.hasSavedState = true;
  }

  private clearPolygons() {
    this.polygons.forEach((poly) => poly.graphics.destroy());
    this.polygons = [];
    this.labelContainer.removeChildren().forEach((child) => child.destroy());
  }

  private markUnsaved() {
    if (this.polygons.length === 0) return;
    this.hasSavedState = false;
  }

  private shouldWarnOnUnload(): boolean {
    return this.polygons.length > 0 && !this.hasSavedState;
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
    const start = poly.points[0] ?? { x: 0, y: 0 };
    const divergence = Math.hypot(end.x - start.x, end.y - start.y);
    const angleSum = poly.description.interiorAngles.reduce((sum, angle) => sum + angle, 0);
    const expectedAngleSum = (poly.description.sides - 2) * Math.PI;
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
        <div class="value-content">${poly.description.sides}</div>
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
    const sideLabels = this.buildEdgeLabels(poly.description.sides);
    return sideLabels
      .map((label, i) => `
        <div class="value-row">
          <div class="value-label">${label}</div>
          <div class="value-content">${this.formatNumber(poly.description.sideLengths[i] ?? 0)}</div>
        </div>
      `)
      .join('');
  }

  private buildPolygonAnglesDisplay(poly: PolygonData): string {
    const angleLabels = this.buildVertexLabels(poly.description.sides);
    return angleLabels
      .map((label, i) => `
        <div class="value-row">
          <div class="value-label">${label}</div>
          <div class="value-content">${this.formatAngle(poly.description.interiorAngles[i] ?? 0)}</div>
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

      const center = this.getPolygonCenter(points);
      const centered = points.map((point) => ({
          x: point.x - center.x,
          y: point.y - center.y,
      }));
      return centered.map((point) => ({ x: point.x, y: -point.y }));
  }

  private buildDummyEvaluation(
      sides: number,
      invalidSideExpressions: boolean[],
      invalidAngleExpressions: boolean[],
      errorType: 'expression' | 'solver',
      errorMessage?: string
  ): DescriptionEvaluation {
      const sideLengths = new Array<number>(sides).fill(1);
      const interiorAngle = ((sides - 2) / sides) * Math.PI;
      const interiorAngles = new Array<number>(sides).fill(interiorAngle);
      const points = this.buildPolygonPoints(sideLengths, interiorAngles);
      return {
          sideLengths,
          interiorAngles,
          points,
          isClosed: false,
          hasError: true,
          errorType,
          errorMessage,
          invalidSideExpressions,
          invalidAngleExpressions,
      };
  }

  private rotatePoints(points: Point[], rotation: number): Point[] {
      if (rotation === 0) return points;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return points.map((point) => {
          return {
              x: point.x * cos - point.y * sin,
              y: point.x * sin + point.y * cos,
          };
      });
  }

  private getPolygonCenter(points: Point[]): Point {
      const last = points[points.length - 1];
      const first = points[0];
      const isClosedLoop =
        points.length > 1 && pointsCloseEuclidean(last, first, this.config.closedPolygonEpsilon);
      const count = Math.max(1, isClosedLoop ? points.length - 1 : points.length);
      let sumX = 0;
      let sumY = 0;
      for (let i = 0; i < count; i++) {
          sumX += points[i].x;
          sumY += points[i].y;
      }
      return { x: sumX / count, y: sumY / count };
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

  private evaluateRotationExpression(expr: string): number | string {
      return this.evaluateAngleExpression(expr);
  }

  private evaluateDescriptionExpressions(
      sideLengthExpressions: string[],
      interiorAngleExpressions: string[],
      alertOnError: boolean
  ): DescriptionEvaluation {
      const hasUnknownSides = sideLengthExpressions.some((expr) => expr.trim() === '?');
      const hasUnknownAngles = interiorAngleExpressions.some((expr) => expr.trim() === '?');
      const invalidSideExpressions = new Array<boolean>(sideLengthExpressions.length).fill(false);
      const invalidAngleExpressions = new Array<boolean>(interiorAngleExpressions.length).fill(false);
      const sideLengths: number[] = [];
      let expressionError: string | null = null;
      for (const expr of sideLengthExpressions) {
          const trimmed = expr.trim();
          if (trimmed === '?') {
              sideLengths.push(NaN);
              continue;
          }
          const value = this.evaluateSideLengthExpression(expr);
          if (typeof value !== 'number') {
              if (!expressionError) {
                  expressionError = `Side length error: ${value}`;
              }
              invalidSideExpressions[sideLengths.length] = true;
              sideLengths.push(NaN);
              continue;
          }
          sideLengths.push(value);
      }

      const interiorAngles: number[] = [];
      for (const expr of interiorAngleExpressions) {
          const trimmed = expr.trim();
          if (trimmed === '?') {
              interiorAngles.push(NaN);
              continue;
          }
          const value = this.evaluateAngleExpression(expr);
          if (typeof value !== 'number') {
              if (!expressionError) {
                  expressionError = `Angle error: ${value}`;
              }
              invalidAngleExpressions[interiorAngles.length] = true;
              interiorAngles.push(NaN);
              continue;
          }
          interiorAngles.push(value);
      }

      if (expressionError) {
          if (alertOnError) {
              showToast(expressionError, { type: 'error' });
          }
          return this.buildDummyEvaluation(
              sideLengthExpressions.length,
              invalidSideExpressions,
              invalidAngleExpressions,
              'expression',
              expressionError
          );
      }

      if (hasUnknownSides || hasUnknownAngles) {
          return this.solvePolygonWithUnknowns(
              sideLengthExpressions,
              interiorAngleExpressions,
              alertOnError
          );
      }

      const points = this.buildPolygonPoints(sideLengths, interiorAngles);
      const end = points[points.length - 1];
      const start = points[0];
      const isClosed = pointsCloseEuclidean(end, start, this.config.closedPolygonEpsilon);

      return {
          sideLengths,
          interiorAngles,
          points,
          isClosed,
          hasError: false,
          errorType: null,
          invalidSideExpressions,
          invalidAngleExpressions,
      };
  }

  private solvePolygonWithUnknowns(
      sideLengthExpressions: string[],
      interiorAngleExpressions: string[],
      alertOnError: boolean
  ): DescriptionEvaluation {
      const constraints: PolygonConstraint[] = [];
      const sideLengths: number[] = [];
      const interiorAngles: number[] = [];
      const vertexKinds: VertexKind[] = new Array<VertexKind>(sideLengthExpressions.length).fill('convex');

      for (let i = 0; i < sideLengthExpressions.length; i++) {
          const expr = sideLengthExpressions[i].trim();
          if (expr === '?') {
              sideLengths[i] = NaN;
              continue;
          }
          const value = this.evaluateSideLengthExpression(expr);
          if (typeof value !== 'number') {
              if (alertOnError) {
                  showToast(`Side length error: ${value}`, { type: 'error' });
              }
              return this.buildDummyEvaluation(
                  sideLengthExpressions.length,
                  new Array<boolean>(sideLengthExpressions.length).fill(false),
                  new Array<boolean>(interiorAngleExpressions.length).fill(false),
                  'expression',
                  `Side length error: ${value}`
              );
          }
          sideLengths[i] = value;
          constraints.push({ type: 'length', seg: {i, j: (i + 1) % sideLengthExpressions.length }, length: value });
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
                  showToast(`Angle error: ${value}`, { type: 'error' });
              }
              return this.buildDummyEvaluation(
                  sideLengthExpressions.length,
                  new Array<boolean>(sideLengthExpressions.length).fill(false),
                  new Array<boolean>(interiorAngleExpressions.length).fill(false),
                  'expression',
                  `Angle error: ${value}`
              );
          }
          interiorAngles[i] = value;
          constraints.push({ type: 'interiorAngle', i, angleRad: value });
          vertexKinds[i] = value > Math.PI ? 'reflex' : 'convex';
      }

      const result = solveSimpleNgon(
          sideLengthExpressions.length,
          vertexKinds,
          constraints,
          { diagnostics: 'none' }
      );

      if ('kind' in result) {
          if (alertOnError) {
              showToast(`Solver error: ${result.message}`, { type: 'warning' });
          }
          return this.buildDummyEvaluation(
              sideLengthExpressions.length,
              new Array<boolean>(sideLengthExpressions.length).fill(false),
              new Array<boolean>(interiorAngleExpressions.length).fill(false),
              'solver',
              result.message
          );
      }

      const points = this.buildPolygonPoints(result.sideLengths, result.interiorAngles);
      const end = points[points.length - 1];
      const start = points[0];
      const isClosed = pointsCloseEuclidean(end, start, this.config.closedPolygonEpsilon);
      return {
          sideLengths: result.sideLengths,
          interiorAngles: result.interiorAngles,
          points,
          isClosed,
          hasError: false,
          errorType: null,
          invalidSideExpressions: new Array<boolean>(sideLengthExpressions.length).fill(false),
          invalidAngleExpressions: new Array<boolean>(interiorAngleExpressions.length).fill(false),
      };
  }

  private updatePreview() {
      if (!this.app) return;
      
      this.previewGraphics.clear();
      this.previewGraphics.removeChildren().forEach((child) => child.destroy());

      if (!this.config.drawAxes) {
        return;
      }

      const colorValue = Number.parseInt(this.config.axesColor.replace('#', ''), 16);
      const width = this.config.axesLineWidth / this.config.scale;

      const xAxisEnd = DRAW_CONFIG.axesEndpoints.x;
      const yAxisEnd = DRAW_CONFIG.axesEndpoints.y;
      const xAxisDisplay = { x: xAxisEnd.x, y: -xAxisEnd.y };
      const yAxisDisplay = { x: yAxisEnd.x, y: -yAxisEnd.y };

      this.previewGraphics.moveTo(0, 0);
      this.previewGraphics.lineTo(xAxisDisplay.x, xAxisDisplay.y);
      this.previewGraphics.moveTo(0, 0);
      this.previewGraphics.lineTo(yAxisDisplay.x, yAxisDisplay.y);
      this.previewGraphics.stroke({ color: colorValue, width });

      const labelX = new Graphics();
      const labelY = new Graphics();
      const fontSize = DRAW_CONFIG.labelFontSizePx / this.config.scale;
      const strokeWidth = Math.max(
        DRAW_CONFIG.labelStrokeMinPx / this.config.scale,
        fontSize * DRAW_CONFIG.labelStrokeScale
      );
      drawLetter(labelX, 'X', fontSize, colorValue, strokeWidth);
      drawLetter(labelY, 'Y', fontSize, colorValue, strokeWidth);
      labelX.x = xAxisDisplay.x + fontSize * DRAW_CONFIG.axisLabelOffsets.x.dx;
      labelX.y = xAxisDisplay.y + fontSize * DRAW_CONFIG.axisLabelOffsets.x.dy;
      labelY.x = yAxisDisplay.x + fontSize * DRAW_CONFIG.axisLabelOffsets.y.dx;
      labelY.y = yAxisDisplay.y + fontSize * DRAW_CONFIG.axisLabelOffsets.y.dy;
      this.previewGraphics.addChild(labelX);
      this.previewGraphics.addChild(labelY);
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
          this.markUnsaved();
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
      const rotationExpression = '0';
      const rotationValue = this.evaluateRotationExpression(rotationExpression);
      if (typeof rotationValue !== 'number') {
          alert(`Rotation error: ${rotationValue}`);
          g.destroy();
          return;
      }
      const evaluated = this.evaluateDescriptionExpressions(sideLengthExpressions, interiorAngleExpressions, true);
      if (!evaluated.isClosed && !evaluated.hasError) {
          alert('Polygon is not closed with the current parameters.');
          g.destroy();
          return;
      }

      const description: PolygonDescription = {
          sides,
          sideLengthExpressions,
          interiorAngleExpressions,
          sideLengths: evaluated.sideLengths,
          interiorAngles: evaluated.interiorAngles,
          points: evaluated.points,
          isClosed: evaluated.isClosed,
          hasError: evaluated.hasError,
          errorType: evaluated.errorType,
          invalidSideExpressions: evaluated.invalidSideExpressions,
          invalidAngleExpressions: evaluated.invalidAngleExpressions,
      };

      const poly: PolygonData = {
          x,
          y,
          rotationExpression,
          rotation: rotationValue,
          description,
          points: this.rotatePoints(evaluated.points, rotationValue),
          isClosed: evaluated.isClosed,
          graphics: g,
          isHovered: false
      };
      
      this.polygons.push(poly);
      this.drawPolygonInstance(poly);
      this.markUnsaved();
  }

  private drawPolygonInstance(poly: PolygonData) {
      const isSelected = this.selectedPolygon === poly;
      const hasError = poly.description.hasError;
      const color = poly.isHovered
        ? DRAW_CONFIG.polygonFillColors.hover
        : hasError
          ? DRAW_CONFIG.polygonFillColors.error
          : DRAW_CONFIG.polygonFillColors.normal;
      const alpha = poly.isClosed && !hasError ? DRAW_CONFIG.polygonFillAlpha : 0;
      const baseStroke = hasError
        ? DRAW_CONFIG.polygonStrokeColors.error
        : poly.isClosed
          ? DRAW_CONFIG.polygonStrokeColors.closed
          : DRAW_CONFIG.polygonStrokeColors.error;
      const strokeColor = (poly.isHovered && !isSelected)
        ? DRAW_CONFIG.polygonStrokeColors.hover
        : baseStroke;
      const openStrokeColor = DRAW_CONFIG.polygonStrokeColors.error;
      
      drawPolygonPath(
        poly.graphics,
        poly.points,
        { x: poly.x, y: poly.y },
        color,
        alpha,
        strokeColor,
        this.getStrokeWidth()
      );

      if (!poly.isClosed || hasError) {
          drawDottedConnection(
            poly.graphics,
            { x: poly.points[0].x + poly.x, y: poly.points[0].y + poly.y },
            { x: poly.points[poly.points.length - 1].x + poly.x, y: poly.points[poly.points.length - 1].y + poly.y },
            openStrokeColor,
            this.getStrokeWidth(),
            this.config.scale
          );
      }

      if (hasError) {
          this.drawErrorDiagonals(poly, openStrokeColor);
      }

      if (isSelected) {
          drawDashedPath(
            poly.graphics,
            poly.points,
            { x: poly.x, y: poly.y },
            DRAW_CONFIG.selectionStrokeColors.primary,
            DRAW_CONFIG.selectionStrokeColors.secondary,
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

  private clonePolygonInstance(source: PolygonData, worldPos: Point) {
      const center = this.getPolygonWorldCenter(source);
      let dir = { x: worldPos.x - center.x, y: worldPos.y - center.y };
      const dirLen = Math.hypot(dir.x, dir.y);
      if (dirLen < 1e-9) {
        dir = { x: 1, y: 0 };
      } else {
        dir = { x: dir.x / dirLen, y: dir.y / dirLen };
      }

      const vertices = this.getPolygonWorldVertices(source);
      const intersection = this.getFurthestRayIntersection(center, dir, vertices);
      const distance = intersection?.distance ?? this.getPolygonRadius(vertices, center);
      const newCenter = {
        x: center.x + dir.x * distance * 2,
        y: center.y + dir.y * distance * 2,
      };

      const localCenter = this.getPolygonCenter(source.points);
      const g = new Graphics();
      g.zIndex = 0;
      this.polygonContainer.addChild(g);
      this.polygonContainer.addChild(this.labelContainer);

      const clone: PolygonData = {
        x: newCenter.x - localCenter.x,
        y: newCenter.y - localCenter.y,
        rotationExpression: source.rotationExpression,
        rotation: source.rotation,
        description: source.description,
        points: [],
        isClosed: source.description.isClosed,
        graphics: g,
        isHovered: false,
      };

      this.polygons.push(clone);
      this.updateInstanceFromDescription(clone);
      this.markUnsaved();
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

  private getPolygonWorldVertices(poly: PolygonData): Point[] {
    const vertices = poly.points.slice(0, poly.description.sides);
    return vertices.map((point) => ({ x: point.x + poly.x, y: point.y + poly.y }));
  }

  private drawErrorDiagonals(poly: PolygonData, color: number) {
    const vertices = poly.points.slice(0, poly.description.sides);
    const count = vertices.length;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const adjacent = j === i + 1 || (i === 0 && j === count - 1);
        if (adjacent) continue;
        const start = { x: vertices[i].x + poly.x, y: vertices[i].y + poly.y };
        const end = { x: vertices[j].x + poly.x, y: vertices[j].y + poly.y };
        drawDottedConnection(
          poly.graphics,
          start,
          end,
          color,
          this.getStrokeWidth(),
          this.config.scale
        );
      }
    }
  }

  private getPolygonWorldCenter(poly: PolygonData): Point {
    return this.getPolygonCenter(this.getPolygonWorldVertices(poly));
  }

  private getFurthestRayIntersection(origin: Point, dir: Point, vertices: Point[]) {
    let bestDistance = -1;
    let bestPoint: Point | null = null;
    const count = vertices.length;
    for (let i = 0; i < count; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % count];
      const t = this.raySegmentIntersection(origin, dir, a, b);
      if (t !== null && t > bestDistance) {
        bestDistance = t;
        bestPoint = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
      }
    }
    if (!bestPoint) return null;
    return { point: bestPoint, distance: bestDistance };
  }

  private raySegmentIntersection(origin: Point, dir: Point, a: Point, b: Point): number | null {
    const v = { x: b.x - a.x, y: b.y - a.y };
    const w = { x: a.x - origin.x, y: a.y - origin.y };
    const denom = this.cross2d(dir, v);
    if (Math.abs(denom) < 1e-10) return null;
    const t = this.cross2d(w, v) / denom;
    const u = this.cross2d(w, dir) / denom;
    if (t >= 0 && u >= 0 && u <= 1) return t;
    return null;
  }

  private cross2d(a: Point, b: Point): number {
    return a.x * b.y - a.y * b.x;
  }

  private getPolygonRadius(vertices: Point[], center: Point): number {
    let maxDist = 0;
    for (const point of vertices) {
      const dist = Math.hypot(point.x - center.x, point.y - center.y);
      maxDist = Math.max(maxDist, dist);
    }
    return maxDist || 1;
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

    const editState: Record<string, string> = {};
    const sideLabels = this.buildEdgeLabels(poly.description.sides);
    const angleLabels = this.buildVertexLabels(poly.description.sides);

    editState.rotation = poly.rotationExpression;
    poly.description.sideLengthExpressions.forEach((expr, i) => {
      editState[`side_${sideLabels[i]}`] = expr;
    });
    poly.description.interiorAngleExpressions.forEach((expr, i) => {
      editState[`angle_${angleLabels[i]}`] = expr;
    });

    const instanceFolder = this.editPane.addFolder({ title: 'Instance Values' });
    const typeFolder = this.editPane.addFolder({ title: 'Type Values' });
    const sideBindings: HTMLElement[] = [];
    const angleBindings: HTMLElement[] = [];

    const positionState = { position: { x: poly.x, y: poly.y } };
    instanceFolder.addBinding(positionState, 'position', { label: 'Position' }).on('change', () => {
      poly.x = positionState.position.x;
      poly.y = positionState.position.y;
      this.drawPolygonInstance(poly);
      this.updateSelectedLabels();
      this.updateDisplay();
      this.markUnsaved();
    });

    instanceFolder.addBinding(editState, 'rotation', {
      label: 'Rotation Expression',
    }).on('change', (event) => {
      const previous = poly.rotationExpression;
      const previousValue = poly.rotation;
      const evaluated = this.evaluateRotationExpression(event.value);
      if (typeof evaluated !== 'number') {
        alert(`Rotation error: ${evaluated}`);
        editState.rotation = previous;
        if (!this.editPane) {
          throw new Error('Polygon editor pane missing while reverting rotation.');
        }
        this.editPane.refresh();
        return;
      }
      poly.rotationExpression = event.value;
      poly.rotation = evaluated;
      if (!this.updateInstanceFromDescription(poly)) {
        poly.rotationExpression = previous;
        poly.rotation = previousValue;
        editState.rotation = previous;
        instanceFolder.refresh();
      } else {
        this.updateDisplay();
        this.markUnsaved();
      }
    });

    sideLabels.forEach((label, i) => {
      const binding = typeFolder.addBinding(editState, `side_${label}`, {
        label: `Side Length Expression ${label}`,
      });
      sideBindings[i] = binding.element;
      binding.on('change', (event) => {
        const previous = poly.description.sideLengthExpressions[i];
        poly.description.sideLengthExpressions[i] = event.value;
        const ok = this.tryApplyDescriptionExpressions(poly.description);
        this.updateTypeExpressionStyles();
        if (!ok && event.value !== previous) {
          typeFolder.refresh();
        }
        if (event.value !== previous) {
          this.markUnsaved();
        }
      });
    });

    angleLabels.forEach((label, i) => {
      const binding = typeFolder.addBinding(editState, `angle_${label}`, {
        label: `Angle Expression ${label}`,
      });
      angleBindings[i] = binding.element;
      binding.on('change', (event) => {
        const previous = poly.description.interiorAngleExpressions[i];
        poly.description.interiorAngleExpressions[i] = event.value;
        const ok = this.tryApplyDescriptionExpressions(poly.description);
        this.updateTypeExpressionStyles();
        if (!ok && event.value !== previous) {
          typeFolder.refresh();
        }
        if (event.value !== previous) {
          this.markUnsaved();
        }
      });
    });

    this.typeExpressionBindings = {
      description: poly.description,
      side: sideBindings,
      angle: angleBindings,
    };
    this.updateTypeExpressionStyles();
  }

  private tryApplyDescriptionExpressions(
    description: PolygonDescription,
    alertOnError: boolean = true,
    refreshDisplay: boolean = true
  ): boolean {
    const evaluated = this.evaluateDescriptionExpressions(
      description.sideLengthExpressions,
      description.interiorAngleExpressions,
      alertOnError
    );

    description.sideLengths = evaluated.sideLengths;
    description.interiorAngles = evaluated.interiorAngles;
    description.points = evaluated.points;
    description.isClosed = evaluated.isClosed;
    description.hasError = evaluated.hasError;
    description.errorType = evaluated.errorType;
    description.invalidSideExpressions = evaluated.invalidSideExpressions;
    description.invalidAngleExpressions = evaluated.invalidAngleExpressions;

    this.polygons.forEach((poly) => {
      if (poly.description === description) {
        this.updateInstanceFromDescription(poly);
      }
    });

    this.updateTypeExpressionStyles();

    if (refreshDisplay) {
      this.updateDisplay();
    }
    return !evaluated.hasError;
  }

  private updateInstanceFromDescription(poly: PolygonData): boolean {
    poly.points = this.rotatePoints(poly.description.points, poly.rotation);
    poly.isClosed = poly.description.isClosed;
    this.drawPolygonInstance(poly);
    if (this.selectedPolygon === poly) {
      this.updateSelectedLabels();
    }
    return true;
  }

  private updateTypeExpressionStyles() {
    const { description, side, angle } = this.typeExpressionBindings;
    if (!description) return;
    if (this.selectedPolygon?.description !== description) return;
    side.forEach((element, index) => {
      const isInvalid = description.invalidSideExpressions[index];
      this.setBindingInvalid(element, isInvalid);
    });
    angle.forEach((element, index) => {
      const isInvalid = description.invalidAngleExpressions[index];
      this.setBindingInvalid(element, isInvalid);
    });
  }

  private setBindingInvalid(element: HTMLElement | undefined, invalid: boolean) {
    if (!element) return;
    element.classList.toggle('expression-invalid', invalid);
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
    const labels = this.buildVertexLabels(this.selectedPolygon.description.sides);
    const points = this.selectedPolygon.points.slice(0, this.selectedPolygon.description.sides);
    const fontSize = DRAW_CONFIG.labelFontSizePx / this.config.scale;
    const strokeWidth = Math.max(
      DRAW_CONFIG.labelStrokeMinPx / this.config.scale,
      fontSize * DRAW_CONFIG.labelStrokeScale
    );
    const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    centroid.x /= points.length;
    centroid.y /= points.length;
    points.forEach((point, index) => {
      const dir = { x: point.x - centroid.x, y: point.y - centroid.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const offset = { x: (dir.x / len) * fontSize, y: (dir.y / len) * fontSize };
      const label = new Graphics();
      drawLetter(label, labels[index], fontSize, DRAW_CONFIG.labelColor, strokeWidth);
      if (!this.selectedPolygon) {
        throw new Error('Selected polygon missing while updating labels.');
      }
      label.x = this.selectedPolygon.x + point.x + offset.x - fontSize * DRAW_CONFIG.vertexLabelCenterOffset;
      label.y = this.selectedPolygon.y + point.y + offset.y - fontSize * DRAW_CONFIG.vertexLabelCenterOffset;
      this.labelContainer.addChild(label);
    });
  }
}

new TileEditor();
