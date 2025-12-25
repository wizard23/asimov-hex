import { EdgeInfo, Point } from "../../types";

export function distanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export function distanceToLineSegment(p: Point, v: Point, w: Point): number {
  return distanceToSegment(p, v, w);
}

export function pointsClose(p1: Point, p2: Point, epsilon: number): boolean {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
}

export function pointsCloseEuclidean(
  p1: Point,
  p2: Point,
  epsilon: number
): boolean {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= epsilon;
}

export function edgesEqual(
  a: EdgeInfo,
  b: EdgeInfo,
  epsilon: number = 0.01
): boolean {
  return (
    (pointsClose(a.points[0], b.points[0], epsilon) &&
      pointsClose(a.points[1], b.points[1], epsilon)) ||
    (pointsClose(a.points[0], b.points[1], epsilon) &&
      pointsClose(a.points[1], b.points[0], epsilon))
  );
}

export function getOtherPoint(
  edge: EdgeInfo,
  vertex: Point,
  epsilon: number = 0.01
): Point {
  return pointsClose(vertex, edge.points[0], epsilon) ? edge.points[1] : edge.points[0];
}

export function removeDuplicateEdges(
  edges: EdgeInfo[],
  epsilon: number = 0.1
): EdgeInfo[] {
  const unique: EdgeInfo[] = [];
  for (const edge of edges) {
    if (
      !unique.some(
        (u) =>
          (pointsClose(edge.points[0], u.points[0], epsilon) &&
            pointsClose(edge.points[1], u.points[1], epsilon)) ||
          (pointsClose(edge.points[0], u.points[1], epsilon) &&
            pointsClose(edge.points[1], u.points[0], epsilon))
      )
    ) {
      unique.push(edge);
    }
  }
  return unique;
}
