import { Pane } from 'tweakpane';

type Tool = 'Move' | 'Create Polygon' | 'Join';

interface EditorConfig {
  scale: number;
  numSides: number;
  sideLengthExpression: string;
  tool: Tool;
}

class TileEditor {
  private pane!: Pane;
  private config: EditorConfig = {
    scale: 100,
    numSides: 4,
    sideLengthExpression: '1',
    tool: 'Move',
  };
  private displayContainer: HTMLElement;

  constructor() {
    this.displayContainer = document.getElementById('values-display')!;
    this.initTweakpane();
    this.updateDisplay();
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
    }).on('change', () => this.updateDisplay());

    this.pane.addBinding(this.config, 'numSides', {
      min: 3,
      max: 20,
      step: 1,
      label: 'Number of Sides',
    }).on('change', () => this.updateDisplay());

    this.pane.addBinding(this.config, 'sideLengthExpression', {
      label: 'Side Length Expr',
    }).on('change', () => this.updateDisplay());

    this.pane.addBinding(this.config, 'tool', {
      options: {
        'Move': 'Move',
        'Create Polygon': 'Create Polygon',
        'Join': 'Join',
      },
      label: 'Tool',
    }).on('change', () => this.updateDisplay());
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
    `;
  }

  private evaluateExpression(expr: string): number | string {
    try {
      return new ExpressionParser(expr).evaluate();
    } catch (e) {
      return e instanceof Error ? e.message : 'Error';
    }
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
