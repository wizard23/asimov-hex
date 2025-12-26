/* solver.ts */

import type {
  PolygonConstraint,
  VertexKinds,
  SimplePolygonSolveOptions,
  PolygonData,
  SolverError,
  SegmentRef,
} from "./solver-types";

type Pt = { x: number; y: number };

function err(
  kind: SolverError["kind"],
  message: string,
  details?: Record<string, unknown>
): SolverError {
  return { kind, message, details };
}

// ---------- basic geometry ----------

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}
function cross(a: Pt, b: Pt): number {
  return a.x * b.y - a.y * b.x;
}

function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return 0.5 * a;
}

// Signed turn angle in (-π, π], using prev->cur and cur->next
function signedTurn(prev: Pt, cur: Pt, next: Pt): number {
  const e1 = sub(cur, prev);
  const e2 = sub(next, cur);
  return Math.atan2(cross(e1, e2), dot(e1, e2));
}

// Interior angle in (0, 2π): interior = π - turn (for CCW simple polygons)
function interiorAngle(prev: Pt, cur: Pt, next: Pt): number {
  const turn = signedTurn(prev, cur, next);
  const ang = Math.PI - turn;
  const twoPi = 2 * Math.PI;
  return ((ang % twoPi) + twoPi) % twoPi;
}

function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const ab2 = dot(ab, ab);
  if (ab2 === 0) return dist(p, a);
  let t = dot(ap, ab) / ab2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * ab.x, y: a.y + t * ab.y };
  return dist(p, proj);
}

function segmentsProperlyIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ad = sub(d, a);
  const cd = sub(d, c);
  const ca = sub(a, c);
  const cb = sub(b, c);

  const o1 = Math.sign(cross(ab, ac));
  const o2 = Math.sign(cross(ab, ad));
  const o3 = Math.sign(cross(cd, ca));
  const o4 = Math.sign(cross(cd, cb));

  return (
    o1 !== 0 &&
    o2 !== 0 &&
    o3 !== 0 &&
    o4 !== 0 &&
    o1 !== o2 &&
    o3 !== o4
  );
}

function segmentSegmentDistance(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segmentsProperlyIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b)
  );
}

// ---------- segment helpers (edges + diagonals) ----------

function normalizeSegment(seg: SegmentRef): SegmentRef {
  return seg.i < seg.j ? seg : { i: seg.j, j: seg.i };
}
function segmentKey(seg: SegmentRef): string {
  const s = normalizeSegment(seg);
  return `${s.i}-${s.j}`;
}
function segmentVec(pts: Pt[], seg: SegmentRef): Pt {
  return { x: pts[seg.j].x - pts[seg.i].x, y: pts[seg.j].y - pts[seg.i].y };
}
function vecLen(v: Pt): number {
  return Math.hypot(v.x, v.y);
}
// Undirected angle between vectors in [0, π]
function undirectedAngleBetween(u: Pt, v: Pt): number {
  return Math.atan2(Math.abs(cross(u, v)), dot(u, v));
}

// ---------- variable packing/unpacking (gauge fixing) ----------
//
// Fix:
//   p0 = (0,0)
//   p1.y = 0
//
// Variables x length = 2N-3:
//   x[0] = p1.x
//   then for i=2..N-1: (xi, yi)

function unpackVars(N: number, x: number[]): Pt[] {
  const pts: Pt[] = new Array(N);
  pts[0] = { x: 0, y: 0 };
  pts[1] = { x: x[0], y: 0 };
  let k = 1;
  for (let i = 2; i < N; i++) {
    pts[i] = { x: x[k], y: x[k + 1] };
    k += 2;
  }
  return pts;
}

function packVars(pts: Pt[]): number[] {
  const N = pts.length;
  const x: number[] = new Array(2 * N - 3);
  x[0] = pts[1].x;
  let k = 1;
  for (let i = 2; i < N; i++) {
    x[k] = pts[i].x;
    x[k + 1] = pts[i].y;
    k += 2;
  }
  return x;
}

function gaugeFix(pts: Pt[]): Pt[] {
  const N = pts.length;

  // translate so p0 -> origin
  const t = { x: pts[0].x, y: pts[0].y };
  const p = pts.map((q) => ({ x: q.x - t.x, y: q.y - t.y }));

  // rotate so p1 lies on +x axis
  const p1 = p[1];
  const ang = Math.atan2(p1.y, p1.x);
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  const r = p.map((q) => ({ x: c * q.x - s * q.y, y: s * q.x + c * q.y }));

  // ensure p1.x positive
  if (r[1].x < 0) {
    for (let i = 0; i < N; i++) r[i] = { x: -r[i].x, y: -r[i].y };
  }

  r[1].y = 0;
  r[0] = { x: 0, y: 0 };
  return r;
}

