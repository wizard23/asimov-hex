// cairo-and-ambiguity.test.ts
//
// Adds two more tests:
//
// 4) A simple 4-gon constraint set that admits BOTH a convex and a concave (reflex)
//    solution. We verify the solver can find each by changing `vertexKinds`.
//    Constraints (N=4 => 2N-3=5): four side lengths + one diagonal length.
//
// 5) An impossible triangle (violates triangle inequality). Must fail.

import { describe, it, expect } from "vitest";

import type {
  PolygonConstraint,
  VertexKind,
  SimplePolygonSolveOptions,
} from "./solver-types";
import { solveSimpleNgon } from "./solver";

type PolygonData = {
  sides: number;
  sideLengths: number[]; // boundary i -> i+1
  interiorAngles: number[]; // vertex i
};

type SolverError = { message?: string; kind?: string };

function isSolverError(x: unknown): x is SolverError {
  return typeof x === "object" && x !== null && !("sides" in x);
}

function expectClose(actual: number, expected: number, eps = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

const opts: SimplePolygonSolveOptions = {
  maxIterations: 4000,
  tolerance: 1e-10,
  initialization: { kind: "regularNgon" },
  diagnostics: "basic",
  restarts: 10,
};

describe("solveSimpleNgonFromLengthsAndAngles — ambiguity + infeasible", () => {
  it("Quadrilateral: same metric constraints have a convex and a concave simple solution (selected by vertexKinds)", () => {

    const shortSide = 0.8; // approx of Math.sqrt(2)/2 + 0.1;

    const constraints: PolygonConstraint[] = [
      { type: "length", seg: { i: 0, j: 1 }, length: 1 }, // AB
      { type: "interiorAngle", i: 1, angleRad: Math.PI/2}, // angle at B
      { type: "length", seg: { i: 1, j: 2 }, length: 1 }, // BC
      { type: "length", seg: { i: 2, j: 3 }, length: shortSide }, // CD
      { type: "length", seg: { i: 3, j: 0 }, length: shortSide }, // DA
    ];

    const convexKinds: VertexKind[] = ["convex", "convex", "convex", "convex"];
    const concaveKindsAt1: VertexKind[] = [
      "convex",
      "convex",
      "convex",
      "reflex",
    ];

    // ---- (a) convex solution ----
    const r1 = solveSimpleNgon(
      4,
      convexKinds,
      constraints,
      opts
    );
    if (isSolverError(r1)) {
      throw new Error(
        `Expected convex solution, got SolverError: ${
          r1.message ?? JSON.stringify(r1)
        }`
      );
    }
    const poly1 = r1 as PolygonData;

    expect(poly1.sides).toBe(4);
    expect(poly1.sideLengths).toHaveLength(4);
    expect(poly1.interiorAngles).toHaveLength(4);

    expectClose(poly1.sideLengths[0], 1, 1e-8);
    expectClose(poly1.sideLengths[1], 1, 1e-8);
    expectClose(poly1.sideLengths[2], shortSide, 1e-8);
    expectClose(poly1.sideLengths[3], shortSide, 1e-8);

    // all angles convex (< π)
    expect(poly1.interiorAngles[0]).toBeLessThan(Math.PI);
    expect(poly1.interiorAngles[1]).toBeLessThan(Math.PI);
    expect(poly1.interiorAngles[2]).toBeLessThan(Math.PI);
    expect(poly1.interiorAngles[3]).toBeLessThan(Math.PI);

    // ---- (b) concave solution (vertex 1 reflex) ----
    const r2 = solveSimpleNgon(
      4,
      concaveKindsAt1,
      constraints,
      opts
    );
    if (isSolverError(r2)) {
      throw new Error(
        `Expected concave solution, got SolverError: ${
          r2.message ?? JSON.stringify(r2)
        }`
      );
    }
    const poly2 = r2 as PolygonData;

    expect(poly2.sides).toBe(4);
    expect(poly2.sideLengths).toHaveLength(4);
    expect(poly2.interiorAngles).toHaveLength(4);

    expectClose(poly1.sideLengths[0], 1, 1e-8);
    expectClose(poly1.sideLengths[1], 1, 1e-8);
    expectClose(poly1.sideLengths[2], shortSide, 1e-8);
    expectClose(poly1.sideLengths[3], shortSide, 1e-8);

    // vertex 3 must be reflex (> π); others should be convex (< π)
    expect(poly2.interiorAngles[0]).toBeLessThan(Math.PI);
    expect(poly2.interiorAngles[1]).toBeLessThan(Math.PI);
    expect(poly2.interiorAngles[2]).toBeLessThan(Math.PI);
    expect(poly2.interiorAngles[3]).toBeGreaterThan(Math.PI);
  });

  // this fails on purpose and therefore probably exhausts iterations and therefore takes some time
  it("5) Impossible triangle: sides (10, 1, 1) violates triangle inequality => must fail", () => {
    // N=3 => 2N-3 = 3 numeric constraints (just the 3 side lengths).
    const constraints: PolygonConstraint[] = [
      { type: "length", seg: { i: 0, j: 1 }, length: 10 },
      { type: "length", seg: { i: 1, j: 2 }, length: 1 },
      { type: "length", seg: { i: 2, j: 0 }, length: 1 },
    ];
    const kinds: VertexKind[] = ["convex", "convex", "convex"];

    const result = solveSimpleNgon(
      3,
      kinds,
      constraints,
      opts
    );

    expect(isSolverError(result)).toBe(true);
  });
});
