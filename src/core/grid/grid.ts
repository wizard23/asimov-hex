import { Point, EdgeInfo } from "../../types";

export interface Grid {
  pixelToCell(pixel: Point): { col: number; row: number } | null;
  cellToPixel(cell: { col: number; row: number }): Point;
  getNeighbors(cell: {
    col: number;
    row: number;
  }): { col: number; row: number }[];

  getCellPolygon(cell: { col: number; row: number }): Point[];
  getCellEdges(cell: { col: number; row: number }): EdgeInfo[];

  getEdgeAt(
    pixel: Point,
    threshold: number,
    gridWidth: number,
    gridHeight: number
  ): EdgeInfo | null;
  getVertexAt(
    pixel: Point,
    threshold: number,
    gridWidth: number,
    gridHeight: number
  ): Point | null;
  getEdgesAtVertex(
    vertex: Point,
    gridWidth: number,
    gridHeight: number
  ): EdgeInfo[];
}

export interface CairoGridOptions {
  scale: number;
  pentagonType: "catalan" | "type4";
}
