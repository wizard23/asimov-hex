import { Point, EdgeInfo } from './types';

export interface Grid {
  pixelToCell(pixel: Point): { col: number, row: number } | null;
  cellToPixel(cell: { col: number, row: number }): Point;
  getNeighbors(cell: { col: number, row: number }): { col: number, row: number }[];
  
  getCellPolygon(cell: { col: number, row: number }): Point[];
  getCellEdges(cell: { col: number, row: number }): EdgeInfo[];
  
  getEdgeAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): EdgeInfo | null;
  getVertexAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): Point | null;
  getEdgesAtVertex(vertex: Point, gridWidth: number, gridHeight: number): EdgeInfo[];
}

export interface CairoGridOptions {
  scale: number;
  pentagonType: 'catalan' | 'type4';
}

export class SquareGrid implements Grid {
  constructor(private scale: number) {}

  pixelToCell(pixel: Point): { col: number, row: number } {
    const col = Math.floor(pixel.x / this.scale);
    const row = Math.floor(pixel.y / this.scale);
    return { col, row };
  }

  cellToPixel(cell: { col: number, row: number }): Point {
    return { 
      x: cell.col * this.scale + this.scale / 2,
      y: cell.row * this.scale + this.scale / 2 
    };
  }

  getNeighbors(cell: { col: number, row: number }): { col: number, row: number }[] {
    const { col, row } = cell;
    return [
      { col, row: row - 1 },     // North
      { col: col + 1, row },     // East
      { col, row: row + 1 },     // South
      { col: col - 1, row },     // West
    ];
  }

  getCellPolygon(cell: { col: number, row: number }): Point[] {
    const x = cell.col * this.scale;
    const y = cell.row * this.scale;
    return [
      { x, y },
      { x: x + this.scale, y },
      { x: x + this.scale, y: y + this.scale },
      { x, y: y + this.scale }
    ];
  }

  getCellEdges(cell: { col: number, row: number }): EdgeInfo[] {
    const poly = this.getCellPolygon(cell);
    return poly.map((p, i) => ({
      type: 'edge',
      points: [p, poly[(i + 1) % poly.length]]
    }));
  }

  getEdgeAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: EdgeInfo | null = null;

    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);

    for (let r = Math.max(0, approxRow - 1); r <= Math.min(gridHeight - 1, approxRow + 1); r++) {
      for (let c = Math.max(0, approxCol - 1); c <= Math.min(gridWidth - 1, approxCol + 1); c++) {
        const edges = this.getCellEdges({ col: c, row: r });
        for (const edge of edges) {
          const dist = this.distanceToLineSegment(pixel, edge.points[0], edge.points[1]);
          if (dist < minDist) {
            minDist = dist;
            closestEdge = edge;
          }
        }
      }
    }

    return (closestEdge && minDist < threshold) ? closestEdge : null;
  }

  getVertexAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): Point | null {
    let minDistSq = Infinity;
    let closestVertex: Point | null = null;

    const approxCol = Math.floor(pixel.x / this.scale);
    const approxRow = Math.floor(pixel.y / this.scale);

    for (let r = Math.max(0, approxRow - 1); r <= Math.min(gridHeight - 1, approxRow + 1); r++) {
      for (let c = Math.max(0, approxCol - 1); c <= Math.min(gridWidth - 1, approxCol + 1); c++) {
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

    return (closestVertex && Math.sqrt(minDistSq) < threshold) ? closestVertex : null;
  }

  getEdgesAtVertex(vertex: Point, gridWidth: number, gridHeight: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.1;

    const approxCol = Math.floor(vertex.x / this.scale);
    const approxRow = Math.floor(vertex.y / this.scale);

    for (let r = Math.max(0, approxRow - 1); r <= Math.min(gridHeight - 1, approxRow + 1); r++) {
      for (let c = Math.max(0, approxCol - 1); c <= Math.min(gridWidth - 1, approxCol + 1); c++) {
        const cellEdges = this.getCellEdges({ col: c, row: r });
        for (const edge of cellEdges) {
          if (this.pointsEqual(vertex, edge.points[0], epsilon) || this.pointsEqual(vertex, edge.points[1], epsilon)) {
            edges.push(edge);
          }
        }
      }
    }
    return this.removeDuplicateEdges(edges);
  }

  private distanceToLineSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  }

  private pointsEqual(p1: Point, p2: Point, epsilon: number): boolean {
    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
  }

  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const unique: EdgeInfo[] = [];
    const epsilon = 0.1;
    for (const edge of edges) {
      if (!unique.some(u => 
        (this.pointsEqual(edge.points[0], u.points[0], epsilon) && this.pointsEqual(edge.points[1], u.points[1], epsilon)) ||
        (this.pointsEqual(edge.points[0], u.points[1], epsilon) && this.pointsEqual(edge.points[1], u.points[0], epsilon))
      )) {
        unique.push(edge);
      }
    }
    return unique;
  }
}

