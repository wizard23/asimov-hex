# solver-requirements.md — Convex N-gon Solver API (0-based indexing, lengths may include diagonals)

This document defines the **TypeScript solver API** for reconstructing a **labeled, strictly convex, counter-clockwise (CCW) polygon** from a mix of:

- **Length constraints** (now allowed on **any segment**, including **edges and diagonals**)
- **Interior-angle constraints** (at labeled vertices)

The internal structure of `PolygonData` and `SolverError` is intentionally **not specified**.

---

## 1. High-level behavior requirements

- The input polygon has **N vertices** labeled `0 .. N-1` in a fixed cyclic order.
- Allowed constraints are **only**:
  - **Segment lengths** (any pair of distinct vertices `i != j`, including edges and diagonals)
  - **Interior angles** (at vertex `i`)
- The number of constraints must be **exactly `2 * N - 3`** (real-valued constraints).
- At least **one length constraint** must be present (fixes scale).
- All interior angles must satisfy:

```text
0 < angle < Math.PI
```

- The solver targets **strictly convex CCW** solutions:
  - all turns are counter-clockwise
  - no collinear triples
  - no self-intersections (implied by strict convexity)

- If a unique solution exists (in the generic sense), the solver must return it.
- Otherwise, the solver must return a `SolverError`.

---

## 2. Public API types

### 2.1 VertexIndex

```ts
export type VertexIndex = number; // integer, 0 <= i < N
```

---

### 2.2 LengthConstraint (edges or diagonals)

Constrains the length of the segment between **any two distinct vertices** `i` and `j`.

```ts
export type LengthConstraint = {
  readonly type: "length";
  readonly i: VertexIndex;        // one endpoint, i != j
  readonly j: VertexIndex;        // other endpoint
  readonly length: number;        // absolute length, must be > 0
  readonly weight?: number;       // optional, default 1
};
```

Notes:
- This includes **edges** (e.g. `j === (i + 1) % N`) and **diagonals**.
- The solver must treat `(i, j)` and `(j, i)` as the same geometric segment (order does not matter).

---

### 2.3 InteriorAngleConstraint

Constrains the **interior angle** at vertex `i`.

Neighbors are implicitly:
- previous: `(i + N - 1) % N`
- next: `(i + 1) % N`

```ts
export type InteriorAngleConstraint = {
  readonly type: "interiorAngle";
  readonly i: VertexIndex;        // vertex where angle is defined
  readonly angleRad: number;      // radians, must satisfy 0 < angleRad < Math.PI
  readonly weight?: number;       // optional, default 1
};
```

---

### 2.4 Constraint union

```ts
export type PolygonConstraint =
  | LengthConstraint
  | InteriorAngleConstraint;
```

---

## 3. Solver options

All solver options are optional; defaults are solver-defined.

```ts
export type ConvexPolygonSolveOptions = {
  readonly maxIterations?: number;     // e.g. 200–2000
  readonly tolerance?: number;         // residual tolerance, e.g. 1e-10

  readonly initialization?:
    | { readonly kind: "regularNgon" }
    | {
        readonly kind: "custom";
        readonly initialVertices: readonly { x: number; y: number }[];
      };

  readonly convexityEpsilon?: number;  // minimum turn margin
  readonly convexityWeight?: number;   // penalty / barrier weight

  readonly restarts?: number;          // number of random restarts
  readonly randomSeed?: number;

  readonly diagnostics?: "none" | "basic" | "verbose";
};
```

---

## 4. Solver function

### Name

```ts
solveConvexNgonFromLengthsAndAngles
```

### Signature

```ts
export function solveConvexNgonFromLengthsAndAngles(
  vertexCount: number,                          // N, integer >= 3
  constraints: readonly PolygonConstraint[],     // exactly 2*N - 3 constraints
  options?: ConvexPolygonSolveOptions
): PolygonData | SolverError;
```

---

## 5. Required input validation

The solver **must** return `SolverError` if any of the following fail:

- `vertexCount` is not an integer `>= 3`
- `constraints.length !== 2 * vertexCount - 3`
- any `VertexIndex` is not an integer in `[0, vertexCount)`
- no constraint of type `"length"` is present
- any length `<= 0`
- any angle not strictly in `(0, Math.PI)`
- any length constraint has `i === j`
- any length constraint repeats the same segment more than once
  - treat `(i, j)` and `(j, i)` as the same segment for deduplication

Recommended (implementation choice):
- normalize all length constraints so `i < j` before deduplication.

---

## 6. Output contract

```ts
PolygonData | SolverError
```

- `PolygonData` represents the solved convex CCW polygon.
- `SolverError` represents any failure:
  - infeasible constraints
  - rank-deficient or degenerate configuration
  - numerical non-convergence
  - invalid input

---

## 7. Guarantees

If the function returns `PolygonData`, then:

- all constraints are satisfied within tolerance
- the polygon is strictly convex and CCW
- the solution is **unique up to translation and rotation**
- reflected solutions are **not admissible**
