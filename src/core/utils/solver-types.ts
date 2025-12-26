/* solver-types.ts */

export type VertexIndex = number; // integer, 0 <= i < N

// Segment between two vertices (edge or diagonal). Undirected: (i,j) == (j,i).
export type SegmentRef = {
  i: VertexIndex; // i != j
  j: VertexIndex;
};

export type LengthConstraint = {
  type: "length";
  seg: SegmentRef;
  length: number; // > 0
};

export type InteriorAngleConstraint = {
  type: "interiorAngle";
  i: VertexIndex;
  angleRad: number; // 0 < angleRad < 2π  (π allowed)
};

// |segX| = factor * |segY|
export type SegmentLengthRatioConstraint = {
  type: "segmentLengthRatio";
  segX: SegmentRef;
  segY: SegmentRef;
  factor: number; // > 0
};

// undirected angle in [0, π], 0 => parallel, π/2 => perpendicular
export type SegmentRelativeAngleConstraint = {
  type: "segmentRelativeAngle";
  segA: SegmentRef;
  segB: SegmentRef;
  angleRad: number; // 0 <= angleRad <= π
};

export type PolygonConstraint =
  | LengthConstraint
  | InteriorAngleConstraint
  | SegmentLengthRatioConstraint
  | SegmentRelativeAngleConstraint;

export type VertexKind = "convex" | "reflex" | "straight";

export type SimplePolygonSolveOptions = {
  maxIterations?: number; // default 3000
  tolerance?: number; // default 1e-10

  initialization?:
    | { kind: "regularNgon" }
    | {
        kind: "custom";
        initialVertices: { x: number; y: number }[];
      };

  simplicityEpsilon?: number; // default 1e-6

  restarts?: number; // default 0
  randomSeed?: number;

  diagnostics?: "none" | "basic" | "verbose";
};

export type PolygonData = {
  sides: number;
  sideLengths: number[]; // boundary edges i->i+1 mod N
  interiorAngles: number[]; // per vertex i in radians (may include π)
};

export type SolverError = {
  kind:
    | "InvalidInput"
    | "Infeasible"
    | "DidNotConverge"
    | "Degenerate"
    | "NotSimple"
    | "WrongOrientation";
  message: string;
  details?: Record<string, unknown>;
};
