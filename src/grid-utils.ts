import { Point, EdgeInfo } from './types';

export function distanceToLineSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(
    (p.x - (v.x + t * (w.x - v.x))) ** 2 +
      (p.y - (v.y + t * (w.y - v.y))) ** 2
  );
}

export function pointsClose(p1: Point, p2: Point, epsilon: number): boolean {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
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
