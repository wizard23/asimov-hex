// cairo-equilateral-pentagon.test.ts
//
// Test for solveSimpleCcwNgonFromLengthsAndAngles using the
// equilateral Cairo-tile pentagon (all sides = 1, two right angles).

import { describe, it, expect } from "vitest";

import type {
  PolygonConstraint,
  VertexKinds,
  SimplePolygonSolveOptions,
} from "./solver-types"; // adjust paths
import { solveSimpleCcwNgonFromLengthsAndAngles } from "./solver"; // adjust paths

type PolygonData = {
  sides: number;
  sideLengths: number[];
  interiorAngles: number[];
};

type SolverError = {
  message?: string;
  kind?: string;
};

function isSolverError(x: unknown): x is SolverError {
  return typeof x === "object" && x !== null && !("sides" in (x as any));
}

describe("solveSimpleCcwNgonFromLengthsAndAngles — equilateral Cairo pentagon", () => {
  it("returns a valid equilateral Cairo pentagon", () => {
    const vertexCount = 5;

    // All vertices are convex for the Cairo pentagon
    const vertexKinds: VertexKinds = [
      "convex",
      "convex",
      "convex",
      "convex",
      "convex",
    ];

    // Exactly 2N-3 = 7 numeric constraints
    const constraints: PolygonConstraint[] = [
      // five boundary edges, all length 1
      { type: "length", i: 0, j: 1, length: 1 },
      { type: "length", i: 1, j: 2, length: 1 },
      { type: "length", i: 2, j: 3, length: 1 },
      { type: "length", i: 3, j: 4, length: 1 },
      { type: "length", i: 4, j: 0, length: 1 },

      // two non-adjacent right angles (Cairo tile characteristic)
      { type: "interiorAngle", i: 0, angleRad: Math.PI / 2 },
      { type: "interiorAngle", i: 2, angleRad: Math.PI / 2 },
    ];

    const options: SimplePolygonSolveOptions = {
      maxIterations: 2000,
      tolerance: 1e-10,
      initialization: { kind: "regularNgon" },
      diagnostics: "basic",
    };

    const result = solveSimpleCcwNgonFromLengthsAndAngles(
      vertexCount,
      vertexKinds,
      constraints,
      options
    );

    if (isSolverError(result)) {
      throw new Error(
        `SolverError: ${result.message ?? JSON.stringify(result)}`
      );
    }

    const poly = result as PolygonData;

    // --- Structural checks ---
    expect(poly.sides).toBe(5);
    expect(poly.sideLengths.length).toBe(5);
    expect(poly.interiorAngles.length).toBe(5);

    // --- Side length checks ---
    const epsLen = 1e-9;
    for (const len of poly.sideLengths) {
      expect(Math.abs(len - 1)).toBeLessThan(epsLen);
    }

    // --- Angle checks ---
    const epsAng = 1e-9;

    // vertices 0 and 2 must be right angles
    expect(Math.abs(poly.interiorAngles[0] - Math.PI / 2)).toBeLessThan(epsAng);
    expect(Math.abs(poly.interiorAngles[2] - Math.PI / 2)).toBeLessThan(epsAng);

    // all angles must be convex (< π)
    for (const ang of poly.interiorAngles) {
      expect(ang).toBeGreaterThan(0);
      expect(ang).toBeLessThan(Math.PI);
    }

    // sanity: sum of interior angles of a pentagon = 3π
    const sumAngles = poly.interiorAngles.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumAngles - 3 * Math.PI)).toBeLessThan(1e-6);
  });
});
