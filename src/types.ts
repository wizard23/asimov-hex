export type GridType = 'squares' | 'hexagons' | 'triangles' | 'cairo';

export interface Point {
  x: number;
  y: number;
}

export interface EdgeInfo {
  type: 'edge';
  points: Point[];
}

export interface CellInfo {
  type: 'cell';
  row: number;
  col: number;
}
