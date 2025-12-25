import { distanceToSegment } from "../../core/utils/geometry";
import { Point } from "./types";

export function translatePoints(points: Point[], offset: Point): Point[] {
  return points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointNearPolyline(
  point: Point,
  polyline: Point[],
  threshold: number,
  closePath: boolean
): boolean {
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (distanceToSegment(point, a, b) <= threshold) {
      return true;
    }
  }
  if (closePath && polyline.length > 1) {
    const a = polyline[polyline.length - 1];
    const b = polyline[0];
    if (distanceToSegment(point, a, b) <= threshold) {
      return true;
    }
  }
  return false;
}
