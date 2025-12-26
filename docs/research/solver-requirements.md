# solver-requirements.md

This document describes the **current implementation** of the polygon solver and the exact input/output types it supports.

## Overview

The solver is a **numerical feasibility solver** for **simple (non-self-intersecting) polygons** with a **fixed vertex ordering and labels** (0-based indices). It attempts to find a polygon that satisfies a set of **hard geometric constraints** plus additional **geometric validity requirements**.

- **Vertex labeling is preserved**: index `i` in constraints corresponds to vertex `i` in the solution.
- The solver currently enforces **counter-clockwise (CCW)** orientation as a geometric requirement.
- The solver supports **convex, reflex (concave), and straight (180°)** vertices via `vertexKinds`.
- Constraints may be **overconstrained**. They are treated as **hard feasibility** constraints.
- If constraints are inconsistent or a valid polygon cannot be found within tolerance, the solver returns a `SolverError`.

The solver uses a Levenberg–Marquardt style least-squares minimization with finite-difference Jacobians, plus penalty terms for CCW orientation, vertex-kind inequalities, and simplicity (no intersections).

## Coordinate gauge (rigid-motion fixing)

To remove translation/rotation degrees of freedom, the solver internally uses a fixed coordinate gauge:

- `p0 = (0, 0)`
- `p1.y = 0`
- `p1.x` is constrained to be positive by the gauge transform

This eliminates rigid motions (translation + rotation). **Mirroring is not allowed** because the solver enforces CCW orientation.

## API

### Function

```ts
export function solveSimpleNgon(
  vertexCount: number,
  vertexKinds: VertexKinds,
  constraints: readonly PolygonConstraint[],
  options?: SimplePolygonSolveOptions
): PolygonData | SolverError
```

### Indexing scheme

- Vertices are indexed `0..N-1`.
- Boundary edge `k` is the segment `(k -> (k+1) mod N)`.
- A `SegmentRef` refers to any undirected segment between two vertices (edge or diagonal).

## Output type

### `PolygonData`

```ts
export type PolygonData = {
  sides: number;
  sideLengths: number[];     // boundary edge lengths: |(i)->(i+1)|
  interiorAngles: number[];  // interior angle at vertex i, radians (may include π)
};
```

Output conventions:

- `sides === vertexCount`
- `sideLengths.length === vertexCount`
- `interiorAngles.length === vertexCount`
- `sideLengths[i]` corresponds to segment `(i, (i+1) mod N)`
- `interiorAngles[i]` corresponds to the interior angle at vertex `i`

## Inputs

### `VertexKind` / `VertexKinds`

```ts
export type VertexKind = "convex" | "reflex" | "straight";
export type VertexKinds = readonly VertexKind[];
```

Meaning (for CCW polygons):

- `"convex"`: interior angle strictly **< π**
- `"reflex"`: interior angle strictly **> π**
- `"straight"`: interior angle exactly **= π** (collinear, 180°)

The solver enforces these using inequality penalties on the signed turn angle.

### `SegmentRef`

```ts
export type SegmentRef = {
  readonly i: number; // 0 <= i < N
  readonly j: number; // 0 <= j < N, i != j
};
```

Segments are treated as **undirected**: `(i,j)` is equivalent to `(j,i)`.

### Constraints (`PolygonConstraint`)

```ts
export type PolygonConstraint =
  | LengthConstraint
  | InteriorAngleConstraint
  | SegmentLengthRatioConstraint
  | SegmentRelativeAngleConstraint;
```

#### 1) `LengthConstraint`

Hard constraint on the Euclidean length of a segment (edge or diagonal).

```ts
export type LengthConstraint = {
  readonly type: "length";
  readonly seg: SegmentRef;
  readonly length: number; // > 0
};
```

Interpreted as:

- `|seg| = length`

Notes:

- At least **one** `LengthConstraint` is required to fix global scale (ratios alone do not determine scale).

#### 2) `InteriorAngleConstraint`

Hard constraint on the interior angle at a vertex.

```ts
export type InteriorAngleConstraint = {
  readonly type: "interiorAngle";
  readonly i: number;        // vertex index
  readonly angleRad: number; // 0 < angleRad < 2π (π allowed)
};
```

