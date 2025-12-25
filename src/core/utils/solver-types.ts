/* solver-types.ts */

export type VertexIndex = number; // integer, 0 <= i < N

export type LengthConstraint = {
  readonly type: "length";
  readonly i: VertexIndex; // i != j
  readonly j: VertexIndex;
  readonly length: number; // > 0
};

export type InteriorAngleConstraint = {
  readonly type: "interiorAngle";
  readonly i: VertexIndex; // vertex where angle is defined
  readonly angleRad: number; // 0 < angleRad < 2π, angleRad != π
};

export type PolygonConstraint = LengthConstraint | InteriorAngleConstraint;

export type VertexKind = "convex" | "reflex";
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

  // simplicity enforcement margin
  readonly simplicityEpsilon?: number; // default 1e-6

  // robustness
  readonly restarts?: number; // default 0
  readonly randomSeed?: number;

  readonly diagnostics?: "none" | "basic" | "verbose";
};

export type PolygonData = {
  sides: number;
  sideLengths: number[]; // boundary edges i->i+1 mod N
  interiorAngles: number[]; // per vertex i in radians, in (0,2π)
};

export type SolverError = {
  kind:
    | "InvalidInput"
    | "Infeasible"
    | "DidNotConverge"
    | "Degenerate"
    | "NotSimple";
  message: string;
  details?: Record<string, unknown>;
};
