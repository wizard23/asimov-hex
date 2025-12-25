import { Point, EdgeInfo } from "../../types";
import { distanceToLineSegment, pointsClose } from "../utils/geometry";
import { removeDuplicateEdges } from "../utils/grid-utils";
import { Grid } from "./grid";

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
    let minDist = Infinity;
    let closestEdge: EdgeInfo | null = null;

    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);

    for (
      let r = Math.max(0, approxRow - 1);
      r <= Math.min(gridHeight - 1, approxRow + 1);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 1);
        c <= Math.min(gridWidth - 1, approxCol + 1);
        c++
      ) {
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
      }
    }

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

    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);

    for (
      let r = Math.max(0, approxRow - 1);
      r <= Math.min(gridHeight - 1, approxRow + 1);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 1);
        c <= Math.min(gridWidth - 1, approxCol + 1);
        c++
      ) {
        const poly = this.getCellPolygon({ col: c, row: r });
        for (const v of poly) {
          const distSq = (pixel.x - v.x) ** 2 + (pixel.y - v.y) ** 2;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            closestVertex = v;
          }
        }
      }
    }

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

    const approxCol = Math.floor(vertex.x / this.scale);
    const approxRow = Math.floor(vertex.y / this.scale);

    for (
      let r = Math.max(0, approxRow - 1);
      r <= Math.min(gridHeight - 1, approxRow + 1);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 1);
        c <= Math.min(gridWidth - 1, approxCol + 1);
        c++
      ) {
        const cellEdges = this.getCellEdges({ col: c, row: r });
        for (const edge of cellEdges) {
          if (
            pointsClose(vertex, edge.points[0], epsilon) ||
            pointsClose(vertex, edge.points[1], epsilon)
          ) {
            edges.push(edge);
          }
        }
      }
    }
    return removeDuplicateEdges(edges);
  }
}