function regularNgonInit(N: number): Pt[] {
  const R = 1;
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    pts.push({ x: R * Math.cos(t), y: R * Math.sin(t) });
  }
  return gaugeFix(pts);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(pts: Pt[], rng: () => number, scale = 0.05): Pt[] {
  const out = pts.map((p) => ({
    x: p.x + (rng() * 2 - 1) * scale,
    y: p.y + (rng() * 2 - 1) * scale,
  }));
  return gaugeFix(out);
}

// ---------- residual building ----------

type ResidualBuild = {
  residuals: number[]; // hard + weighted penalties
  hardResiduals: number[]; // only numeric constraints
  penaltyResiduals: number[]; // only penalties before weighting
};

function buildResiduals(
  pts: Pt[],
  vertexKinds: VertexKinds,
  constraints: readonly PolygonConstraint[],
  simplicityEps: number
): ResidualBuild {
  const N = pts.length;
  const hard: number[] = [];

  // hard numeric constraints
  for (const c of constraints) {
    if (c.type === "length") {
      const seg = normalizeSegment(c.seg);
      hard.push(vecLen(segmentVec(pts, seg)) - c.length);
    } else if (c.type === "interiorAngle") {
      const i = c.i;
      const prev = pts[(i + N - 1) % N];
      const cur = pts[i];
      const next = pts[(i + 1) % N];
      hard.push(interiorAngle(prev, cur, next) - c.angleRad);
    } else if (c.type === "segmentLengthRatio") {
      const sx = normalizeSegment(c.segX);
      const sy = normalizeSegment(c.segY);
      const lx = vecLen(segmentVec(pts, sx));
      const ly = vecLen(segmentVec(pts, sy));
      hard.push(lx - c.factor * ly);
    } else {
      // segmentRelativeAngle
      const sa = normalizeSegment(c.segA);
      const sb = normalizeSegment(c.segB);
      const ua = segmentVec(pts, sa);
      const ub = segmentVec(pts, sb);
      const la = vecLen(ua);
      const lb = vecLen(ub);
      const minLen = 1e-12;
      if (la < minLen || lb < minLen) {
        hard.push(1e3);
      } else {
        hard.push(undirectedAngleBetween(ua, ub) - c.angleRad);
      }
    }
  }

  // penalties (inequalities / geometry validity)
  const pen: number[] = [];

  // CCW area margin (this solver is still "SimpleNgon" but enforces CCW)
  const area = signedArea(pts);
  const areaMin = 1e-8;
  pen.push(area < areaMin ? areaMin - area : 0);

  // vertexKinds enforcement
  const turnEps = 1e-6;
  for (let i = 0; i < N; i++) {
    const prev = pts[(i + N - 1) % N];
    const cur = pts[i];
    const next = pts[(i + 1) % N];
    const t = signedTurn(prev, cur, next);

    const kind = vertexKinds[i];
    if (kind === "convex") {
      pen.push(Math.max(0, turnEps - t));
    } else if (kind === "reflex") {
      pen.push(Math.max(0, t + turnEps));
    } else {
      // straight: |turn| <= eps
      pen.push(Math.max(0, Math.abs(t) - turnEps));
    }
  }

  // simplicity: penalize non-adjacent edge pairs that are too close/intersect
  for (let i = 0; i < N; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % N];

    for (let j = i + 1; j < N; j++) {
      const k = (j + 1) % N;

      // skip same/adjacent edges (sharing a vertex)
      if (j === i) continue;
      if (j === (i + 1) % N) continue;
      if (i === (j + 1) % N) continue;

      const c = pts[j];
      const d = pts[k];

      const dmin = segmentSegmentDistance(a, b, c, d);
      pen.push(Math.max(0, simplicityEps - dmin));
    }
  }

  const penaltyWeight = 100;
  const residuals = hard.concat(pen.map((v) => penaltyWeight * v));

  return { residuals, hardResiduals: hard, penaltyResiduals: pen };
}

// ---------- numeric linear algebra ----------