// pointy-top, odd-r offset coordinates
export class HexagonGrid implements Grid {
  constructor(private scale: number) {}

  private axialToOffset(axial: { q: number, r: number }): { col: number, row: number } {
    const col = axial.q + (axial.r - (axial.r & 1)) / 2;
    const row = axial.r;
    return { col, row };
  }

  pixelToCell(pixel: Point): { col: number, row: number } | null {
    const tempQ = (Math.sqrt(3)/3 * pixel.x - 1/3 * pixel.y) / this.scale;
    const tempR = (2/3 * pixel.y) / this.scale;
    const axial = this.axialRound({ q: tempQ, r: tempR, s: -tempQ-tempR });
    return this.axialToOffset(axial);
  }

  private axialRound(frac: {q: number, r: number, s: number}): {q: number, r: number} {
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

  cellToPixel(cell: { col: number, row: number }): Point {
    const hexSpacingX = this.scale * Math.sqrt(3);
    const hexSpacingY = this.scale * 1.5;
    const offsetX = (cell.row % 2) * (hexSpacingX / 2);
    return { x: cell.col * hexSpacingX + offsetX, y: cell.row * hexSpacingY };
  }

  getNeighbors(cell: { col: number, row: number }): { col: number, row: number }[] {
    const isOddRow = cell.row & 1;
    const neighbors: {col: number, row: number}[] = [];
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

  getCellPolygon(cell: { col: number, row: number }): Point[] {
    const center = this.cellToPixel(cell);
    const points: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      points.push({
        x: center.x + this.scale * Math.cos(angle),
        y: center.y + this.scale * Math.sin(angle)
      });
    }
    return points;
  }

  getCellEdges(cell: { col: number, row: number }): EdgeInfo[] {
    const poly = this.getCellPolygon(cell);
    return poly.map((p, i) => ({
      type: 'edge',
      points: [p, poly[(i + 1) % poly.length]]
    }));
  }

  getEdgeAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: EdgeInfo | null = null;
    const approxRow = Math.floor(pixel.y / (this.scale * 1.5));
    const approxCol = Math.floor(pixel.x / (this.scale * Math.sqrt(3)));
    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {
      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {
        const edges = this.getCellEdges({ col: c, row: r });
        for (const edge of edges) {
          const dist = this.distanceToLineSegment(pixel, edge.points[0], edge.points[1]);
          if (dist < minDist) {
            minDist = dist;
            closestEdge = edge;
          }
        }
      }
    }
    return (closestEdge && minDist < threshold) ? closestEdge : null;
  }

  getVertexAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): Point | null {
    let minDistSq = Infinity;
    let closestVertex: Point | null = null;
    const approxRow = Math.floor(pixel.y / (this.scale * 1.5));
    const approxCol = Math.floor(pixel.x / (this.scale * Math.sqrt(3)));
    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {
      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {
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
    return (closestVertex && Math.sqrt(minDistSq) < threshold) ? closestVertex : null;
  }

  getEdgesAtVertex(vertex: Point, gridWidth: number, gridHeight: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.1;
    // For simplicity, search around the vertex
    const approxRow = Math.floor(vertex.y / (this.scale * 1.5));
    const approxCol = Math.floor(vertex.x / (this.scale * Math.sqrt(3)));
    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {
      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {
        const cellEdges = this.getCellEdges({ col: c, row: r });
        for (const edge of cellEdges) {
          if (this.pointsEqual(vertex, edge.points[0], epsilon) || this.pointsEqual(vertex, edge.points[1], epsilon)) {
            edges.push(edge);
          }
        }
      }
    }
    return this.removeDuplicateEdges(edges);
  }

  private distanceToLineSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  }

  private pointsEqual(p1: Point, p2: Point, epsilon: number): boolean {
    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
  }

  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const unique: EdgeInfo[] = [];
    const epsilon = 0.1;
    for (const edge of edges) {
      if (!unique.some(u => 
        (this.pointsEqual(edge.points[0], u.points[0], epsilon) && this.pointsEqual(edge.points[1], u.points[1], epsilon)) ||
        (this.pointsEqual(edge.points[0], u.points[1], epsilon) && this.pointsEqual(edge.points[1], u.points[0], epsilon))
      )) {
        unique.push(edge);
      }
    }
    return unique;
  }
}

