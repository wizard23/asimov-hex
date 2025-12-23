import { describe, it, expect } from 'vitest';
import { SquareGrid, HexagonGrid, TriangleGrid } from './grid';

describe('SquareGrid', () => {
  const grid = new SquareGrid(10);

  it('should return correct neighbors', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 1 });
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 1, row: 0 }, // N
        { col: 2, row: 1 }, // E
        { col: 1, row: 2 }, // S
        { col: 0, row: 1 }, // W
      ])
    );
    expect(neighbors.length).toBe(4);
  });
});

describe('HexagonGrid (pointy-top, odd-q vertical)', () => {
  const grid = new HexagonGrid(10);

  it('should return correct neighbors for an even column', () => {
    const neighbors = grid.getNeighbors({ col: 2, row: 2 }); // Even column
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 3, row: 2 },
        { col: 2, row: 3 },
        { col: 1, row: 3 },
        { col: 1, row: 2 },
        { col: 1, row: 1 },
        { col: 2, row: 1 },
      ])
    );
    expect(neighbors.length).toBe(6);
  });

  it('should return correct neighbors for an odd column', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 2 }); // Odd column
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 2 },
        { col: 1, row: 3 },
        { col: 0, row: 3 },
        { col: 0, row: 2 },
        { col: 0, row: 1 },
        { col: 1, row: 1 },
      ])
    );
    expect(neighbors.length).toBe(6);
  });
});

describe('TriangleGrid', () => {
    const grid = new TriangleGrid(10);

    it('should return correct neighbors for an upward-pointing triangle', () => {
        // (0,0) is upward since 0+0=0 (even)
        const neighbors = grid.getNeighbors({ col: 0, row: 0 });
        expect(neighbors).toEqual(
            expect.arrayContaining([
                { col: -1, row: 0 },
                { col: 1, row: 0 },
                { col: 0, row: 1 },
            ])
        );
        expect(neighbors.length).toBe(3);
    });

    it('should return correct neighbors for a downward-pointing triangle', () => {
        // (1,0) is downward since 1+0=1 (odd)
        const neighbors = grid.getNeighbors({ col: 1, row: 0 });
        expect(neighbors).toEqual(
            expect.arrayContaining([
                { col: 0, row: 0 },
                { col: 2, row: 0 },
                { col: 1, row: -1 },
            ])
        );
        expect(neighbors.length).toBe(3);
    });
});
