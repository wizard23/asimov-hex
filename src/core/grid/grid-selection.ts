import { EdgeInfo } from "../../types";
import { Grid } from "./grid";

export interface CellHit {
  type: "cell";
  row: number;
  col: number;
}

export function getCellAtPixel(
  grid: Grid,
  width: number,
  height: number,
  x: number,
  y: number
): CellHit | null {
  const cell = grid.pixelToCell({ x, y });
  if (cell && cell.col >= 0 && cell.col < width && cell.row >= 0 && cell.row < height) {
    return { type: "cell", row: cell.row, col: cell.col };
  }
  return null;
}

export function getEdgeAtPixel(
  grid: Grid,
  width: number,
  height: number,
  x: number,
  y: number,
  threshold: number
): EdgeInfo | null {
  return grid.getEdgeAt({ x, y }, threshold, width, height);
}

export function filterInBounds(
  cells: Array<{ col: number; row: number }>,
  width: number,
  height: number
): Array<{ col: number; row: number }> {
  return cells.filter(
    (cell) =>
      cell.col >= 0 &&
      cell.col < width &&
      cell.row >= 0 &&
      cell.row < height
  );
}
