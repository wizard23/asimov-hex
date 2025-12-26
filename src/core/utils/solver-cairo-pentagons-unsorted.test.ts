// cairo-pentagons.test.ts
//
// Three test cases for solveSimpleCcwNgonFromLengthsAndAngles using PolygonData:
//
// type PolygonData = {
//   sides: number;
//   sideLengths: number[];      // boundary edges: i -> (i+1) mod N
//   interiorAngles: number[];   // per-vertex: i
// }
//
// IMPORTANT: These tests assert BY INDEX (no sorting), because the constraints
// are expressed in a labeled/indexed scheme (0-based). The solver must return
// PolygonData arrays in that same indexing scheme.

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

function expectClose(actual: number, expected: number, eps = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

const opts: SimplePolygonSolveOptions = {
  maxIterations: 3000,
  tolerance: 1e-10,
  initialization: { kind: "regularNgon" },
  diagnostics: "basic",
  restarts: 5,
};

const allConvex: VertexKind[] = ["convex", "convex", "convex", "convex", "convex"];

describe("solveSimpleCcwNgonFromLengthsAndAngles — Cairo pentagon tests (indexed)", () => {
  it("1) Equilateral Cairo pentagon (minimal constraints): all sides 1, right angles at 0 and 2", () => {
    // Exactly 2N-3 = 7 numeric constraints:
    // - 5 edge lengths = 1
    // - 2 non-adjacent right angles at vertices 0 and 2
    const constraints: PolygonConstraint[] = [
      { type: "length", seg: { i: 0, j: 1 }, length: 1 },
      { type: "length", seg: { i: 1, j: 2 }, length: 1 },
      { type: "length", seg: { i: 2, j: 3 }, length: 1 },
      { type: "length", seg: { i: 3, j: 4 }, length: 1 },
      { type: "length", seg: { i: 4, j: 0 }, length: 1 },

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
      throw new Error(`SolverError: ${result.message ?? JSON.stringify(result)}`);
    }
    const poly = result as PolygonData;

    expect(poly.sides).toBe(5);
    expect(poly.sideLengths).toHaveLength(5);
    expect(poly.interiorAngles).toHaveLength(5);

    // By-index edge lengths (i -> i+1)
    for (let i = 0; i < 5; i++) {
      expectClose(poly.sideLengths[i], 1);
    }

    // By-index angle checks (only those constrained)
    expectClose(poly.interiorAngles[0], Math.PI / 2);
    expectClose(poly.interiorAngles[2], Math.PI / 2);

    // Convexity + sum sanity
    for (const ang of poly.interiorAngles) {
      expect(ang).toBeGreaterThan(0);
      expect(ang).toBeLessThan(Math.PI);
    }
    expectClose(sum(poly.interiorAngles), 3 * Math.PI, 1e-6);
  });

  it("2) Cairo pentagon (OVERCONSTRAINED): angles 90,90,135,90,135 and sides 1,1,√2/2,√2/2,1", () => {
    const angles = [
      Math.PI / 2,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
    ];

    const lengths = [1, 1, Math.SQRT2 / 2, Math.SQRT2 / 2, 1];

    // Overconstrained: all 5 edge lengths + all 5 angles = 10 constraints.
    // Your solver should accept overconstraints as hard feasibility constraints
    // and fail only if inconsistent.
    const constraints: PolygonConstraint[] = [
      // edge lengths in order: (0-1),(1-2),(2-3),(3-4),(4-0)
      { type: "length", seg: { i: 0, j: 1 }, length: lengths[0] },
      { type: "length", seg: { i: 1, j: 2 }, length: lengths[1] },
      { type: "length", seg: { i: 2, j: 3 }, length: lengths[2] },
      { type: "length", seg: { i: 3, j: 4 }, length: lengths[3] },
      { type: "length", seg: { i: 4, j: 0 }, length: lengths[4] },

      // angles in order at vertices 0..4
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
      throw new Error(`SolverError: ${result.message ?? JSON.stringify(result)}`);
    }
    const poly = result as PolygonData;

    expect(poly.sides).toBe(5);
    expect(poly.sideLengths).toHaveLength(5);
    expect(poly.interiorAngles).toHaveLength(5);

    // By-index edge lengths
    for (let i = 0; i < 5; i++) {
      expectClose(poly.sideLengths[i], lengths[i], 1e-8);
    }

    // By-index angles
    for (let i = 0; i < 5; i++) {
      expectClose(poly.interiorAngles[i], angles[i], 1e-8);
    }

    // Sum sanity
    expectClose(sum(poly.interiorAngles), 3 * Math.PI, 1e-6);
  });

  it("3) Cairo variant (minimal constraints): one side √3−1 on edge (4->0), other sides 1; right angles at 0 and 2", () => {
    const short = Math.sqrt(3) - 1;

    // Exactly 2N-3 = 7 numeric constraints:
    // - 5 edge lengths (one short: edge 4->0)
    // - 2 non-adjacent right angles at vertices 0 and 2
    const constraints: PolygonConstraint[] = [
      { type: "length", seg: { i: 0, j: 1 }, length: 1 },
      { type: "length", seg: { i: 1, j: 2 }, length: 1 },
      { type: "length", seg: { i: 2, j: 3 }, length: 1 },
      { type: "length", seg: { i: 3, j: 4 }, length: 1 },
      { type: "length", seg: { i: 4, j: 0 }, length: short },

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
      throw new Error(`SolverError: ${result.message ?? JSON.stringify(result)}`);
    }
    const poly = result as PolygonData;

    expect(poly.sides).toBe(5);
    expect(poly.sideLengths).toHaveLength(5);
    expect(poly.interiorAngles).toHaveLength(5);

    // By-index edge lengths
    expectClose(poly.sideLengths[0], 1, 1e-8);     // 0->1
    expectClose(poly.sideLengths[1], 1, 1e-8);     // 1->2
    expectClose(poly.sideLengths[2], 1, 1e-8);     // 2->3
    expectClose(poly.sideLengths[3], 1, 1e-8);     // 3->4
    expectClose(poly.sideLengths[4], short, 1e-8); // 4->0

    // Constrained angles
    expectClose(poly.interiorAngles[0], Math.PI / 2, 1e-8);
    expectClose(poly.interiorAngles[2], Math.PI / 2, 1e-8);

    // Sum sanity
    expectClose(sum(poly.interiorAngles), 3 * Math.PI, 1e-6);
  });
});