Interpreted as:

- `interiorAngle(i) = angleRad`

Compatibility with `vertexKinds`:

- If `vertexKinds[i] === "convex"`, then `angleRad < π` is required
- If `vertexKinds[i] === "reflex"`, then `angleRad > π` is required
- If `vertexKinds[i] === "straight"`, then `angleRad === π` is required

#### 3) `SegmentLengthRatioConstraint`

Hard constraint relating lengths of two segments.

```ts
export type SegmentLengthRatioConstraint = {
  readonly type: "segmentLengthRatio";
  readonly segX: SegmentRef;
  readonly segY: SegmentRef;
  readonly factor: number; // > 0
};
```

Interpreted as:

- `|segX| = factor * |segY|`

This can reference boundary edges or diagonals.

#### 4) `SegmentRelativeAngleConstraint`

Hard constraint on the **undirected** angle between two segments’ supporting directions.

```ts
export type SegmentRelativeAngleConstraint = {
  readonly type: "segmentRelativeAngle";
  readonly segA: SegmentRef;
  readonly segB: SegmentRef;
  readonly angleRad: number; // 0 <= angleRad <= π
};
```

Interpreted as:

- `angle_between(segA, segB) = angleRad`

Angle semantics:

- The solver uses the **undirected** angle in `[0, π]`.
- `0` means segments are **parallel** (same or opposite direction).
- `π/2` means **perpendicular**.
- `π` is also “parallel” but opposite direction (still undirected).

## Geometric validity requirements (penalties)

These are not expressed as explicit user constraints, but are enforced via penalty residuals:

### CCW orientation

The solver enforces:

- `signedArea(polygon) > 0` (with a small positive margin)

If the polygon flips orientation, it is penalized.

### Vertex-kind inequalities

Using the signed turn angle `turn(i)` at vertex `i`:

- `"convex"` requires `turn(i) > 0`
- `"reflex"` requires `turn(i) < 0`
- `"straight"` requires `turn(i) = 0`

A small tolerance band is used internally to avoid numerical chatter.

### Simplicity (no self-intersections)

The solver penalizes close approaches/intersections between **non-adjacent boundary edges**:

- For each pair of non-adjacent edges, compute the segment-segment distance
- Penalize distances below `simplicityEpsilon`

This is intended to produce **simple** polygons.

## Options (`SimplePolygonSolveOptions`)

```ts
export type SimplePolygonSolveOptions = {
  readonly maxIterations?: number;     // default 3000
  readonly tolerance?: number;         // default 1e-10

  readonly initialization?:
    | { readonly kind: "regularNgon" }
    | { readonly kind: "custom"; readonly initialVertices: readonly { x: number; y: number }[] };

  readonly simplicityEpsilon?: number; // default 1e-6

  readonly restarts?: number;          // default 0
  readonly randomSeed?: number;

  readonly diagnostics?: "none" | "basic" | "verbose";
};
```

Behavior:

- `initialization.kind = "regularNgon"`: start from a regular N-gon in the solver gauge
- `initialization.kind = "custom"`: start from provided vertices (then gauge-fixed)
- `restarts`: number of additional randomized jitters tried if the first attempt fails
- `tolerance`: maximum allowed absolute residual on **hard constraints** to accept a solution
- `simplicityEpsilon`: minimum separation enforced between non-adjacent edges

## Failure modes (`SolverError`)

```ts
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
```

Current implementation returns:

- `InvalidInput` for malformed indices, invalid ranges, or missing required absolute length constraints
- `Infeasible` when it cannot satisfy constraints + geometric requirements within tolerance (after restarts)

(Other kinds exist in the type but are not all currently produced distinctly.)

## Notes & limitations

- This is a **local** numerical solver. If constraints admit multiple feasible solutions, initialization and restarts may affect which solution is found.
- Straight vertices (180°) are supported, but they can create nearly-degenerate configurations; adjust `simplicityEpsilon` and tolerances as needed.
- The solver currently always enforces **CCW** orientation. Supporting both orientations would require making the area requirement optional.
