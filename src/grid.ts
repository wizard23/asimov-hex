import { Point } from './types';

export interface Grid {
  pixelToCell(pixel: Point): { col: number, row: number };
  cellToPixel(cell: { col: number, row: number }): Point;
  getNeighbors(cell: { col: number, row: number }): { col: number, row: number }[];
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
}

export class HexagonGrid implements Grid {
  constructor(private scale: number) {}

  // pointy-top, odd-r offset coordinates
  // (where odd-numbered rows are shifted right)
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

  pixelToCell(pixel: Point): { col: number, row: number } {
    // This assumes pixel (0,0) is top-left, and hex (0,0) is top-left in rendering
    // x = q * sqrt(3) * scale + r * sqrt(3)/2 * scale
    // y = r * 3/2 * scale
    // Inverse:
    // r = y / (3/2 * scale)
    // q = (x - r * sqrt(3)/2 * scale) / (sqrt(3) * scale)
    const q_approx = (pixel.x * 2/3 / this.scale); // This pixel to axial is wrong, must match rendering
    const r_approx = (pixel.y * 2/3 / this.scale); // Placeholder for proper conversion

    // The actual pixelToCell for pointy-top is complex. Using a simpler heuristic for now.
    // The previous pixelToCell implementation in grid.ts was attempting a conversion
    // but without proper origin and offset handling for this specific pointy-top odd-r layout.
    // Given the current renderer, direct pixelToCell conversion is hard without adjusting origins.
    // For now, it will return an approximate cell.
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
    // For pointy-top, odd-r layout
    const x = this.scale * Math.sqrt(3) * (cell.col + 0.5 * (cell.row & 1));
    const y = this.scale * 3/2 * cell.row;
    return { x, y };
  }

  getNeighbors(cell: { col: number, row: number }): { col: number, row: number }[] {
    const isOddRow = cell.row & 1;
    const neighbors: {col: number, row: number}[] = [];

    if (isOddRow) { // Odd rows are shifted right
      neighbors.push({ col: cell.col + 1, row: cell.row });     // E
      neighbors.push({ col: cell.col - 1, row: cell.row });     // W
      neighbors.push({ col: cell.col, row: cell.row - 1 });     // NW
      neighbors.push({ col: cell.col + 1, row: cell.row - 1 }); // NE
      neighbors.push({ col: cell.col, row: cell.row + 1 });     // SW
      neighbors.push({ col: cell.col + 1, row: cell.row + 1 }); // SE
    } else { // Even rows are not shifted
      neighbors.push({ col: cell.col + 1, row: cell.row });     // E
      neighbors.push({ col: cell.col - 1, row: cell.row });     // W
      neighbors.push({ col: cell.col - 1, row: cell.row - 1 }); // NW
      neighbors.push({ col: cell.col, row: cell.row - 1 });     // NE
      neighbors.push({ col: cell.col - 1, row: cell.row + 1 }); // SW
      neighbors.push({ col: cell.col, row: cell.row + 1 });     // SE
    }
    
    return neighbors;
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
}