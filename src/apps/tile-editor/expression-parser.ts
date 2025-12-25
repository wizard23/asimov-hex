export class ExpressionParser {
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
      throw new Error("Unexpected token at end of expression");
    }
    return result;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (this.match("+") || this.match("-")) {
      const op = this.previous();
      const right = this.parseTerm();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.match("*") || this.match("/")) {
      const op = this.previous();
      const right = this.parseFactor();
      if (op === "*") left *= right;
      else {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    return this.parsePower();
    // Power handles its own precedence usually higher than mul/div.
    // Standard precedence: ^ > * / > + -
  }

  private parsePower(): number {
    let left = this.parsePrimary();
    if (this.match("^")) {
      const right = this.parsePower(); // Right associative.
      left = Math.pow(left, right);
    }
    return left;
  }

  private parsePrimary(): number {
    if (this.match("(")) {
      const expr = this.parseExpression();
      if (!this.match(")")) throw new Error("Expected ')'");
      return expr;
    }

    if (this.isNumber()) {
      return parseFloat(this.advance());
    }

    if (this.isIdentifier()) {
      const name = this.advance().toLowerCase();
      if (this.match("(")) {
        if (this.isTrigFunction(name)) {
          return this.parseTrigCall(name);
        }

        const args: number[] = [];
        if (!this.check(")")) {
          do {
            args.push(this.parseExpression());
          } while (this.match(","));
        }
        if (!this.match(")")) throw new Error("Expected ')' after arguments");
        return this.callFunction(name, args);
      } else {
        // Constants
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;
        if (name === "phi") return (1 + Math.sqrt(5)) / 2;
        throw new Error(`Unknown variable or function: ${name}`);
      }
    }

    if (this.match("-")) {
      return -this.parsePrimary();
    }

    if (this.match("+")) {
      return this.parsePrimary();
    }

    throw new Error(`Unexpected token: ${this.peek()}`);
  }

  private callFunction(name: string, args: number[]): number {
    switch (name) {
      case "sin":
        return Math.sin(this.checkArgs(name, args, 1));
      case "cos":
        return Math.cos(this.checkArgs(name, args, 1));
      case "tan":
        return Math.tan(this.checkArgs(name, args, 1));
      case "tanh":
        return Math.tanh(this.checkArgs(name, args, 1));
      case "tanh2":
        return Math.atan2(
          this.checkArgs(name, args, 2, 0),
          this.checkArgs(name, args, 2, 1)
        );
      case "pow":
        return Math.pow(
          this.checkArgs(name, args, 2, 0),
          this.checkArgs(name, args, 2, 1)
        );
      case "sqrt":
        return Math.sqrt(this.checkArgs(name, args, 1));
      case "cbrt":
        return Math.cbrt(this.checkArgs(name, args, 1));
      case "log":
        return (
          Math.log(this.checkArgs(name, args, 2, 0)) /
          Math.log(this.checkArgs(name, args, 2, 1))
        );
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  private parseTrigCall(name: string): number {
    const angle = this.parseExpression();
    let unit: "rad" | "deg" = "rad";
    if (this.match(",")) {
      if (!this.isIdentifier()) throw new Error(`Expected angle unit for ${name}()`);
      const token = this.advance().toLowerCase();
      unit = this.parseAngleUnit(token);
    }
    if (!this.match(")")) throw new Error("Expected ')' after arguments");

    const radians = unit === "deg" ? (angle * Math.PI) / 180 : angle;
    switch (name) {
      case "sin":
        return Math.sin(radians);
      case "cos":
        return Math.cos(radians);
      case "tan":
        return Math.tan(radians);
      default:
        throw new Error(`Unknown trigonometric function: ${name}`);
    }
  }

  private isTrigFunction(name: string): boolean {
    return name === "sin" || name === "cos" || name === "tan";
  }

  private parseAngleUnit(token: string): "rad" | "deg" {
    if (token === "d" || token === "deg" || token === "degree" || token === "degrees") return "deg";
    if (token === "r" || token === "rad" || token === "radian" || token === "radians") return "rad";
    throw new Error(`Unknown angle unit: ${token}`);
  }

  private checkArgs(name: string, args: number[], count: number, index: number = 0): number {
    if (args.length !== count) throw new Error(`Function '${name}' expects ${count} arguments`);
    return args[index];
  }

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
