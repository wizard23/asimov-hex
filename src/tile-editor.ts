import { Pane } from 'tweakpane';
import { Application, Container, Graphics } from 'pixi.js';

type Tool = 'Move' | 'Create Polygon' | 'Join';

interface EditorConfig {
  scale: number;
  numSides: number;
  sideLengthExpression: string;
  edgeWidth: number;
  tool: Tool;
}

interface PolygonData {
  x: number;
  y: number;
  sides: number;
  radius: number; // calculated from side length and sides
  sideLength: number; // raw evaluated side length
  graphics: Graphics;
  isHovered: boolean;
}

class TileEditor {
  private pane!: Pane;
  private config: EditorConfig = {
    scale: 100,
    numSides: 4,
    sideLengthExpression: '1',
    edgeWidth: 2,
    tool: 'Create Polygon',
  };
  private displayContainer: HTMLElement;
  
  // Pixi
  private app!: Application;
  private polygonContainer!: Container;
  private previewGraphics!: Graphics;
  private polygons: PolygonData[] = [];
  
  // Interaction
  private draggedPolygon: PolygonData | null = null;
  private dragOffset = { x: 0, y: 0 };
  private mousePosition = { x: 0, y: 0 };
  private worldMousePosition = { x: 0, y: 0 };

  constructor() {
    this.displayContainer = document.getElementById('values-display')!;
    this.initTweakpane();
    this.initPixi();
    this.updateDisplay();
    this.setupUI();
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

    this.polygonContainer = new Container();
    this.app.stage.addChild(this.polygonContainer);

    this.previewGraphics = new Graphics();
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

    // Update loop
    this.app.ticker.add(() => {
      this.updatePreview();
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
      min: 1,
      max: 200,
      label: 'Scale',
    }).on('change', () => {
        this.updateDisplay();
        this.updateScale();
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

    this.pane.addBinding(this.config, 'tool', {
      options: {
        'Move': 'Move',
        'Create Polygon': 'Create Polygon',
        'Join': 'Join',
      },
      label: 'Tool',
    }).on('change', () => {
        this.updateDisplay();
        this.draggedPolygon = null;
        this.updateHoverState();
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
        <div class="value-label">Tool</div>
        <div class="value-content">${this.config.tool}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Side Length</div>
        <div class="value-content">${resultDisplay}</div>
      </div>
      <div class="value-row">
        <div class="value-label">Edge Width</div>
        <div class="value-content">${this.config.edgeWidth}</div>
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

      if (this.config.tool === 'Create Polygon') {
          const sideLength = this.getEvaluatedSideLength();
          if (sideLength !== null && sideLength > 0) {
              const radius = this.calculateRadius(sideLength, this.config.numSides);
              this.drawPolygonShape(
                  this.previewGraphics, 
                  this.worldMousePosition.x, 
                  this.worldMousePosition.y, 
                  this.config.numSides, 
                  radius, 
                  0x888888, 
                  0.5,
                  0xffffff,
                  this.config.edgeWidth
              );
          }
      }
  }

  private handlePointerDown(e: any) {
      if (this.config.tool === 'Create Polygon') {
          const sideLength = this.getEvaluatedSideLength();
          if (sideLength !== null && sideLength > 0) {
              const worldPos = this.globalToWorld(e.global);
              this.createPolygon(worldPos.x, worldPos.y, this.config.numSides, sideLength);
          }
      } else if (this.config.tool === 'Move') {
          const worldPos = this.globalToWorld(e.global);
          const clickedPoly = this.getPolygonAt(worldPos.x, worldPos.y);
          if (clickedPoly) {
              this.draggedPolygon = clickedPoly;
              this.dragOffset = {
                  x: clickedPoly.x - worldPos.x,
                  y: clickedPoly.y - worldPos.y
              };
          }
      }
  }

  private handlePointerMove(e: any) {
      if (this.config.tool === 'Move') {
          if (this.draggedPolygon) {
              const worldPos = this.globalToWorld(e.global);
              this.draggedPolygon.x = worldPos.x + this.dragOffset.x;
              this.draggedPolygon.y = worldPos.y + this.dragOffset.y;
              this.drawPolygonInstance(this.draggedPolygon);
          } else {
              this.updateHoverState();
          }
      }
  }

  private handlePointerUp(_e: any) {
      this.draggedPolygon = null;
  }

  private createPolygon(x: number, y: number, sides: number, sideLength: number) {
      const g = new Graphics();
      this.polygonContainer.addChild(g);
      
      const poly: PolygonData = {
          x,
          y,
          sides,
          sideLength,
          radius: 0, // Recalculated in redraw
          graphics: g,
          isHovered: false
      };
      
      this.polygons.push(poly);
      this.drawPolygonInstance(poly);
  }

  private drawPolygonInstance(poly: PolygonData) {
      poly.radius = this.calculateRadius(poly.sideLength, poly.sides);

      const color = poly.isHovered ? 0x4a9eff : 0x444444;
      const alpha = 0.8;
      
      this.drawPolygonShape(
          poly.graphics,
          poly.x,
          poly.y,
          poly.sides,
          poly.radius,
          color,
          alpha,
          0xffffff,
          this.config.edgeWidth
      );
  }

  private redrawPolygons() {
      this.polygons.forEach(p => this.drawPolygonInstance(p));
  }

  private getPolygonAt(x: number, y: number): PolygonData | null {
      // Reverse iterate to pick top-most
      for (let i = this.polygons.length - 1; i >= 0; i--) {
          const p = this.polygons[i];
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy <= p.radius * p.radius) {
              return p;
          }
      }
      return null;
  }

  private updateHoverState() {
      let hovered: PolygonData | null = null;
      if (this.config.tool === 'Move') {
          hovered = this.getPolygonAt(this.worldMousePosition.x, this.worldMousePosition.y);
      }

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

  private globalToWorld(point: { x: number; y: number }): Point {
    if (!this.polygonContainer) return { x: point.x, y: point.y };
    const local = this.polygonContainer.toLocal(point);
    return { x: local.x, y: local.y };
  }

  private updateScale() {
    if (!this.polygonContainer) return;
    this.polygonContainer.scale.set(this.config.scale);
  }

  private updateViewportCenter() {
    if (!this.app || !this.polygonContainer) return;
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;
    this.polygonContainer.position.set(centerX, centerY);
    this.polygonContainer.pivot.set(0, 0);
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
      case 'log': return Math.log(this.checkArgs(name, args, 2, 0)) / Math.log(this.checkArgs(name, args, 2, 1));
      default: throw new Error(`Unknown function: ${name}`);
    }
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
