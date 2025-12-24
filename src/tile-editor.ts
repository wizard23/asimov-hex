import { Pane } from 'tweakpane';
import { Application, Container, Graphics, Text } from 'pixi.js';

type Point = { x: number; y: number };

interface EditorConfig {
  scale: number;
  numSides: number;
  sideLengthExpression: string;
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

class TileEditor {
  private pane!: Pane;
  private editPane: Pane | null = null;
  private editPaneContainer!: HTMLElement;
  private readonly scaleBounds = { min: 1, max: 200 };
  private config: EditorConfig = {
    scale: 100,
    numSides: 4,
    sideLengthExpression: '1',
    edgeWidth: 2,
    closedPolygonEpsilon: 1e-4,
    viewOffset: { x: 0, y: 0 },
  };
  private displayContainer: HTMLElement;
  
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
  private mousePosition = { x: 0, y: 0 };
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
    
    if (toggleBtn && valuesDisplay) {
      toggleBtn.onclick = () => {
        valuesDisplay.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
        
        // Force resize after transition
        setTimeout(() => {
          this.app.resize();
        }, 350); // Slightly longer than CSS transition
      };
    }
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
    
    this.app.stage.on('pointermove', (e) => {
      this.mousePosition = { x: e.global.x, y: e.global.y };
      this.worldMousePosition = this.globalToWorld(e.global);
      this.handlePointerMove(e);
    });
    
    this.app.stage.on('pointerdown', (e) => {
      this.handlePointerDown(e);
    });
    
    this.app.stage.on('pointerup', (e) => {
      this.handlePointerUp(e);
    });
    
    this.app.stage.on('pointerupoutside', (e) => {
      this.handlePointerUp(e);
    });

    this.app.canvas.addEventListener('dblclick', (e) => {
      const rect = this.app.canvas.getBoundingClientRect();
      const global = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPos = this.globalToWorld(global);
      const sideLength = this.getEvaluatedSideLength();
      if (sideLength !== null && sideLength > 0) {
        this.createPolygon(worldPos.x, worldPos.y, this.config.numSides, sideLength);
      }
    });

