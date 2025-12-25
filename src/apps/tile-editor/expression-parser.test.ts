import { describe, it, expect } from "vitest";
import { ExpressionParser } from "./expression-parser";

describe("ExpressionParser", () => {
  it("evaluates basic arithmetic with precedence", () => {
    const parser = new ExpressionParser("2 + 3 * 4");
    expect(parser.evaluate()).toBe(14);
  });

  it("handles parentheses and powers", () => {
    const parser = new ExpressionParser("(2 + 3)^2");
    expect(parser.evaluate()).toBe(25);
  });

  it("supports constants", () => {
    const parser = new ExpressionParser("pi * 2");
    expect(parser.evaluate()).toBeCloseTo(Math.PI * 2, 6);
  });

  it("supports trig functions with degree unit", () => {
    const parser = new ExpressionParser("sin(90,deg)");
    expect(parser.evaluate()).toBeCloseTo(1, 6);
  });

  it("supports multi-arg functions", () => {
    const parser = new ExpressionParser("pow(2,3) + log(8,2)");
    expect(parser.evaluate()).toBe(11);
  });
});
