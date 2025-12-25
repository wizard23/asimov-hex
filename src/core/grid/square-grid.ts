import { Point, EdgeInfo } from "../../types";
import { pointsClose, removeDuplicateEdges } from "../utils/geometry";
import { Grid } from "./grid";
import { scanCellWindow } from "./grid-scan";
import { findClosestEdgeInWindow, findClosestVertexInWindow } from "./grid-search";

export class SquareGrid implements Grid {
  constructor(private scale: number) {}

  pixelToCell(pixel: Point): { col: number; row: number } {
    const col = Math.floor(pixel.x / this.scale);
    const row = Math.floor(pixel.y / this.scale);
    return { col, row };
  }

  cellToPixel(cell: { col: number; row: number }): Point {
    return {
      x: cell.col * this.scale + this.scale / 2,
      y: cell.row * this.scale + this.scale / 2,
    };
  }

  getNeighbors(cell: {
    col: number;
    row: number;
  }): { col: number; row: number }[] {
    const { col, row } = cell;
    return [
      { col, row: row - 1 }, // North
      { col: col + 1, row }, // East
      { col, row: row + 1 }, // South
      { col: col - 1, row }, // West
    ];
  }

  getCellPolygon(cell: { col: number; row: number }): Point[] {
    const x = cell.col * this.scale;
    const y = cell.row * this.scale;
    return [
      { x, y },
      { x: x + this.scale, y },
      { x: x + this.scale, y: y + this.scale },
      { x, y: y + this.scale },
    ];
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
    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);
    return findClosestEdgeInWindow(
      pixel,
      threshold,
      gridWidth,
      gridHeight,
      approxCol,
      approxRow,
      1,
      1,
      (cell) => this.getCellEdges(cell)
    );
  }

  getVertexAt(
    pixel: Point,
    threshold: number,
    gridWidth: number,
    gridHeight: number
  ): Point | null {
    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);
    return findClosestVertexInWindow(
      pixel,
      threshold,
      gridWidth,
      gridHeight,
      approxCol,
      approxRow,
      1,
      1,
      (cell) => this.getCellPolygon(cell)
    );
  }

  getEdgesAtVertex(
    vertex: Point,
    gridWidth: number,
    gridHeight: number
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.1;

    const approxCol = Math.floor(vertex.x / this.scale);
    const approxRow = Math.floor(vertex.y / this.scale);

    scanCellWindow(gridWidth, gridHeight, approxCol, approxRow, 1, 1, (c, r) => {
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
