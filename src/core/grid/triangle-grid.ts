import { Point, EdgeInfo } from "../../types";
import { distanceToLineSegment, pointsClose, removeDuplicateEdges } from "../utils/geometry";
import { Grid } from "./grid";
import { scanCellWindow } from "./grid-scan";

export class TriangleGrid implements Grid {
  private triWidth: number;

  private triHeight: number;

  constructor(private scale: number) {
    this.triWidth = scale;

    this.triHeight = (scale * Math.sqrt(3)) / 2;
  }

  pixelToCell(pixel: Point): { col: number; row: number } {
    const q = pixel.x / (this.triWidth / 2);

    const r = pixel.y / this.triHeight;

    let col = Math.floor(q);

    const row = Math.floor(r);

    const u = q - col;

    const v = r - row;

    if ((row + col) % 2 === 0) {
      if (u + v < 1) {
        col--;
      }
    } else {
      if (u < v) {
        col--;
      }
    }

    return { col, row };
  }

  cellToPixel(cell: { col: number; row: number }): Point {
    const x = cell.col * this.triWidth * 0.5;

    const y = cell.row * this.triHeight;

    return { x: x + this.triWidth / 2, y: y + this.triHeight / 2 };
  }

  getNeighbors(cell: {
    col: number;
    row: number;
  }): { col: number; row: number }[] {
    const { col, row } = cell;

    const isUpward = (row + col) % 2 === 0; // Determines if triangle is pointing up

    if (isUpward) {
      // Upward triangle neighbors: shares edges with two side triangles and one bottom triangle

      return [
        { col: col - 1, row }, // Left

        { col: col + 1, row }, // Right

        { col, row: row + 1 }, // Bottom
      ];
    } else {
      // Downward triangle neighbors: shares edges with two side triangles and one top triangle

      return [
        { col: col - 1, row }, // Left

        { col: col + 1, row }, // Right

        { col, row: row - 1 }, // Top
      ];
    }
  }

  getCellPolygon(cell: { col: number; row: number }): Point[] {
    const triangleHeight = (this.scale * Math.sqrt(3)) / 2;

    const triX = cell.col * this.scale * 0.5;

    const triY = cell.row * triangleHeight;

    const isUpward = (cell.row + cell.col) % 2 === 0;

    const centerX = triX + this.scale / 2;

    const centerY = triY + triangleHeight / 2;

    if (isUpward) {
      return [
        { x: centerX, y: centerY - triangleHeight / 2 },

        { x: centerX - this.scale / 2, y: centerY + triangleHeight / 2 },

        { x: centerX + this.scale / 2, y: centerY + triangleHeight / 2 },
      ];
    } else {
      return [
        { x: centerX - this.scale / 2, y: centerY - triangleHeight / 2 },

        { x: centerX + this.scale / 2, y: centerY - triangleHeight / 2 },

        { x: centerX, y: centerY + triangleHeight / 2 },
      ];
    }
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

    const approxRow = Math.floor(pixel.y / this.triHeight);

    const approxCol = Math.floor(pixel.x / (this.triWidth * 0.5));

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

    const approxRow = Math.floor(pixel.y / this.triHeight);

    const approxCol = Math.floor(pixel.x / (this.triWidth * 0.5));

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

    const approxRow = Math.floor(vertex.y / this.triHeight);

    const approxCol = Math.floor(vertex.x / (this.triWidth * 0.5));

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
