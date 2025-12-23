import { describe, it, expect } from 'vitest';
import { SquareGrid, HexagonGrid, TriangleGrid, CairoGrid } from './grid';

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

describe('HexagonGrid (pointy-top, odd-r)', () => {
  const grid = new HexagonGrid(10);

  it('should return correct neighbors for cell (1,1) (odd row)', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 1 });
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 1 }, // E
        { col: 0, row: 1 }, // W
        { col: 1, row: 0 }, // NW
        { col: 1, row: 2 }, // SW
        { col: 2, row: 0 }, // NE
        { col: 2, row: 2 }, // SE
      ])
    );
    expect(neighbors.length).toBe(6);
  });

  it('should return correct neighbors for cell (1,2) (even row)', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 2 });
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 2 }, // E
        { col: 0, row: 2 }, // W
        { col: 1, row: 1 }, // N
        { col: 1, row: 3 }, // S
        { col: 0, row: 1 }, // NW
        { col: 0, row: 3 }, // SW
      ])
    );
    expect(neighbors.length).toBe(6);
  });

  it('should return correct neighbors for cell (1,3) (odd row)', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 3 });
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 3 }, // E
        { col: 0, row: 3 }, // W
        { col: 1, row: 2 }, // NW
        { col: 1, row: 4 }, // SW
        { col: 2, row: 2 }, // NE
        { col: 2, row: 4 }, // SE
      ])
    );
    expect(neighbors.length).toBe(6);
  });

  it('should return correct neighbors for cell (2,3) (odd row)', () => {
    const neighbors = grid.getNeighbors({ col: 2, row: 3 });
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 3, row: 3 }, // E
        { col: 1, row: 3 }, // W
        { col: 2, row: 2 }, // NW
        { col: 2, row: 4 }, // SW
        { col: 3, row: 2 }, // NE
        { col: 3, row: 4 }, // SE
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
                { col: -1, row: 0 }, // Left
                { col: 1, row: 0 },  // Right
                { col: 0, row: 1 },  // Bottom (forms a downward triangle with this cell)
            ])
        );
        expect(neighbors.length).toBe(3);
    });

    it('should return correct neighbors for a downward-pointing triangle', () => {
        // (1,0) is downward since 1+0=1 (odd)
        const neighbors = grid.getNeighbors({ col: 1, row: 0 });
        expect(neighbors).toEqual(
            expect.arrayContaining([
                { col: 0, row: 0 }, // Left
                { col: 2, row: 0 }, // Right
                { col: 1, row: -1 }, // Top (forms an upward triangle with this cell)
            ])
        );
        expect(neighbors.length).toBe(3);
    });
});

describe('CairoGrid (catalan)', () => {
  const scale = 10;
  const grid = new CairoGrid({ scale, pentagonType: 'catalan' });

  const edgeLengths = (points: { x: number; y: number }[]) => {
    const lengths: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      lengths.push(Math.hypot(dx, dy));
    }
    return lengths;
  };

  const interiorAngles = (points: { x: number; y: number }[]) => {
    const angles: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const v1x = prev.x - curr.x;
      const v1y = prev.y - curr.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.hypot(v1x, v1y);
      const mag2 = Math.hypot(v2x, v2y);
      const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
      const angle = Math.acos(cos) * (180 / Math.PI);
      angles.push(angle);
    }
    return angles;
  };

  it('should have four long edges and one short edge with expected lengths', () => {
    const poly = grid.getCellPolygon({ col: 0, row: 0 });
    expect(poly.length).toBe(5);

    const lengths = edgeLengths(poly).sort((a, b) => a - b);
    const shortEdge = lengths[0];
    const longEdges = lengths.slice(1);

    const expectedShort = scale * (Math.sqrt(3) - 1);
    const expectedLong = scale;

    expect(shortEdge).toBeCloseTo(expectedShort, 4);
    longEdges.forEach(length => {
      expect(length).toBeCloseTo(expectedLong, 4);
    });
  });

  it('should have interior angles of 120°, 120°, 90°, 120°, 90°', () => {
    const poly = grid.getCellPolygon({ col: 0, row: 0 });
    const angles = interiorAngles(poly);

    const closeTo = (value: number, target: number) => Math.abs(value - target) < 0.5;
    const counts = angles.reduce(
      (acc, angle) => {
        if (closeTo(angle, 120)) acc.count120 += 1;
        if (closeTo(angle, 90)) acc.count90 += 1;
        return acc;
      },
      { count120: 0, count90: 0 }
    );

    expect(counts.count120).toBe(3);
    expect(counts.count90).toBe(2);
  });

  it('should return five neighbors for a typical cell', () => {
    const neighbors = grid.getNeighbors({ col: 1, row: 1 });
    expect(neighbors.length).toBe(5);

    const unique = new Set(neighbors.map(n => `${n.col},${n.row}`));
    expect(unique.size).toBe(5);
  });
});