function matMulAtA(J: number[][], lambda: number): number[][] {
  const m = J.length;
  const n = J[0].length;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    const row = J[i];
    for (let a = 0; a < n; a++) {
      const ra = row[a];
      for (let b = 0; b <= a; b++) {
        A[a][b] += ra * row[b];
      }
    }
  }
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < a; b++) A[b][a] = A[a][b];
    A[a][a] += lambda;
  }
  return A;
}

function matMulAtR(J: number[][], r: number[]): number[] {
  const m = J.length;
  const n = J[0].length;
  const g = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    const row = J[i];
    const ri = r[i];
    for (let a = 0; a < n; a++) g[a] += row[a] * ri;
  }
  return g;
}

// Solve A x = b via Gaussian elimination with partial pivoting
function solveLinearSystem(Ain: number[][], bin: number[]): number[] | null {
  const n = bin.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();

  for (let i = 0; i < n; i++) {
    let piv = i;
    let best = Math.abs(A[i][i]);
    for (let r = i + 1; r < n; r++) {
      const v = Math.abs(A[r][i]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-14) return null;
    if (piv !== i) {
      [A[i], A[piv]] = [A[piv], A[i]];
      [b[i], b[piv]] = [b[piv], b[i]];
    }

    const diag = A[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / diag;
      if (f === 0) continue;
      b[r] -= f * b[i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

function dotVec(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm2(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}
function maxAbs(v: number[]): number {
  let m = 0;
  for (const x of v) m = Math.max(m, Math.abs(x));
  return m;
}

function finiteDiffJacobian(
  f: (x: number[]) => number[],
  x: number[],
  fx: number[]
): number[][] {
  const n = x.length;
  const m = fx.length;
  const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    const xj = x[j];
    const h = 1e-6 * (1 + Math.abs(xj));
    x[j] = xj + h;
    const f2 = f(x);
    x[j] = xj;

    for (let i = 0; i < m; i++) {
      J[i][j] = (f2[i] - fx[i]) / h;
    }
  }
  return J;
}

// ---------- output ----------

function buildPolygonData(pts: Pt[]): PolygonData {
  const N = pts.length;
  const sideLengths: number[] = new Array(N);
  const interiorAngles: number[] = new Array(N);

  for (let i = 0; i < N; i++) {
    sideLengths[i] = dist(pts[i], pts[(i + 1) % N]);
  }
  for (let i = 0; i < N; i++) {
    const prev = pts[(i + N - 1) % N];
    const cur = pts[i];
    const next = pts[(i + 1) % N];
    interiorAngles[i] = interiorAngle(prev, cur, next);
  }

  return { sides: N, sideLengths, interiorAngles };
}

// ---------- LM run ----------

function runLM(
  N: number,
  vertexKinds: VertexKinds,
  constraints: readonly PolygonConstraint[],
  x0: number[],
  cfg: {
    maxIterations: number;
    tol: number;
    simplicityEps: number;
    diagnostics: "none" | "basic" | "verbose";
  }
):
  | { ok: true; value: PolygonData }
  | { ok: false; attempt?: { hardMax: number; penMax: number; hardNorm: number } } {
  let x = x0.slice();
  let lambda = 1e-3;

  const f = (xx: number[]) => {
    const pts = unpackVars(N, xx);
    return buildResiduals(pts, vertexKinds, constraints, cfg.simplicityEps)
      .residuals;
  };

  let r = f(x);
  let cost = 0.5 * dotVec(r, r);

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const pts = unpackVars(N, x);
    const built = buildResiduals(pts, vertexKinds, constraints, cfg.simplicityEps);

    const hardMax = maxAbs(built.hardResiduals);
    const penMax = maxAbs(built.penaltyResiduals);
    const hardNorm = norm2(built.hardResiduals);

    if (hardMax <= cfg.tol && penMax <= 1e-9) {
      return { ok: true, value: buildPolygonData(pts) };
    }

    const J = finiteDiffJacobian(f, x, r);
    const A = matMulAtA(J, lambda);
    const g = matMulAtR(J, r);

    const dx = solveLinearSystem(A, g.map((v) => -v));
    if (!dx) return { ok: false, attempt: { hardMax, penMax, hardNorm } };

    const xNew = x.map((v, i) => v + dx[i]);
    const rNew = f(xNew);
    const costNew = 0.5 * dotVec(rNew, rNew);

    if (costNew < cost) {
      x = xNew;
      r = rNew;
      cost = costNew;
      lambda = Math.max(1e-12, lambda * 0.33);
    } else {
      lambda = Math.min(1e12, lambda * 3.0);
    }

    if (cfg.diagnostics === "verbose" && iter % 25 === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[iter ${iter}] cost=${cost.toExponential(3)} hardMax=${hardMax.toExponential(
          3
        )} penMax=${penMax.toExponential(3)} lambda=${lambda.toExponential(2)}`
      );
    }
  }

  const pts = unpackVars(N, x);
  const built = buildResiduals(pts, vertexKinds, constraints, cfg.simplicityEps);
  return {
    ok: false,
    attempt: {
      hardMax: maxAbs(built.hardResiduals),
      penMax: maxAbs(built.penaltyResiduals),
      hardNorm: norm2(built.hardResiduals),
    },
  };
}

// ---------- public solver ----------
//
// NOTE: Despite the name, this enforces CCW via a penalty. If you later want
// to allow both orientations, remove the area penalty and add an option.
export function solveSimpleNgon(
  vertexCount: number,
  vertexKinds: VertexKinds,
  constraints: readonly PolygonConstraint[],
  options?: SimplePolygonSolveOptions
): PolygonData | SolverError {
  if (!Number.isInteger(vertexCount) || vertexCount < 3) {
    return err("InvalidInput", "vertexCount must be an integer >= 3", {
      vertexCount,
    });
  }
  const N = vertexCount;

  if (vertexKinds.length !== N) {
    return err("InvalidInput", "vertexKinds must have length N", {
      expected: N,
      got: vertexKinds.length,
    });
  }
  for (let i = 0; i < N; i++) {
    const k = vertexKinds[i];
    if (k !== "convex" && k !== "reflex" && k !== "straight") {
      return err(
        "InvalidInput",
        `vertexKinds[${i}] must be "convex", "reflex", or "straight"`,
        { value: k }
      );
    }
  }

  if (constraints.length === 0) {
    return err("InvalidInput", "At least one constraint is required");
  }

  // Validate constraints
  const absoluteLengthSegs = new Set<string>();
  const ratioKeys = new Set<string>();
  const relAngleKeys = new Set<string>();
  let hasAbsoluteLength = false;

  for (let idx = 0; idx < constraints.length; idx++) {
    const c = constraints[idx];

    if (c.type === "length") {
      hasAbsoluteLength = true;

      const seg = normalizeSegment(c.seg);
      if (
        !Number.isInteger(seg.i) ||
        seg.i < 0 ||
        seg.i >= N ||
        !Number.isInteger(seg.j) ||
        seg.j < 0 ||
        seg.j >= N
      ) {
        return err("InvalidInput", `Invalid vertex index in length at ${idx}`, {
          c,
        });
      }
      if (seg.i === seg.j) {
        return err("InvalidInput", `length.seg at ${idx} has i === j`, { c });
      }
      if (!(c.length > 0) || !Number.isFinite(c.length)) {
        return err("InvalidInput", `length.length at ${idx} must be > 0`, {
          c,
        });
      }
      const key = segmentKey(seg);
      if (absoluteLengthSegs.has(key)) {
        return err("InvalidInput", `duplicate length constraint for segment ${key}`, { c });
      }
      absoluteLengthSegs.add(key);
    }

    else if (c.type === "interiorAngle") {
      const { i, angleRad } = c;
      if (!Number.isInteger(i) || i < 0 || i >= N) {
        return err("InvalidInput", `Invalid vertex index in interiorAngle at ${idx}`, { c });
      }
      if (!Number.isFinite(angleRad) || !(angleRad > 0) || !(angleRad < 2 * Math.PI)) {
        return err("InvalidInput", `interiorAngle.angleRad at ${idx} must satisfy 0 < angleRad < 2π (π allowed)`, { c });
      }

      const kind = vertexKinds[i];
      if (kind === "convex" && !(angleRad < Math.PI)) {
        return err("InvalidInput", `interiorAngle at ${idx} conflicts with vertexKinds[${i}] === "convex"`, { c });
      }
      if (kind === "reflex" && !(angleRad > Math.PI)) {
        return err("InvalidInput", `interiorAngle at ${idx} conflicts with vertexKinds[${i}] === "reflex"`, { c });
      }
      if (kind === "straight" && angleRad !== Math.PI) {
        return err("InvalidInput", `interiorAngle at ${idx} conflicts with vertexKinds[${i}] === "straight" (must be π)`, { c });
      }
    }

    else if (c.type === "segmentLengthRatio") {
      const sx = normalizeSegment(c.segX);
      const sy = normalizeSegment(c.segY);

      for (const [name, s] of [["segX", sx], ["segY", sy]] as const) {
        if (
          !Number.isInteger(s.i) ||
          s.i < 0 ||
          s.i >= N ||
          !Number.isInteger(s.j) ||
          s.j < 0 ||
          s.j >= N
        ) {
          return err("InvalidInput", `Invalid vertex index in segmentLengthRatio.${name} at ${idx}`, { c });
        }
        if (s.i === s.j) return err("InvalidInput", `segmentLengthRatio.${name} at ${idx} has i === j`, { c });
      }
      if (!Number.isFinite(c.factor) || !(c.factor > 0)) {
        return err("InvalidInput", `segmentLengthRatio.factor at ${idx} must be > 0`, { c });
      }

      const key = `${segmentKey(sx)}=${c.factor}*${segmentKey(sy)}`;
      if (ratioKeys.has(key)) return err("InvalidInput", `Duplicate segmentLengthRatio constraint`, { c });
      ratioKeys.add(key);
    }

    else {
      // segmentRelativeAngle
      const sa = normalizeSegment(c.segA);
      const sb = normalizeSegment(c.segB);

      for (const [name, s] of [["segA", sa], ["segB", sb]] as const) {
        if (
          !Number.isInteger(s.i) ||
          s.i < 0 ||
          s.i >= N ||
          !Number.isInteger(s.j) ||
          s.j < 0 ||
          s.j >= N
        ) {
          return err("InvalidInput", `Invalid vertex index in segmentRelativeAngle.${name} at ${idx}`, { c });
        }
        if (s.i === s.j) return err("InvalidInput", `segmentRelativeAngle.${name} at ${idx} has i === j`, { c });
      }
      if (!Number.isFinite(c.angleRad) || c.angleRad < 0 || c.angleRad > Math.PI) {
        return err("InvalidInput", `segmentRelativeAngle.angleRad at ${idx} must satisfy 0 <= angleRad <= π`, { c });
      }

      const key = `angle(${segmentKey(sa)},${segmentKey(sb)})=${c.angleRad}`;
      if (relAngleKeys.has(key)) return err("InvalidInput", `Duplicate segmentRelativeAngle constraint`, { c });
      relAngleKeys.add(key);
    }
  }

  // Fix global scale: need at least one absolute length.
  if (!hasAbsoluteLength) {
    return err("InvalidInput", "At least one absolute 'length' constraint is required to fix global scale");
  }

  const maxIterations = options?.maxIterations ?? 3000;
  const tol = options?.tolerance ?? 1e-10;
  const simplicityEps = options?.simplicityEpsilon ?? 1e-6;
  const restarts = options?.restarts ?? 0;
  const diag = options?.diagnostics ?? "none";

  // init
  let initPts: Pt[];
  const init = options?.initialization ?? ({ kind: "regularNgon" } as const);
  if (init.kind === "custom") {
    if (init.initialVertices.length !== N) {
      return err("InvalidInput", "custom initialization must provide N vertices", {
        expected: N,
        got: init.initialVertices.length,
      });
    }
    initPts = gaugeFix(init.initialVertices.map((p) => ({ x: p.x, y: p.y })));
  } else {
    initPts = regularNgonInit(N);
  }

  const seed = (options?.randomSeed ?? 123456789) | 0;
  const rng = mulberry32(seed);

  let best: { hardMax: number; penMax: number; hardNorm: number } | null = null;

  const trials = 1 + Math.max(0, restarts);
  for (let trial = 0; trial < trials; trial++) {
    const startPts = trial === 0 ? initPts : jitter(initPts, rng, 0.15);
    const startX = packVars(startPts);

    const res = runLM(N, vertexKinds, constraints, startX, {
      maxIterations,
      tol,
      simplicityEps,
      diagnostics: diag,
    });

    if (res.ok) return res.value;

    if (res.attempt) {
      const a = res.attempt;
      if (
        !best ||
        a.hardMax < best.hardMax ||
        (a.hardMax === best.hardMax && a.penMax < best.penMax)
      ) {
        best = a;
      }
    }
  }

  return err(
    "Infeasible",
    "Could not satisfy constraints and geometric requirements within tolerance",
    best ?? undefined
  );
}
