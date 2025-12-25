import { EdgeInfo, Point } from "../../types";
import { distanceToLineSegment } from "../utils/geometry";
import { scanCellWindow } from "./grid-scan";

export function findClosestEdgeInWindow(
  pixel: Point,
  threshold: number,
  gridWidth: number,
  gridHeight: number,
  approxCol: number,
  approxRow: number,
  colRadius: number,
  rowRadius: number,
  getCellEdges: (cell: { col: number; row: number }) => EdgeInfo[]
): EdgeInfo | null {
  let minDist = Infinity;
  let closestEdge: EdgeInfo | null = null;

  scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, colRadius, rowRadius, (c, r) => {
    const edges = getCellEdges({ col: c, row: r });
    for (const edge of edges) {
      const dist = distanceToLineSegment(pixel, edge.points[0], edge.points[1]);
      if (dist < minDist) {
        minDist = dist;
        closestEdge = edge;
      }
    }
  });

  return closestEdge && minDist < threshold ? closestEdge : null;
}

export function findClosestVertexInWindow(
  pixel: Point,
  threshold: number,
  gridWidth: number,
  gridHeight: number,
  approxCol: number,
  approxRow: number,
  colRadius: number,
  rowRadius: number,
  getCellPolygon: (cell: { col: number; row: number }) => Point[]
): Point | null {
  let minDistSq = Infinity;
  let closestVertex: Point | null = null;

  scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, colRadius, rowRadius, (c, r) => {
    const poly = getCellPolygon({ col: c, row: r });
    for (const v of poly) {
      const distSq = (pixel.x - v.x) ** 2 + (pixel.y - v.y) ** 2;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestVertex = v;
      }
    }
  });

  return closestVertex && minDistSq < threshold ** 2 ? closestVertex : null;
}
