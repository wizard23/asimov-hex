import { Point, EdgeInfo } from "../../types";
import { distanceToLineSegment, pointsClose, removeDuplicateEdges } from "../utils/geometry";
import { Grid } from "./grid";
import { scanCellWindow } from "./grid-scan";

// pointy-top, odd-r offset coordinates
export class HexagonGrid implements Grid {
  constructor(private scale: number) {}

  private axialToOffset(axial: { q: number; r: number }): {
    col: number;
    row: number;
  } {
    const col = axial.q + (axial.r - (axial.r & 1)) / 2;
    const row = axial.r;
    return { col, row };
  }

  pixelToCell(pixel: Point): { col: number; row: number } | null {
    const tempQ =
      ((Math.sqrt(3) / 3) * pixel.x - (1 / 3) * pixel.y) / this.scale;
    const tempR = ((2 / 3) * pixel.y) / this.scale;
    const axial = this.axialRound({ q: tempQ, r: tempR, s: -tempQ - tempR });
    return this.axialToOffset(axial);
  }

  private axialRound(frac: { q: number; r: number; s: number }): {
    q: number;
    r: number;
  } {
    let q = Math.round(frac.q);
    let r = Math.round(frac.r);
    let s = Math.round(frac.s);
    const q_diff = Math.abs(q - frac.q);
    const r_diff = Math.abs(r - frac.r);
    const s_diff = Math.abs(s - frac.s);
    if (q_diff > r_diff && q_diff > s_diff) {
      q = -r - s;
    } else if (r_diff > s_diff) {
      r = -q - s;
    }
    return { q, r };
  }

  cellToPixel(cell: { col: number; row: number }): Point {
    const hexSpacingX = this.scale * Math.sqrt(3);
    const hexSpacingY = this.scale * 1.5;
    const offsetX = (cell.row % 2) * (hexSpacingX / 2);
    return { x: cell.col * hexSpacingX + offsetX, y: cell.row * hexSpacingY };
  }

  getNeighbors(cell: {
    col: number;
    row: number;
  }): { col: number; row: number }[] {
    const isOddRow = cell.row & 1;
    const neighbors: { col: number; row: number }[] = [];
    if (isOddRow) {
      neighbors.push({ col: cell.col + 1, row: cell.row });
      neighbors.push({ col: cell.col - 1, row: cell.row });
      neighbors.push({ col: cell.col, row: cell.row - 1 });
      neighbors.push({ col: cell.col + 1, row: cell.row - 1 });
      neighbors.push({ col: cell.col, row: cell.row + 1 });
      neighbors.push({ col: cell.col + 1, row: cell.row + 1 });
    } else {
      neighbors.push({ col: cell.col + 1, row: cell.row });
      neighbors.push({ col: cell.col - 1, row: cell.row });
      neighbors.push({ col: cell.col - 1, row: cell.row - 1 });
      neighbors.push({ col: cell.col, row: cell.row - 1 });
      neighbors.push({ col: cell.col - 1, row: cell.row + 1 });
      neighbors.push({ col: cell.col, row: cell.row + 1 });
    }
    return neighbors;
  }

  getCellPolygon(cell: { col: number; row: number }): Point[] {
    const center = this.cellToPixel(cell);
    const points: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      points.push({
        x: center.x + this.scale * Math.cos(angle),
        y: center.y + this.scale * Math.sin(angle),
      });
    }
    return points;
  }

  getCellEdges(cell: { col: number; row: number }): EdgeInfo[] {
    const poly = this.getCellPolygon(cell);
    return poly.map((p, i) => ({
      type: "edge",
      points: [p, poly[(i + 1) % poly.length]],
    }));
  }

  getEdgeAt(
    pixel: Point,
    threshold: number,
    gridWidth: number,
    gridHeight: number
  ): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: EdgeInfo | null = null;
    const approxRow = Math.floor(pixel.y / (this.scale * 1.5));
    const approxCol = Math.floor(pixel.x / (this.scale * Math.sqrt(3)));
    scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, 2, 2, (c, r) => {
      const edges = this.getCellEdges({ col: c, row: r });
      for (const edge of edges) {
        const dist = distanceToLineSegment(
          pixel,
          edge.points[0],
          edge.points[1]
        );
        if (dist < minDist) {
          minDist = dist;
          closestEdge = edge;
        }
      }
    });
    return closestEdge && minDist < threshold ? closestEdge : null;
  }

  getVertexAt(
    pixel: Point,
    threshold: number,
    gridWidth: number,
    gridHeight: number
  ): Point | null {
    let minDistSq = Infinity;
    let closestVertex: Point | null = null;
    const approxRow = Math.floor(pixel.y / (this.scale * 1.5));
    const approxCol = Math.floor(pixel.x / (this.scale * Math.sqrt(3)));
    scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, 2, 2, (c, r) => {
      const poly = this.getCellPolygon({ col: c, row: r });
      for (const v of poly) {
        const distSq = (pixel.x - v.x) ** 2 + (pixel.y - v.y) ** 2;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closestVertex = v;
        }
      }
    });
    return closestVertex && Math.sqrt(minDistSq) < threshold
      ? closestVertex
      : null;
  }

  getEdgesAtVertex(
    vertex: Point,
    gridWidth: number,
    gridHeight: number
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.1;
    // For simplicity, search around the vertex
    const approxRow = Math.floor(vertex.y / (this.scale * 1.5));
    const approxCol = Math.floor(vertex.x / (this.scale * Math.sqrt(3)));
    scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, 2, 2, (c, r) => {
      const cellEdges = this.getCellEdges({ col: c, row: r });
      for (const edge of cellEdges) {
        if (
          pointsClose(vertex, edge.points[0], epsilon) ||
          pointsClose(vertex, edge.points[1], epsilon)
        ) {
          edges.push(edge);
        }
      }
    });
    return removeDuplicateEdges(edges);
  }
}
