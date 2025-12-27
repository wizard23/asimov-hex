import { Graphics } from "pixi.js";
import { DRAW_CONFIG, LetterSegments } from "./draw-config";
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
  const dashLength = Math.max(width * DRAW_CONFIG.dottedDash.widthFactor, DRAW_CONFIG.dottedDash.minPx / scale);
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
  const dashLength = Math.max(width * DRAW_CONFIG.dashedDash.widthFactor, DRAW_CONFIG.dashedDash.minPx / scale);
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
      if (remaining <= DRAW_CONFIG.dashToggleEpsilon) {
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
      if (remaining <= DRAW_CONFIG.dashToggleEpsilon) {
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
  const segments: Record<string, LetterSegments> = DRAW_CONFIG.letterGlyphs;
  return segments[l] ?? null;
}
