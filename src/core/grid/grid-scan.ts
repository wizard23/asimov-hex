export function scanCellWindow(
  gridWidth: number,
  gridHeight: number,
  approxCol: number,
  approxRow: number,
  colRadius: number,
  rowRadius: number,
  visit: (col: number, row: number) => void
): void {
  const minRow = Math.max(0, approxRow - rowRadius);
  const maxRow = Math.min(gridHeight - 1, approxRow + rowRadius);
  const minCol = Math.max(0, approxCol - colRadius);
  const maxCol = Math.min(gridWidth - 1, approxCol + colRadius);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      visit(c, r);
    }
  }
}