export class TriangleGrid implements Grid {

  private triWidth: number;

  private triHeight: number;



  constructor(private scale: number) {

    this.triWidth = scale;

    this.triHeight = scale * Math.sqrt(3) / 2;

  }



  pixelToCell(pixel: Point): { col: number; row: number; } {

    const row = Math.floor(pixel.y / this.triHeight);

    const col = Math.floor(pixel.x / (this.triWidth / 2));

    return { col, row };

  }

  

  cellToPixel(cell: { col: number; row: number; }): Point {

    const x = cell.col * this.triWidth * 0.5;

    const y = cell.row * this.triHeight;

    return { x: x + this.triWidth / 2, y: y + this.triHeight / 2 };

  }



  getNeighbors(cell: { col: number; row: number; }): { col: number; row: number; }[] {

    const { col, row } = cell;

    const isUpward = (row + col) % 2 === 0; // Determines if triangle is pointing up

    if (isUpward) {

      // Upward triangle neighbors: shares edges with two side triangles and one bottom triangle

      return [

        { col: col - 1, row },     // Left

        { col: col + 1, row },     // Right

        { col, row: row + 1 },     // Bottom

      ];

    } else {

      // Downward triangle neighbors: shares edges with two side triangles and one top triangle

      return [

        { col: col - 1, row },     // Left

        { col: col + 1, row },     // Right

        { col, row: row - 1 },     // Top

      ];

    }

  }



  getCellPolygon(cell: { col: number, row: number }): Point[] {

    const triangleHeight = this.scale * Math.sqrt(3) / 2;

    const triX = cell.col * this.scale * 0.5;

    const triY = cell.row * triangleHeight;

    const isUpward = (cell.row + cell.col) % 2 === 0;

    const centerX = triX + this.scale / 2;

    const centerY = triY + triangleHeight / 2;

    

    if (isUpward) {

      return [

        { x: centerX, y: centerY - triangleHeight / 2 },

        { x: centerX - this.scale / 2, y: centerY + triangleHeight / 2 },

        { x: centerX + this.scale / 2, y: centerY + triangleHeight / 2 }

      ];

    } else {

      return [

        { x: centerX - this.scale / 2, y: centerY - triangleHeight / 2 },

        { x: centerX + this.scale / 2, y: centerY - triangleHeight / 2 },

        { x: centerX, y: centerY + triangleHeight / 2 }

      ];

    }

  }



  getCellEdges(cell: { col: number, row: number }): EdgeInfo[] {

    const poly = this.getCellPolygon(cell);

    return poly.map((p, i) => ({

      type: 'edge',

      points: [p, poly[(i + 1) % poly.length]]

    }));

  }



  getEdgeAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): EdgeInfo | null {

    let minDist = Infinity;

    let closestEdge: EdgeInfo | null = null;

    const approxRow = Math.floor(pixel.y / this.triHeight);

    const approxCol = Math.floor(pixel.x / (this.triWidth * 0.5));

    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {

      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {

        const edges = this.getCellEdges({ col: c, row: r });

        for (const edge of edges) {

          const dist = this.distanceToLineSegment(pixel, edge.points[0], edge.points[1]);

          if (dist < minDist) {

            minDist = dist;

            closestEdge = edge;

          }

        }

      }

    }

    return (closestEdge && minDist < threshold) ? closestEdge : null;

  }



  getVertexAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): Point | null {

    let minDistSq = Infinity;

    let closestVertex: Point | null = null;

    const approxRow = Math.floor(pixel.y / this.triHeight);

    const approxCol = Math.floor(pixel.x / (this.triWidth * 0.5));

    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {

      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {

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

    return (closestVertex && Math.sqrt(minDistSq) < threshold) ? closestVertex : null;

  }



  getEdgesAtVertex(vertex: Point, gridWidth: number, gridHeight: number): EdgeInfo[] {

    const edges: EdgeInfo[] = [];

    const epsilon = 0.1;

    const approxRow = Math.floor(vertex.y / this.triHeight);

    const approxCol = Math.floor(vertex.x / (this.triWidth * 0.5));

    for (let r = Math.max(0, approxRow - 2); r < Math.min(gridHeight, approxRow + 3); r++) {

      for (let c = Math.max(0, approxCol - 2); c < Math.min(gridWidth, approxCol + 3); c++) {

        const cellEdges = this.getCellEdges({ col: c, row: r });

        for (const edge of cellEdges) {

          if (this.pointsEqual(vertex, edge.points[0], epsilon) || this.pointsEqual(vertex, edge.points[1], epsilon)) {

            edges.push(edge);

          }

        }

      }

    }

    return this.removeDuplicateEdges(edges);

  }



  private distanceToLineSegment(p: Point, v: Point, w: Point): number {

    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;

    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);

    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;

    t = Math.max(0, Math.min(1, t));

    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);

  }



  private pointsEqual(p1: Point, p2: Point, epsilon: number): boolean {

    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;

  }



  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {

    const unique: EdgeInfo[] = [];

    const epsilon = 0.1;

    for (const edge of edges) {

      if (!unique.some(u => 

        (this.pointsEqual(edge.points[0], u.points[0], epsilon) && this.pointsEqual(edge.points[1], u.points[1], epsilon)) ||

        (this.pointsEqual(edge.points[0], u.points[1], epsilon) && this.pointsEqual(edge.points[1], u.points[0], epsilon))

      )) {

        unique.push(edge);

      }

    }

    return unique;

  }

}

