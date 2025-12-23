import { Graphics, Container } from 'pixi.js';
import { Point, EdgeInfo } from './types';
import { Grid } from './grid';

export type EdgeSelectionRule = 'randomNoBacktrack' | 'randomWithBacktrack' | 'clockwise' | 'counterClockwise' | 'followCursor' | 'avoidCursor' | 'highestEdgeDelta';

export interface Particle {
  x: number;
  y: number;
  currentEdge: EdgeInfo;
  direction: number; // 1 = toward points[1], -1 = toward points[0]
  progress: number; // 0 to 1 along current edge
  previousEdge: EdgeInfo | null;
}

export class ParticleSystem {


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
