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

export class HexagonGrid implements Grid {
  constructor(private scale: number) {}

  // pointy-top, odd-r offset coordinates
  private offsetToAxial(cell: { col: number, row: number }): { q: number, r: number } {
    const q = cell.col - (cell.row - (cell.row & 1)) / 2;
    const r = cell.row;
    return { q, r };
  }

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
