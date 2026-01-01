export type GridType = 'squares' | 'hexagons' | 'triangles' | 'cairo';

export type EdgeSelectionRule = 'randomNoBacktrack' | 'randomWithBacktrack' | 'clockwise' | 'counterClockwise' | 'followCursor' | 'avoidCursor' | 'orbitCursor' | 'highestEdgeDelta';

export type OrbitAlgorithm = 'gradient' | 'distanceToEndpoint';

export type ColorValue = string | { r: number; g: number; b: number; a?: number };

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
