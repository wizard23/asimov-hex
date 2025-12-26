// cairo-pentagons.test.ts
//
// Three test cases for solveSimpleCcwNgonFromLengthsAndAngles using PolygonData:
//
// type PolygonData = {
//   sides: number;
//   sideLengths: number[];
//   interiorAngles: number[];
// }
//
// Summary:
//   Test 1: Minimal Cairo pentagon
//           - all sides = 1
//           - two non-adjacent right angles
//           - EXACTLY 2N-3 constraints (7)
//
//   Test 2: Fully specified Cairo pentagon
//           - angles: 90, 90, 135, 90, 135
//           - sides:  1, 1, √2/2, √2/2, 1
//           - OVERCONSTRAINED (10 numeric constraints)
//
//   Test 3: Cairo variant with one short side
//           - sides: 1, 1, 1, 1, √3−1
//           - two right angles
//           - EXACTLY 2N-3 constraints (7)

import { describe, it, expect } from "vitest";

import type {
  PolygonConstraint,
  VertexKind,
  SimplePolygonSolveOptions,
} from "./solver-types";
import { solveSimpleNgon } from "./solver";

type PolygonData = {
  sides: number;
  sideLengths: number[];
  interiorAngles: number[];
};

type SolverError = { message?: string; kind?: string };

function isSolverError(x: unknown): x is SolverError {
  return typeof x === "object" && x !== null && !("sides" in (x as any));
}

const opts: SimplePolygonSolveOptions = {
  maxIterations: 3000,
  tolerance: 1e-10,
  initialization: { kind: "regularNgon" },
  diagnostics: "basic",
  restarts: 5,
};

const allConvex: VertexKind[] = [
  "convex",
  "convex",
  "convex",
  "convex",
  "convex",
];

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function sorted(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

describe("solveSimpleCcwNgonFromLengthsAndAngles — Cairo pentagon tests", () => {
  it("1) Equilateral Cairo pentagon (minimal constraints)", () => {
    const constraints: PolygonConstraint[] = [
      // 5 edge lengths
      { type: "length", seg: { i: 0, j: 1 }, length: 1 },
      { type: "length", seg: { i: 1, j: 2 }, length: 1 },
      { type: "length", seg: { i: 2, j: 3 }, length: 1 },
      { type: "length", seg: { i: 3, j: 4 }, length: 1 },
      { type: "length", seg: { i: 4, j: 0 }, length: 1 },

      // 2 non-adjacent right angles
      { type: "interiorAngle", i: 0, angleRad: Math.PI / 2 },
      { type: "interiorAngle", i: 2, angleRad: Math.PI / 2 },
    ];

    const result = solveSimpleNgon(
      5,
      allConvex,
      constraints,
      opts
    );

    if (isSolverError(result)) {
      throw new Error(`SolverError: ${result.message}`);
    }

    const poly = result as PolygonData;

    expect(poly.sides).toBe(5);
    poly.sideLengths.forEach((l) =>
      expect(Math.abs(l - 1)).toBeLessThan(1e-9)
    );

    expect(Math.abs(sum(poly.interiorAngles) - 3 * Math.PI)).toBeLessThan(1e-6);
  });

  it("2) Fully specified Cairo pentagon (overconstrained)", () => {
    const angles = [
      Math.PI / 2,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
    ];

    const lengths = [1, 1, Math.SQRT2 / 2, Math.SQRT2 / 2, 1];

    const constraints: PolygonConstraint[] = [
      // all 5 edge lengths
      { type: "length", seg: { i: 0, j: 1 }, length: lengths[0] },
      { type: "length", seg: { i: 1, j: 2 }, length: lengths[1] },
      { type: "length", seg: { i: 2, j: 3 }, length: lengths[2] },
      { type: "length", seg: { i: 3, j: 4 }, length: lengths[3] },
      { type: "length", seg: { i: 4, j: 0 }, length: lengths[4] },

      // all 5 interior angles
      { type: "interiorAngle", i: 0, angleRad: angles[0] },
      { type: "interiorAngle", i: 1, angleRad: angles[1] },
      { type: "interiorAngle", i: 2, angleRad: angles[2] },
      { type: "interiorAngle", i: 3, angleRad: angles[3] },
      { type: "interiorAngle", i: 4, angleRad: angles[4] },
    ];

    const result = solveSimpleNgon(
      5,
      allConvex,
      constraints,
      opts
    );

    if (isSolverError(result)) {
      throw new Error(
        "SolverError (acceptable if solver forbids overconstraints)"
      );
    }

    const poly = result as PolygonData;

    expect(sorted(poly.sideLengths)).toEqual(
      sorted(lengths).map((x) => expect.closeTo(x, 1e-9))
    );

    expect(sorted(poly.interiorAngles)).toEqual(
      sorted(angles).map((x) => expect.closeTo(x, 1e-9))
    );
  });

  it("3) Cairo variant with one short side (√3−1), minimal constraints", () => {
    const short = Math.sqrt(3) - 1;

    const constraints: PolygonConstraint[] = [
      // 5 edge lengths (one is short)
      { type: "length", seg: { i: 0, j: 1 }, length: 1 },
      { type: "length", seg: { i: 1, j: 2 }, length: 1 },
      { type: "length", seg: { i: 2, j: 3 }, length: 1 },
      { type: "length", seg: { i: 3, j: 4 }, length: 1 },
      { type: "length", seg: { i: 4, j: 0 }, length: short },

      // 2 right angles
      { type: "interiorAngle", i: 0, angleRad: Math.PI / 2 },
      { type: "interiorAngle", i: 2, angleRad: Math.PI / 2 },
    ];

    const result = solveSimpleNgon(
      5,
      allConvex,
      constraints,
      opts
    );

    if (isSolverError(result)) {
      throw new Error(`SolverError: ${result.message}`);
    }

    const poly = result as PolygonData;

    const got = sorted(poly.sideLengths);
    const exp = sorted([1, 1, 1, 1, short]);

    for (let i = 0; i < 5; i++) {
      expect(Math.abs(got[i] - exp[i])).toBeLessThan(1e-9);
    }

    expect(Math.abs(sum(poly.interiorAngles) - 3 * Math.PI)).toBeLessThan(1e-6);
  });
});
