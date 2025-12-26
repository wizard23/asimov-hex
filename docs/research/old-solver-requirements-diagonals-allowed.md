# solver-requirements.md — Simple CCW N-gon Solver API (0-based indexing, diagonals allowed)

This document defines the **TypeScript solver API** for reconstructing a **labeled, simple (non-self-intersecting), counter-clockwise (CCW) polygon** from a mix of:

- **Length constraints** on **any segment** between vertices (edges or diagonals)
- **Interior-angle constraints** at labeled vertices
- **Per-vertex concavity classification** (convex vs reflex) for **every** vertex

All numeric constraints are **hard constraints**.  
If they cannot be satisfied simultaneously, the solver must **fail explicitly**.

The internal structure of `PolygonData` and `SolverError` is intentionally **not specified**.

---

## 1. High-level behavior requirements

- The input polygon has **N vertices** labeled `0 .. N-1` in a fixed cyclic order.
- The polygon must be **simple** (no self-intersections) and **CCW oriented**.
- Allowed numeric constraints are **only**:
  - **Segment lengths** (any pair of distinct vertices `i != j`, including edges and diagonals)
  - **Interior angles** (at vertex `i`)
- The number of numeric constraints must be **exactly `2 * N - 3`** (real-valued constraints).
- At least **one length constraint** must be present (fixes scale).

### Per-vertex concavity classification (required input)
For **every vertex** `i`, the caller must specify whether that vertex is:
- **convex** (interior angle `< π`), or
- **reflex** (interior angle `> π`).

This classification is **discrete** (non-real-valued) input.  
Together with CCW orientation and simplicity, it restores generic uniqueness in the non-convex setting.

### Angle range requirements
All interior angles must satisfy:

```text
0 < angle < 2π   and   angle != π
```

Additionally, the concavity classification must match:
- if `vertexKinds[i] === "convex"` then `angle < π`
- if `vertexKinds[i] === "reflex"` then `angle > π`

### Uniqueness intent
- With **simplicity**, **fixed CCW orientation**, **vertexKinds for every vertex**, and **`2*N-3` independent numeric constraints** (including ≥1 length), the solver aims to return the **unique solution up to translation and rotation** (generic case).
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
  readonly angleRad: number;      // radians, 0 < angleRad < 2π, angleRad != π
};
```

---

### 2.4 VertexKind (required for all vertices)

```ts
export type VertexKind = "convex" | "reflex";
```

The caller must provide one entry per vertex:

```ts
export type VertexKinds = readonly VertexKind[]; // length must equal N
```

---

### 2.5 Constraint union

```ts
export type PolygonConstraint =
  | LengthConstraint
  | InteriorAngleConstraint;
```

---

## 3. Solver options

All solver options are optional; defaults are solver-defined.

```ts
export type SimplePolygonSolveOptions = {
  readonly maxIterations?: number;     // e.g. 200–3000
  readonly tolerance?: number;         // residual tolerance, e.g. 1e-10

  readonly initialization?:
    | { readonly kind: "regularNgon" }
    | {
        readonly kind: "custom";
        readonly initialVertices: readonly { x: number; y: number }[];
      };

  // Enforce simplicity (no self-intersections)
  readonly simplicityEpsilon?: number; // minimum separation margin for non-adjacent edges

  // Robustness
  readonly restarts?: number;          // number of random restarts
  readonly randomSeed?: number;

  // Diagnostics verbosity
  readonly diagnostics?: "none" | "basic" | "verbose";
};
```

---

## 4. Solver function

### Name

```ts
solveSimpleCcwNgonFromLengthsAndAngles
```

### Signature

```ts
export function solveSimpleCcwNgonFromLengthsAndAngles(
  vertexCount: number,                          // N, integer >= 3
  vertexKinds: VertexKinds,                     // length N, convex/reflex for every vertex
  constraints: readonly PolygonConstraint[],     // exactly 2*N - 3 numeric constraints
  options?: SimplePolygonSolveOptions
): PolygonData | SolverError;
```

---

## 5. Required input validation

The solver **must** return `SolverError` if any of the following fail:

- `vertexCount` is not an integer `>= 3`
- `vertexKinds.length !== vertexCount`
- any entry of `vertexKinds` is not `"convex"` or `"reflex"`
- `constraints.length !== 2 * vertexCount - 3`
- any `VertexIndex` is not an integer in `[0, vertexCount)`
- no constraint of type `"length"` is present
- any length `<= 0`
- any length constraint has `i === j`
- any length constraint repeats the same segment more than once
  - treat `(i, j)` and `(j, i)` as the same segment for deduplication
- any `angleRad` not strictly in `(0, 2 * Math.PI)` or equal to `Math.PI`
- any `interiorAngle` constraint conflicts with `vertexKinds[i]`
  - `vertexKinds[i] === "convex"` requires `angleRad < Math.PI`
  - `vertexKinds[i] === "reflex"` requires `angleRad > Math.PI`

Recommended (implementation choice):
- normalize all length constraints so `i < j` before deduplication.

---

## 6. Output contract

```ts
PolygonData | SolverError
```

- `PolygonData` represents the solved **simple** **CCW** polygon.
- `SolverError` represents any failure:
  - infeasible constraints
  - non-simple (self-intersecting) result
  - rank-deficient or degenerate configuration
  - numerical non-convergence
  - invalid input

---

## 7. Guarantees

If the function returns `PolygonData`, then:

- all numeric constraints are satisfied within tolerance
- the polygon is **simple** (no self-intersections)
- the polygon is **CCW oriented**
- each vertex matches `vertexKinds[i]` (convex vs reflex)
- the solution is **unique up to translation and rotation** (generic case)

Reflected solutions are **not admissible** because CCW orientation is fixed.

---
