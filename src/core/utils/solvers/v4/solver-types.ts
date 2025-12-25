/* solver-types.ts */

export type VertexIndex = number; // integer, 0 <= i < N

// Segment between two vertices (edge or diagonal). Undirected: (i,j) == (j,i).
export type SegmentRef = {
  readonly i: VertexIndex; // i != j
  readonly j: VertexIndex;
};

export type LengthConstraint = {
  readonly type: "length";
  readonly seg: SegmentRef;
  readonly length: number; // > 0
};

export type InteriorAngleConstraint = {
  readonly type: "interiorAngle";
  readonly i: VertexIndex;
  readonly angleRad: number; // 0 < angleRad < 2π  (π allowed)
};

// |segX| = factor * |segY|
export type SegmentLengthRatioConstraint = {
  readonly type: "segmentLengthRatio";
  readonly segX: SegmentRef;
  readonly segY: SegmentRef;
  readonly factor: number; // > 0
};

// undirected angle in [0, π], 0 => parallel, π/2 => perpendicular
export type SegmentRelativeAngleConstraint = {
  readonly type: "segmentRelativeAngle";
  readonly segA: SegmentRef;
  readonly segB: SegmentRef;
  readonly angleRad: number; // 0 <= angleRad <= π
};

export type PolygonConstraint =
  | LengthConstraint
  | InteriorAngleConstraint
  | SegmentLengthRatioConstraint
  | SegmentRelativeAngleConstraint;

export type VertexKind = "convex" | "reflex" | "straight";
export type VertexKinds = readonly VertexKind[];

export type SimplePolygonSolveOptions = {
  readonly maxIterations?: number; // default 3000
  readonly tolerance?: number; // default 1e-10

  readonly initialization?:
    | { readonly kind: "regularNgon" }
    | {
        readonly kind: "custom";
        readonly initialVertices: readonly { x: number; y: number }[];
      };

  readonly simplicityEpsilon?: number; // default 1e-6

  readonly restarts?: number; // default 0
  readonly randomSeed?: number;

  readonly diagnostics?: "none" | "basic" | "verbose";
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
