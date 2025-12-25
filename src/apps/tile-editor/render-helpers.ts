import { Graphics } from "pixi.js";
import { Point } from "./types";

export function drawPolygonPath(
  g: Graphics,
  points: Point[],
  offset: Point,
  color: number,
  alpha: number,
  strokeColor: number,
  strokeWidth: number
): void {
  g.clear();
  if (points.length < 2) return;
  g.moveTo(points[0].x + offset.x, points[0].y + offset.y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x + offset.x, points[i].y + offset.y);
  }
  if (alpha > 0) {
    g.fill({ color, alpha });
  }
  g.stroke({ color: strokeColor, width: strokeWidth });
}

export function drawDottedConnection(
  g: Graphics,
  start: Point,
  end: Point,
  color: number,
  width: number,
  scale: number
): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  const dashLength = Math.max(width * 2, 4 / scale);
  const gapLength = dashLength;
  const step = dashLength + gapLength;
  const ux = dx / length;
  const uy = dy / length;
  for (let dist = 0; dist < length; dist += step) {
    const segmentStart = dist;
    const segmentEnd = Math.min(dist + dashLength, length);
    g.moveTo(start.x + ux * segmentStart, start.y + uy * segmentStart);
    g.lineTo(start.x + ux * segmentEnd, start.y + uy * segmentEnd);
  }
  g.stroke({ color, width });
}

export function drawDashedPath(
  g: Graphics,
  points: Point[],
  offset: Point,
  primaryColor: number,
  secondaryColor: number,
  width: number,
  closePath: boolean,
  dashOffset: number,
  scale: number
): void {
  if (points.length < 2) return;
  const dashLength = Math.max(width * 3, 6 / scale);
  const gapLength = dashLength;
  const pattern = dashLength + gapLength;
  const offsetNorm = ((dashOffset % pattern) + pattern) % pattern;
  let drawOn = offsetNorm < dashLength;
  let remaining = drawOn ? dashLength - offsetNorm : pattern - offsetNorm;
  const pathPoints = closePath ? [...points, points[0]] : points;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const start = { x: pathPoints[i].x + offset.x, y: pathPoints[i].y + offset.y };
    const end = { x: pathPoints[i + 1].x + offset.x, y: pathPoints[i + 1].y + offset.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    let segPos = 0;
    while (segPos < segLen) {
      const step = Math.min(remaining, segLen - segPos);
      if (drawOn && step > 0) {
        const from = segPos;
        const to = segPos + step;
        g.moveTo(start.x + ux * from, start.y + uy * from);
        g.lineTo(start.x + ux * to, start.y + uy * to);
      }
      segPos += step;
      remaining -= step;
      if (remaining <= 1e-6) {
        drawOn = !drawOn;
        remaining = drawOn ? dashLength : gapLength;
      }
    }
  }
  g.stroke({ color: primaryColor, width });

  const secondaryOffset = dashOffset + dashLength;
  const secondaryNorm = ((secondaryOffset % pattern) + pattern) % pattern;
  drawOn = secondaryNorm < dashLength;
  remaining = drawOn ? dashLength - secondaryNorm : pattern - secondaryNorm;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const start = { x: pathPoints[i].x + offset.x, y: pathPoints[i].y + offset.y };
    const end = { x: pathPoints[i + 1].x + offset.x, y: pathPoints[i + 1].y + offset.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    let segPos = 0;
    while (segPos < segLen) {
      const step = Math.min(remaining, segLen - segPos);
      if (drawOn && step > 0) {
        const from = segPos;
        const to = segPos + step;
        g.moveTo(start.x + ux * from, start.y + uy * from);
        g.lineTo(start.x + ux * to, start.y + uy * to);
      }
      segPos += step;
      remaining -= step;
      if (remaining <= 1e-6) {
        drawOn = !drawOn;
        remaining = drawOn ? dashLength : gapLength;
      }
    }
  }
  g.stroke({ color: secondaryColor, width });
}

export function drawLetter(
  g: Graphics,
  letter: string,
  size: number,
  color: number,
  width: number
): void {
  const segments = getLetterSegments(letter);
  if (!segments) return;
  g.clear();
  for (const [x1, y1, x2, y2] of segments) {
    g.moveTo(x1 * size, y1 * size);
    g.lineTo(x2 * size, y2 * size);
  }
  g.stroke({ color, width });
}

export function getLetterSegments(
  letter: string
): Array<[number, number, number, number]> | null {
  const l = letter.toUpperCase();
  const segments: Record<string, Array<[number, number, number, number]>> = {
    A: [[0,1,0,0],[1,1,1,0],[0,0,1,0],[0,0.5,1,0.5]],
    B: [
      [0,0,0,1],
      [0,0,0.7,0],
      [0.7,0,0.85,0.2],
      [0.85,0.2,0.85,0.4],
      [0.85,0.4,0.7,0.5],
      [0.7,0.5,0,0.5],
      [0.7,0.5,0.85,0.6],
      [0.85,0.6,0.85,0.85],
      [0.85,0.85,0.7,1],
      [0.7,1,0,1],
    ],
    C: [[1,0,0,0],[0,0,0,1],[0,1,1,1]],
    D: [[0,0,0,1],[0,0,0.75,0],[0.75,0,1,0.2],[1,0.2,1,0.8],[1,0.8,0.75,1],[0.75,1,0,1]],
    E: [[1,0,0,0],[0,0,0,1],[0,0.5,0.8,0.5],[0,1,1,1]],
    F: [[0,0,0,1],[0,0,1,0],[0,0.5,0.8,0.5]],
    G: [[1,0,0,0],[0,0,0,1],[0,1,1,1],[1,1,1,0.6],[1,0.6,0.6,0.6]],
    H: [[0,0,0,1],[1,0,1,1],[0,0.5,1,0.5]],
    I: [[0,0,1,0],[0.5,0,0.5,1],[0,1,1,1]],
    J: [[1,0,1,1],[1,1,0,1],[0,1,0,0.7]],
    K: [[0,0,0,1],[0,0.5,1,0],[0,0.5,1,1]],
    L: [[0,0,0,1],[0,1,1,1]],
    M: [[0,1,0,0],[1,1,1,0],[0,0,0.5,0.5],[0.5,0.5,1,0]],
    N: [[0,1,0,0],[1,1,1,0],[0,0,1,1]],
    O: [[0,0,1,0],[1,0,1,1],[1,1,0,1],[0,1,0,0]],
    P: [[0,0,0,1],[0,0,1,0],[1,0,1,0.5],[1,0.5,0,0.5]],
    Q: [[0,0,1,0],[1,0,1,1],[1,1,0,1],[0,1,0,0],[0.6,0.6,1,1]],
    R: [[0,0,0,1],[0,0,1,0],[1,0,1,0.5],[1,0.5,0,0.5],[0,0.5,1,1]],
    S: [[1,0,0,0],[0,0,0,0.5],[0,0.5,1,0.5],[1,0.5,1,1],[1,1,0,1]],
    T: [[0,0,1,0],[0.5,0,0.5,1]],
    U: [[0,0,0,1],[0,1,1,1],[1,1,1,0]],
    V: [[0,0,0.5,1],[0.5,1,1,0]],
    W: [[0,0,0.25,1],[0.25,1,0.5,0.5],[0.5,0.5,0.75,1],[0.75,1,1,0]],
    X: [[0,0,1,1],[1,0,0,1]],
    Y: [[0,0,0.5,0.5],[1,0,0.5,0.5],[0.5,0.5,0.5,1]],
    Z: [[0,0,1,0],[1,0,0,1],[0,1,1,1]],
  };
  return segments[l] ?? null;
}