export class CairoGrid implements Grid {
  private readonly options: CairoGridOptions;
  private readonly basePoints: Point[];
  private readonly stepX: number;
  private readonly stepY: number;
  private readonly rowOffsetX: number;
  private readonly tileBounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(options?: Partial<CairoGridOptions>) {
    this.options = {
      scale: 1,
      pentagonType: 'catalan',
      ...(options ?? {})
    };

    if (this.options.pentagonType === 'type4') {
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

    const centroid = rawPoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    centroid.x /= rawPoints.length;
    centroid.y /= rawPoints.length;

    this.basePoints = rawPoints.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y }));
    const shortMid = this.getShortEdgeMidpoint(this.basePoints);
    this.stepX = Math.abs(shortMid.y);
    this.stepY = this.stepX * 2;
    this.rowOffsetX = this.stepX;

    this.tileBounds = this.computeTileBounds();
  }

  getGridBounds(cols: number, rows: number): { width: number; height: number; minX: number; minY: number } {
    const spanX = Math.max(0, cols - 1) * this.stepX;
    const spanY = Math.max(0, rows - 1) * this.stepY;
    const minX = this.tileBounds.minX;
    const minY = this.tileBounds.minY;
    const maxX = spanX + this.tileBounds.maxX;
    const maxY = spanY + this.tileBounds.maxY;

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

    for (let r = approxRow - 2; r <= approxRow + 2; r++) {
      for (let c = approxCol - 2; c <= approxCol + 2; c++) {
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
    const center = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: center.x / poly.length, y: center.y / poly.length };
  }

  getNeighbors(cell: { col: number; row: number }): { col: number; row: number }[] {
    const offsets = this.getNeighborOffsets(cell);
    return offsets.map(offset => ({
      col: cell.col + offset.dc,
      row: cell.row + offset.dr,
    }));
  }

  getCellPolygon(cell: { col: number; row: number }): Point[] {
    const anchor = this.getAnchor(cell);
    const rotation = this.getRotation(cell);
    const rotated = this.basePoints.map(point => this.rotatePoint(point, rotation));
    return rotated.map(point => ({ x: point.x + anchor.x, y: point.y + anchor.y }));
  }

  getCellEdges(cell: { col: number; row: number }): EdgeInfo[] {
    const poly = this.getCellPolygon(cell);
    return poly.map((p, i) => ({
      type: 'edge',
      points: [p, poly[(i + 1) % poly.length]],
    }));
  }

  getEdgeAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: EdgeInfo | null = null;
    const approxCol = Math.floor(pixel.x / this.stepX);
    const approxRow = Math.floor(pixel.y / this.stepY);

    for (let r = Math.max(0, approxRow - 2); r <= Math.min(gridHeight - 1, approxRow + 2); r++) {
      for (let c = Math.max(0, approxCol - 2); c <= Math.min(gridWidth - 1, approxCol + 2); c++) {
        const edges = this.getCellEdges({ col: c, row: r });
        for (const edge of edges) {
          const dist = this.distanceToLineSegment(pixel, edge.points[0], edge.points[1]);
          if (dist < minDist) {
            minDist = dist;
            closestEdge = edge;
          }
        }
      }
    }

    return closestEdge && minDist < threshold ? closestEdge : null;
  }

  getVertexAt(pixel: Point, threshold: number, gridWidth: number, gridHeight: number): Point | null {
    let minDistSq = Infinity;
    let closestVertex: Point | null = null;
    const approxCol = Math.floor(pixel.x / this.stepX);
    const approxRow = Math.floor(pixel.y / this.stepY);

    for (let r = Math.max(0, approxRow - 2); r <= Math.min(gridHeight - 1, approxRow + 2); r++) {
      for (let c = Math.max(0, approxCol - 2); c <= Math.min(gridWidth - 1, approxCol + 2); c++) {
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

    return closestVertex && Math.sqrt(minDistSq) < threshold ? closestVertex : null;
  }

  getEdgesAtVertex(vertex: Point, gridWidth: number, gridHeight: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.1;
    const approxCol = Math.floor(vertex.x / this.stepX);
    const approxRow = Math.floor(vertex.y / this.stepY);

    for (let r = Math.max(0, approxRow - 2); r <= Math.min(gridHeight - 1, approxRow + 2); r++) {
      for (let c = Math.max(0, approxCol - 2); c <= Math.min(gridWidth - 1, approxCol + 2); c++) {
        const cellEdges = this.getCellEdges({ col: c, row: r });
        for (const edge of cellEdges) {
          if (this.pointsEqual(vertex, edge.points[0], epsilon) || this.pointsEqual(vertex, edge.points[1], epsilon)) {
            edges.push(edge);
          }
        }
      }
    }

    return this.removeDuplicateEdges(edges);
  }

  private getAnchor(cell: { col: number; row: number }): Point {
    const offsetX = (cell.row & 1) ? this.rowOffsetX : 0;
    return { x: cell.col * this.stepX + offsetX, y: cell.row * this.stepY };
  }

  private getOrientation(cell: { col: number; row: number }): 'N' | 'E' | 'S' | 'W' {
    const mod = ((cell.col % 4) + 4) % 4;
    const rowOdd = cell.row & 1;

    if (!rowOdd) {
      switch (mod) {
        case 0:
          return 'W';
        case 1:
          return 'S';
        case 2:
          return 'E';
        case 3:
        default:
          return 'S';
      }
    }

    switch (mod) {
      case 0:
        return 'N';
      case 1:
        return 'W';
      case 2:
        return 'N';
      case 3:
      default:
        return 'E';
    }
  }

  private getNeighborOffsets(cell: { col: number; row: number }): Array<{ dc: number; dr: number }> {
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
      case 'N':
        return 0;
      case 'E':
        return 90;
      case 'W':
        return 270;
      case 'S':
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

  private computeTileBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
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
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi + Number.EPSILON) + xi);
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

  private shareEdge(edgesA: EdgeInfo[], edgesB: EdgeInfo[]): boolean {
    const epsilon = 0.1;
    for (const edgeA of edgesA) {
      for (const edgeB of edgesB) {
        const a0 = edgeA.points[0];
        const a1 = edgeA.points[1];
        const b0 = edgeB.points[0];
        const b1 = edgeB.points[1];
        const same = (this.pointsEqual(a0, b0, epsilon) && this.pointsEqual(a1, b1, epsilon))
          || (this.pointsEqual(a0, b1, epsilon) && this.pointsEqual(a1, b0, epsilon));
        if (same) return true;
      }
    }
    return false;
  }

  private distanceToLineSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  }

  private pointsEqual(p1: Point, p2: Point, epsilon: number): boolean {
    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
  }

  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const unique: EdgeInfo[] = [];
    const epsilon = 0.1;
    for (const edge of edges) {
      if (!unique.some(u =>
        (this.pointsEqual(edge.points[0], u.points[0], epsilon) && this.pointsEqual(edge.points[1], u.points[1], epsilon)) ||
        (this.pointsEqual(edge.points[0], u.points[1], epsilon) && this.pointsEqual(edge.points[1], u.points[0], epsilon))
      )) {
        unique.push(edge);
      }
    }
    return unique;
  }
}
