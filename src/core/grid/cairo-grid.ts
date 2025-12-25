import { Point, EdgeInfo } from "../../types";
import { distanceToLineSegment, pointsClose } from "../utils/geometry";
import { removeDuplicateEdges } from "../utils/grid-utils";
import { CairoGridOptions, Grid } from "./grid";

export class CairoGrid implements Grid {
  private readonly options: CairoGridOptions;
  private readonly basePoints: Point[];
  private readonly stepX: number;
  private readonly stepY: number;
  private readonly blockStep: Point;
  private readonly rowStep: Point;
  private readonly evenOffsets: Point[];
  private readonly oddOffsets: Point[];
  private readonly tileBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };

  constructor(options?: Partial<CairoGridOptions>) {
    this.options = {
      scale: 1,
      pentagonType: "catalan",
      ...(options ?? {}),
    };

    if (this.options.pentagonType === "type4") {
      throw new Error('CairoGrid pentagonType "type4" is not implemented yet.');
    }

    const scale = this.options.scale;
    const halfRoot3 = Math.sqrt(3) / 2;
    const shortHalf = (Math.sqrt(3) - 1) / 2;

    const rawPoints = [
      { x: halfRoot3 * scale, y: halfRoot3 * scale },
      { x: 0, y: (halfRoot3 + 0.5) * scale },
      { x: -halfRoot3 * scale, y: halfRoot3 * scale },
      { x: -shortHalf * scale, y: 0 },
      { x: shortHalf * scale, y: 0 },
    ];

    const centroid = rawPoints.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    centroid.x /= rawPoints.length;
    centroid.y /= rawPoints.length;

    this.basePoints = rawPoints.map((p) => ({
      x: p.x - centroid.x,
      y: p.y - centroid.y,
    }));
    const shortMid = this.getShortEdgeMidpoint(this.basePoints);
    const shortOffset = Math.abs(shortMid.y);
    const sqrt3 = Math.sqrt(3) * scale;

    this.blockStep = { x: sqrt3 * 2, y: 0 };
    this.rowStep = { x: 0, y: sqrt3 * 2 };

    this.evenOffsets = [
      { x: 0, y: 0 },
      { x: sqrt3 - shortOffset, y: -shortOffset },
      { x: (sqrt3 - shortOffset) * 2, y: 0 },
      { x: sqrt3 * 2 - shortOffset, y: sqrt3 - shortOffset },
    ];

    this.oddOffsets = [
      { x: sqrt3 - shortOffset, y: shortOffset },
      { x: sqrt3, y: sqrt3 },
      { x: sqrt3 * 2 - shortOffset, y: sqrt3 + shortOffset },
      { x: sqrt3 * 3 - shortOffset * 2, y: sqrt3 },
    ];

    this.stepX = this.blockStep.x / 4;
    this.stepY = this.rowStep.y / 2;

    this.tileBounds = this.computeTileBounds();
  }

  getGridBounds(
    cols: number,
    rows: number
  ): { width: number; height: number; minX: number; minY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const anchor = this.getAnchor({ col: c, row: r });
        minX = Math.min(minX, anchor.x + this.tileBounds.minX);
        maxX = Math.max(maxX, anchor.x + this.tileBounds.maxX);
        minY = Math.min(minY, anchor.y + this.tileBounds.minY);
        maxY = Math.max(maxY, anchor.y + this.tileBounds.maxY);
      }
    }

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
    };
  }

  pixelToCell(pixel: Point): { col: number; row: number } | null {
    const approxCol = Math.floor(pixel.x / this.stepX);
    const approxRow = Math.floor(pixel.y / this.stepY);

    for (let r = approxRow - 4; r <= approxRow + 4; r++) {
      for (let c = approxCol - 4; c <= approxCol + 4; c++) {
        const poly = this.getCellPolygon({ col: c, row: r });
        if (this.pointInPolygon(pixel, poly)) {
          return { col: c, row: r };
        }
      }
    }

    return null;
  }

  cellToPixel(cell: { col: number; row: number }): Point {
    const poly = this.getCellPolygon(cell);
    const center = poly.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: center.x / poly.length, y: center.y / poly.length };
  }

  getNeighbors(cell: {
    col: number;
    row: number;
  }): { col: number; row: number }[] {
    const offsets = this.getNeighborOffsets(cell);
    return offsets.map((offset) => ({
      col: cell.col + offset.dc,
      row: cell.row + offset.dr,
    }));
  }

  getCellPolygon(cell: { col: number; row: number }): Point[] {
    const anchor = this.getAnchor(cell);
    const rotation = this.getRotation(cell);
    const rotated = this.basePoints.map((point) =>
      this.rotatePoint(point, rotation)
    );
    return rotated.map((point) => ({
      x: point.x + anchor.x,
      y: point.y + anchor.y,
    }));
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
    const approxCol = Math.floor(pixel.x / this.stepX);
    const approxRow = Math.floor(pixel.y / this.stepY);

    for (
      let r = Math.max(0, approxRow - 4);
      r <= Math.min(gridHeight - 1, approxRow + 4);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 4);
        c <= Math.min(gridWidth - 1, approxCol + 4);
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
    const approxCol = Math.floor(pixel.x / this.stepX);
    const approxRow = Math.floor(pixel.y / this.stepY);

    for (
      let r = Math.max(0, approxRow - 4);
      r <= Math.min(gridHeight - 1, approxRow + 4);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 4);
        c <= Math.min(gridWidth - 1, approxCol + 4);
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
    const approxCol = Math.floor(vertex.x / this.stepX);
    const approxRow = Math.floor(vertex.y / this.stepY);

    for (
      let r = Math.max(0, approxRow - 4);
      r <= Math.min(gridHeight - 1, approxRow + 4);
      r++
    ) {
      for (
        let c = Math.max(0, approxCol - 4);
        c <= Math.min(gridWidth - 1, approxCol + 4);
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

  private getAnchor(cell: { col: number; row: number }): Point {
    const mod = ((cell.col % 4) + 4) % 4;
    const rowOdd = (cell.row & 1) !== 0;
    const colBlock = Math.floor(cell.col / 4);
    const rowBlock = Math.floor(cell.row / 2);
    const offsets = rowOdd ? this.oddOffsets : this.evenOffsets;
    const base = offsets[mod];
    return {
      x: base.x + colBlock * this.blockStep.x + rowBlock * this.rowStep.x,
      y: base.y + colBlock * this.blockStep.y + rowBlock * this.rowStep.y,
    };
  }

  private getOrientation(cell: {
    col: number;
    row: number;
  }): "N" | "E" | "S" | "W" {
    const mod = ((cell.col % 4) + 4) % 4;
    const rowOdd = cell.row & 1;

    if (!rowOdd) {
      switch (mod) {
        case 0:
          return "W";
        case 1:
          return "S";
        case 2:
          return "E";
        case 3:
        default:
          return "S";
      }
    }

    switch (mod) {
      case 0:
        return "N";
      case 1:
        return "W";
      case 2:
        return "N";
      case 3:
      default:
        return "E";
    }
  }

  private getNeighborOffsets(cell: {
    col: number;
    row: number;
  }): Array<{ dc: number; dr: number }> {
    const mod = ((cell.col % 4) + 4) % 4;
    const rowOdd = cell.row & 1;

    if (!rowOdd) {
      switch (mod) {
        case 0:
          return [
            { dc: -2, dr: 0 },
            { dc: -2, dr: -1 },
            { dc: 1, dr: 0 },
            { dc: 0, dr: 1 },
            { dc: -1, dr: 0 },
          ];
        case 1:
          return [
            { dc: 0, dr: -1 },
            { dc: -2, dr: -1 },
            { dc: -1, dr: 0 },
            { dc: 1, dr: 0 },
            { dc: -1, dr: 1 },
          ];
        case 2:
          return [
            { dc: -2, dr: 1 },
            { dc: -1, dr: 0 },
            { dc: 0, dr: -1 },
            { dc: 2, dr: 0 },
            { dc: 1, dr: 0 },
          ];
        case 3:
        default:
          return [
            { dc: -1, dr: 0 },
            { dc: 1, dr: 0 },
            { dc: -2, dr: 1 },
            { dc: 0, dr: 1 },
            { dc: -1, dr: 1 },
          ];
      }
    }

    switch (mod) {
      case 0:
        return [
          { dc: 2, dr: -1 },
          { dc: 0, dr: -1 },
          { dc: -1, dr: 0 },
          { dc: 1, dr: 0 },
          { dc: 1, dr: -1 },
        ];
      case 1:
        return [
          { dc: -2, dr: 0 },
          { dc: -1, dr: 0 },
          { dc: 2, dr: -1 },
          { dc: 1, dr: 0 },
          { dc: 0, dr: 1 },
        ];
      case 2:
        return [
          { dc: 1, dr: 0 },
          { dc: -1, dr: 0 },
          { dc: 0, dr: 1 },
          { dc: 2, dr: 1 },
          { dc: 1, dr: -1 },
        ];
      case 3:
      default:
        return [
          { dc: -1, dr: 0 },
          { dc: 0, dr: -1 },
          { dc: 1, dr: 0 },
          { dc: 2, dr: 0 },
          { dc: 2, dr: 1 },
        ];
    }
  }

  private getRotation(cell: { col: number; row: number }): number {
    const orientation = this.getOrientation(cell);
    switch (orientation) {
      case "N":
        return 0;
      case "E":
        return 90;
      case "W":
        return 270;
      case "S":
      default:
        return 180;
    }
  }

  private rotatePoint(point: Point, rotation: number): Point {
    switch (rotation) {
      case 0:
        return { x: point.x, y: point.y };
      case 90:
        return { x: -point.y, y: point.x };
      case 180:
        return { x: -point.x, y: -point.y };
      case 270:
        return { x: point.y, y: -point.x };
      default:
        return { x: point.x, y: point.y };
    }
  }

  private computeTileBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const rotations = [0, 90, 180, 270];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const rotation of rotations) {
      for (const point of this.basePoints) {
        const rotated = this.rotatePoint(point, rotation);
        minX = Math.min(minX, rotated.x);
        maxX = Math.max(maxX, rotated.x);
        minY = Math.min(minY, rotated.y);
        maxY = Math.max(maxY, rotated.y);
      }
    }

    return { minX, maxX, minY, maxY };
  }

  private pointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect =
        yi > point.y !== yj > point.y &&
        point.x <
          ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private getShortEdgeMidpoint(points: Point[]): Point {
    let shortIndex = 0;
    let shortLength = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (length < shortLength) {
        shortLength = length;
        shortIndex = i;
      }
    }
    const p1 = points[shortIndex];
    const p2 = points[(shortIndex + 1) % points.length];
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
}
