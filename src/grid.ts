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
      { col, row: row - 1 }, // N
      { col: col + 1, row }, // E
      { col, row: row + 1 }, // S
      { col: col - 1, row }, // W
    ];
  }
}

export class HexagonGrid implements Grid {
  private hexWidth: number;
  private hexHeight: number;

  constructor(private scale: number) {
    this.hexWidth = Math.sqrt(3) * scale;
    this.hexHeight = 2 * scale;
  }
  
  // Conversion between offset and axial coordinates
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

  pixelToCell(pixel: Point): { col: number; row: number; } {
    const q = (Math.sqrt(3)/3 * pixel.x - 1./3 * pixel.y) / this.scale;
    const r = (2./3 * pixel.y) / this.scale;
    const axial = this.axialRound({ q, r });
    return this.axialToOffset(axial);
  }

  private axialRound(frac: {q: number, r: number}): {q: number, r: number} {
      const s = -frac.q - frac.r;
      let q = Math.round(frac.q);
      let r = Math.round(frac.r);
      let s_rounded = Math.round(s);
      const q_diff = Math.abs(q - frac.q);
      const r_diff = Math.abs(r - frac.r);
      const s_diff = Math.abs(s_rounded - s);
      if (q_diff > r_diff && q_diff > s_diff) {
          q = -r - s_rounded;
      } else if (r_diff > s_diff) {
          r = -q - s_rounded;
      }
      return { q, r };
  }

  cellToPixel(cell: { col: number; row: number; }): Point {
    const axial = this.offsetToAxial(cell);
    const x = this.scale * (Math.sqrt(3) * axial.q + Math.sqrt(3)/2 * axial.r);
    const y = this.scale * (3./2 * axial.r);
    return { x, y };
  }
  
  getNeighbors(cell: { col: number; row: number; }): { col: number; row: number; }[] {
    const axial = this.offsetToAxial(cell);
    const directions = [
        {q: 1, r: 0}, {q: 0, r: 1}, {q: -1, r: 1}, 
        {q: -1, r: 0}, {q: 0, r: -1}, {q: 1, r: -1}
    ];
    return directions.map(dir => {
      const neighborAxial = { q: axial.q + dir.q, r: axial.r + dir.r };
      return this.axialToOffset(neighborAxial);
    });
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
    // This is a complex conversion, a simplified version is used here
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
    const isUpward = (row + col) % 2 === 0;
    if (isUpward) {
      return [{ col: col - 1, row }, { col: col + 1, row }, { col, row: row + 1 }];
    } else {
      return [{ col: col - 1, row }, { col: col + 1, row }, { col, row: row - 1 }];
    }
  }
}