    // Update loop
    this.app.ticker.add(() => {
      this.dashOffset += 4 / this.config.scale;
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

  }

  private updateDisplay() {
    const expressionResult = this.evaluateExpression(this.config.sideLengthExpression);
    
    let resultDisplay = '';
    if (typeof expressionResult === 'number') {
      resultDisplay = expressionResult.toString();
    } else {
      resultDisplay = `<span class="error">${expressionResult}</span>`;
    }

    this.displayContainer.innerHTML = `
      <div class="value-row">
        <div class="value-label">Scale</div>
        <div class="value-content">${this.config.scale}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Number of Sides</div>
        <div class="value-content">${this.config.numSides}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Side Length</div>
        <div class="value-content">${resultDisplay}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Edge Width</div>
        <div class="value-content">${this.config.edgeWidth}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Closed Polygon Epsilon</div>
        <div class="value-content">${this.config.closedPolygonEpsilon}</div>
      </div>
      <div class="value-row">
        <div class="value-label">View Offset</div>
        <div class="value-content">${this.config.viewOffset.x.toFixed(2)}, ${this.config.viewOffset.y.toFixed(2)}</div>
      </div>
    `;
  }

  private getEvaluatedSideLength(): number | null {
      const res = this.evaluateExpression(this.config.sideLengthExpression);
      return typeof res === 'number' ? res : null;
  }

  private calculateRadius(sideLength: number, numSides: number): number {
      // s = 2 * r * sin(PI / n) => r = s / (2 * sin(PI / n))
      return sideLength / (2 * Math.sin(Math.PI / numSides));
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
      const isClosed = this.pointsClose(end, { x: 0, y: 0 }, this.config.closedPolygonEpsilon);

      return { sideLengths, interiorAngles, points, isClosed };
  }

  private drawPolygonShape(g: Graphics, x: number, y: number, sides: number, radius: number, color: number, alpha: number, strokeColor: number = 0xffffff, strokeWidth: number = 2) {
      g.clear();
      g.moveTo(x + radius, y); // Start at angle 0
      for (let i = 1; i <= sides; i++) {
          const angle = (i * 2 * Math.PI) / sides;
          g.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      }
      g.fill({ color, alpha });
      g.stroke({ color: strokeColor, width: strokeWidth });
  }

  private updatePreview() {
      if (!this.app) return;
      
      this.previewGraphics.clear();
  }

  private handlePointerDown(e: any) {
      const worldPos = this.globalToWorld(e.global);
      const clickedPoly = this.getPolygonAt(worldPos.x, worldPos.y);
      if (clickedPoly) {
          this.selectedPolygon = clickedPoly;
          this.buildEditPane(clickedPoly);
          this.updateSelectedLabels();
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
          this.redrawPolygons();
          this.isViewDragging = true;
          this.viewDragStart = { x: e.global.x, y: e.global.y };
          this.viewOffsetStart = { ...this.config.viewOffset };
      }
  }

  private handlePointerMove(e: any) {
      if (this.draggedPolygon) {
          const worldPos = this.globalToWorld(e.global);
          this.draggedPolygon.x = worldPos.x + this.dragOffset.x;
          this.draggedPolygon.y = worldPos.y + this.dragOffset.y;
          this.drawPolygonInstance(this.draggedPolygon);
          if (this.selectedPolygon === this.draggedPolygon) {
            this.updateSelectedLabels();
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

  private handlePointerUp(_e: any) {
      this.draggedPolygon = null;
      if (this.isViewDragging) {
        this.isViewDragging = false;
        this.pane.refresh();
      }
  }

  private createPolygon(x: number, y: number, sides: number, sideLength: number) {
      const g = new Graphics();
      g.zIndex = 0;
      this.polygonContainer.addChild(g);
      this.polygonContainer.addChild(this.labelContainer);
      const sideLengthExpressions = Array(sides).fill(this.config.sideLengthExpression);
      const interiorAngleExpressions = Array(sides).fill(this.defaultInteriorAngleExpression(sides));
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
      
      this.drawPolygonPath(
          poly.graphics,
          poly.points,
          { x: poly.x, y: poly.y },
          color,
          alpha,
          strokeColor,
          this.getStrokeWidth()
      );

      if (!poly.isClosed) {
          this.drawDottedConnection(
              poly.graphics,
              { x: poly.points[0].x + poly.x, y: poly.points[0].y + poly.y },
              { x: poly.points[poly.points.length - 1].x + poly.x, y: poly.points[poly.points.length - 1].y + poly.y },
              strokeColor,
              this.getStrokeWidth()
          );
      }

      if (isSelected) {
          this.drawDashedPath(
              poly.graphics,
              poly.points,
              { x: poly.x, y: poly.y },
              0xffd24d,
              this.getStrokeWidth(),
              true,
              this.dashOffset
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
          const worldPoints = this.translatePoints(p.points, { x: p.x, y: p.y });
          if (this.pointInPolygon({ x, y }, worldPoints) || this.pointNearPolyline({ x, y }, worldPoints, this.getHitTolerance(), true)) {
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

  private evaluateExpression(expr: string): number | string {
    try {
      return new ExpressionParser(expr).evaluate();
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

  private drawPolygonPath(
      g: Graphics,
      points: Point[],
      offset: Point,
      color: number,
      alpha: number,
      strokeColor: number,
      strokeWidth: number
  ) {
      g.clear();
      if (points.length < 2) return;
      g.moveTo(points[0].x + offset.x, points[0].y + offset.y);
      for (let i = 1; i < points.length; i++) {
          g.lineTo(points[i].x + offset.x, points[i].y + offset.y);
      }
      if (alpha > 0) {
          g.fill({ color, alpha });
      }
      g.stroke({ color: strokeColor, width: strokeWidth });
  }

  private drawDottedConnection(g: Graphics, start: Point, end: Point, color: number, width: number) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return;
      const dashLength = Math.max(width * 2, 4 / this.config.scale);
      const gapLength = dashLength;
      const step = dashLength + gapLength;
      const ux = dx / length;
      const uy = dy / length;
      for (let dist = 0; dist < length; dist += step) {
          const segmentStart = dist;
          const segmentEnd = Math.min(dist + dashLength, length);
          g.moveTo(start.x + ux * segmentStart, start.y + uy * segmentStart);
          g.lineTo(start.x + ux * segmentEnd, start.y + uy * segmentEnd);
      }
      g.stroke({ color, width });
  }

  private drawDashedPath(
      g: Graphics,
      points: Point[],
      offset: Point,
      color: number,
      width: number,
      closePath: boolean,
      dashOffset: number
  ) {
      if (points.length < 2) return;
      const dashLength = Math.max(width * 3, 6 / this.config.scale);
      const gapLength = dashLength;
      const pattern = dashLength + gapLength;
      const offsetNorm = ((dashOffset % pattern) + pattern) % pattern;
      let drawOn = offsetNorm < dashLength;
      let remaining = drawOn ? dashLength - offsetNorm : pattern - offsetNorm;
      const pathPoints = closePath ? [...points, points[0]] : points;

      for (let i = 0; i < pathPoints.length - 1; i++) {
          const start = { x: pathPoints[i].x + offset.x, y: pathPoints[i].y + offset.y };
          const end = { x: pathPoints[i + 1].x + offset.x, y: pathPoints[i + 1].y + offset.y };
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const segLen = Math.hypot(dx, dy);
          if (segLen === 0) continue;
          const ux = dx / segLen;
          const uy = dy / segLen;
          let segPos = 0;
          while (segPos < segLen) {
              const step = Math.min(remaining, segLen - segPos);
              if (drawOn && step > 0) {
                  const from = segPos;
                  const to = segPos + step;
                  g.moveTo(start.x + ux * from, start.y + uy * from);
                  g.lineTo(start.x + ux * to, start.y + uy * to);
              }
              segPos += step;
              remaining -= step;
              if (remaining <= 1e-6) {
                  drawOn = !drawOn;
                  remaining = drawOn ? dashLength : gapLength;
              }
          }
      }
      g.stroke({ color, width });
  }

  private translatePoints(points: Point[], offset: Point): Point[] {
      return points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));
  }

  private pointInPolygon(point: Point, polygon: Point[]): boolean {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const xi = polygon[i].x;
          const yi = polygon[i].y;
          const xj = polygon[j].x;
          const yj = polygon[j].y;
          const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi + Number.EPSILON) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  }

  private pointNearPolyline(point: Point, polyline: Point[], threshold: number, closePath: boolean): boolean {
      for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          if (this.distanceToSegment(point, a, b) <= threshold) {
              return true;
          }
      }
      if (closePath && polyline.length > 1) {
          const a = polyline[polyline.length - 1];
          const b = polyline[0];
          if (this.distanceToSegment(point, a, b) <= threshold) {
              return true;
          }
      }
      return false;
  }

  private distanceToSegment(p: Point, a: Point, b: Point): number {
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
      let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }

  private pointsClose(a: Point, b: Point, epsilon: number): boolean {
      return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
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
        parse: (value) => String(value),
        format: (value) => String(value),
      });
      return;
    }

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

  private tryApplyPolygonExpressions(poly: PolygonData): boolean {
    const evaluated = this.evaluatePolygonExpressions(poly.sideLengthExpressions, poly.interiorAngleExpressions, true);
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
    points.forEach((point, index) => {
      const label = new Text({
        text: `${labels[index]}`,
        style: {
          fill: 0xffd24d,
          fontSize,
        },
      });
      label.anchor.set(0.5, 0.5);
      label.x = this.selectedPolygon!.x + point.x;
      label.y = this.selectedPolygon!.y + point.y;
      this.labelContainer.addChild(label);
    });
  }
}

// --- Expression Parser ---

class ExpressionParser {
  private pos = 0;
  private tokens: string[] = [];

  constructor(private expression: string) {
    this.tokenize();
  }

  private tokenize() {
    // Regex for: functions/words, numbers, operators, parens, comma
    const regex = /([a-z][a-z0-9]*)|([0-9]+(?:\.[0-9]+)?)|(\+|-|\*|\/|\^|\(|\)|,)|(\s+)/gi;
    let match;
    while ((match = regex.exec(this.expression)) !== null) {
      // Group 1: Identifier
      // Group 2: Number
      // Group 3: Operator/Punctuation
      // Group 4: Whitespace (skip)
      if (match[4]) continue;
      this.tokens.push(match[0]);
    }
  }

  evaluate(): number {
    this.pos = 0;
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected token at end of expression');
    }
    return result;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (this.match('+') || this.match('-')) {
      const op = this.previous();
      const right = this.parseTerm();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.match('*') || this.match('/')) {
      const op = this.previous();
      const right = this.parseFactor();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    let left = this.parsePower();
    return left; // Power handles its own precedence usually higher than mul/div?
    // Actually standard precedence: ^ > * / > + -
    // So parseFactor should call parsePower
  }

  private parsePower(): number {
    let left = this.parsePrimary();
    if (this.match('^')) {
      const right = this.parsePower(); // Right associative? usually. 2^3^4 = 2^(3^4)
      left = Math.pow(left, right);
    }
    return left;
  }

  private parsePrimary(): number {
    if (this.match('(')) {
      const expr = this.parseExpression();
      if (!this.match(')')) throw new Error("Expected ')'");
      return expr;
    }

    if (this.isNumber()) {
      return parseFloat(this.advance());
    }

    if (this.isIdentifier()) {
      const name = this.advance().toLowerCase();
      if (this.match('(')) {
        if (this.isTrigFunction(name)) {
          return this.parseTrigCall(name);
        }

        const args: number[] = [];
        if (!this.check(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match(','));
        }
        if (!this.match(')')) throw new Error("Expected ')' after arguments");
        return this.callFunction(name, args);
      } else {
        // Constants?
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (name === 'phi') return (1 + Math.sqrt(5)) / 2;
        throw new Error(`Unknown variable or function: ${name}`);
      }
    }

    if (this.match('-')) {
      return -this.parsePrimary();
    }
    
    if (this.match('+')) {
      return this.parsePrimary();
    }

    throw new Error(`Unexpected token: ${this.peek()}`);
  }

  private callFunction(name: string, args: number[]): number {
    switch (name) {
      case 'sin': return Math.sin(this.checkArgs(name, args, 1));
      case 'cos': return Math.cos(this.checkArgs(name, args, 1));
      case 'tan': return Math.tan(this.checkArgs(name, args, 1));
      case 'tanh': return Math.tanh(this.checkArgs(name, args, 1));
      case 'tanh2': return Math.atan2(this.checkArgs(name, args, 2, 0), this.checkArgs(name, args, 2, 1));
      case 'pow': return Math.pow(this.checkArgs(name, args, 2, 0), this.checkArgs(name, args, 2, 1));
      case 'sqrt': return Math.sqrt(this.checkArgs(name, args, 1));
      case 'cbrt': return Math.cbrt(this.checkArgs(name, args, 1));
      case 'log': return Math.log(this.checkArgs(name, args, 2, 0)) / Math.log(this.checkArgs(name, args, 2, 1));
      default: throw new Error(`Unknown function: ${name}`);
    }
  }

  private parseTrigCall(name: string): number {
    const angle = this.parseExpression();
    let unit: 'rad' | 'deg' = 'rad';
    if (this.match(',')) {
      if (!this.isIdentifier()) throw new Error(`Expected angle unit for ${name}()`);
      const token = this.advance().toLowerCase();
      unit = this.parseAngleUnit(token);
    }
    if (!this.match(')')) throw new Error("Expected ')' after arguments");

    const radians = unit === 'deg' ? (angle * Math.PI) / 180 : angle;
    switch (name) {
      case 'sin': return Math.sin(radians);
      case 'cos': return Math.cos(radians);
      case 'tan': return Math.tan(radians);
      default: throw new Error(`Unknown trigonometric function: ${name}`);
    }
  }

  private isTrigFunction(name: string): boolean {
    return name === 'sin' || name === 'cos' || name === 'tan';
  }

  private parseAngleUnit(token: string): 'rad' | 'deg' {
    if (token === 'd' || token === 'deg' || token === 'degree' || token === 'degrees') return 'deg';
    if (token === 'r' || token === 'rad' || token === 'radian' || token === 'radians') return 'rad';
    throw new Error(`Unknown angle unit: ${token}`);
  }

  private checkArgs(name: string, args: number[], count: number, index: number = 0): number {
    if (args.length !== count) throw new Error(`Function '${name}' expects ${count} arguments`);
    return args[index];
  }

  // --- Helpers ---

  private peek(): string {
    return this.tokens[this.pos];
  }

  private previous(): string {
    return this.tokens[this.pos - 1];
  }

  private advance(): string {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private match(expected: string): boolean {
    if (this.check(expected)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(expected: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek() === expected;
  }

  private isNumber(): boolean {
    if (this.isAtEnd()) return false;
    return /^[0-9]+(\.[0-9]+)?$/.test(this.peek());
  }

  private isIdentifier(): boolean {
    if (this.isAtEnd()) return false;
    return /^[a-z][a-z0-9]*$/i.test(this.peek());
  }
}

new TileEditor();
