import { describe, it, expect } from 'vitest';
import { SquareGrid, HexagonGrid, TriangleGrid, CairoGrid } from './core/grid/grid';

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

  const shortEdgeDirection = (points: { x: number; y: number }[]) => {
    const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    centroid.x /= points.length;
    centroid.y /= points.length;

    let shortIndex = 0;
    let shortLength = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (length < shortLength) {
        shortLength = length;
        shortIndex = i;
      }
    }

    const p1 = points[shortIndex];
    const p2 = points[(shortIndex + 1) % points.length];
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dx = mid.x - centroid.x;
    const dy = mid.y - centroid.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'E' : 'W';
    }
    return dy >= 0 ? 'S' : 'N';
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





  it('should return correct neighbors for cell (3,0) (even row, short edge points S)', () => {
    const neighbors = grid.getNeighbors({ col: 3, row: 0 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 3, row: 0 }));
    expect(direction).toBe('S');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 0 }, // NNE
        { col: 4, row: 0 }, // NNW
        { col: 1, row: 1 }, // SWW
        { col: 3, row: 1 }, // SOO
        { col: 2, row: 1 }, // S
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (2,2) (even row, short edge points E)', () => {
    const neighbors = grid.getNeighbors({ col: 2, row: 2 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 2, row: 2 }));
    expect(direction).toBe('E');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 0, row: 3 }, // SWW 
        { col: 1, row: 2 }, // NWW
        { col: 2, row: 1 }, // NNO
        { col: 4, row: 2 }, // O
        { col: 3, row: 2 }, // SSO
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (4,2) (even row, short edge points W)', () => {
    const neighbors = grid.getNeighbors({ col: 4, row: 2 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 4, row: 2 }));
    expect(direction).toBe('W');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 2 }, // W
        { col: 2, row: 1 }, // NNW
        { col: 5, row: 2 }, // NEE
        { col: 4, row: 3 }, // SEE
        { col: 3, row: 2 }, // SSE
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (5,2) (even row, short edge points S)', () => {
    const neighbors = grid.getNeighbors({ col: 5, row: 2 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 5, row: 2 }));
    expect(direction).toBe('S');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 5, row: 1 }, // NNE
        { col: 3, row: 1 }, // NNW
        { col: 4, row: 2 }, // SWW
        { col: 6, row: 2 }, // SOO
        { col: 4, row: 3 }, // S
      ])
    );
    expect(neighbors.length).toBe(5);
  });






  it('should return correct neighbors for cell (2,1) (odd row, short edge points N)', () => {
    const neighbors = grid.getNeighbors({ col: 2, row: 1 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 2, row: 1 }));
    expect(direction).toBe('N');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 3, row: 1 }, // NEE
        { col: 1, row: 1 }, // NWW
        { col: 2, row: 2 }, // SSW
        { col: 4, row: 2 }, // SSO
        { col: 3, row: 0 }, // N
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (3,1) (odd row, short edge points E)', () => {
    const neighbors = grid.getNeighbors({ col: 3, row: 1 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 3, row: 1 }));
    expect(direction).toBe('E');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 2, row: 1 }, // SWW 
        { col: 3, row: 0 }, // NWW
        { col: 4, row: 1 }, // NNO
        { col: 5, row: 1 }, // O
        { col: 5, row: 2 }, // SSO
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (5,1) (odd row, , short edge points W)', () => {
    const neighbors = grid.getNeighbors({ col: 5, row: 1 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 5, row: 1 }));
    expect(direction).toBe('W');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 3, row: 1 }, // W
        { col: 4, row: 1 }, // NNW
        { col: 7, row: 0 }, // NEE
        { col: 6, row: 1 }, // SEE
        { col: 5, row: 2 }, // SSE
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  it('should return correct neighbors for cell (4,1) (odd row, short edge points N)', () => {
    const neighbors = grid.getNeighbors({ col: 4, row: 1 });
    const direction = shortEdgeDirection(grid.getCellPolygon({ col: 4, row: 1 }));
    expect(direction).toBe('N');
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { col: 6, row: 0 }, // NEE
        { col: 4, row: 0 }, // NWW
        { col: 3, row: 1 }, // SSW
        { col: 5, row: 1 }, // SSO
        { col: 5, row: 0 }, // N
      ])
    );
    expect(neighbors.length).toBe(5);
  });

  const shortEdgeSegment = (points: { x: number; y: number }[]) => {
    let shortIndex = 0;
    let shortLength = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (length < shortLength) {
        shortLength = length;
        shortIndex = i;
      }
    }
    return {
      a: points[shortIndex],
      b: points[(shortIndex + 1) % points.length],
    };
  };

  const pointsClose = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y) < 1e-6;

  const segmentsCoincide = (s1: { a: { x: number; y: number }; b: { x: number; y: number } }, s2: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
    (pointsClose(s1.a, s2.a) && pointsClose(s1.b, s2.b)) ||
    (pointsClose(s1.a, s2.b) && pointsClose(s1.b, s2.a));

  const longEdgeSegments = (points: { x: number; y: number }[]) => {
    const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
    const expectedLong = scale;
    const tolerance = 1e-6;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (Math.abs(length - expectedLong) < tolerance) {
        segments.push({ a: p1, b: p2 });
      }
    }
    return segments;
  };

  const anyLongEdgeCoincide = (a: { col: number; row: number }, b: { col: number; row: number }) => {
    const segsA = longEdgeSegments(grid.getCellPolygon(a));
    const segsB = longEdgeSegments(grid.getCellPolygon(b));
    return segsA.some(segA => segsB.some(segB => segmentsCoincide(segA, segB)));
  };

  it('should align short edges for expected adjacent cells', () => {
    const pairs: Array<[{ col: number; row: number }, { col: number; row: number }]> = [
      [{ col: 2, row: 0 }, { col: 4, row: 0 }],
      [{ col: 3, row: 0 }, { col: 2, row: 1 }],
      [{ col: 3, row: 1 }, { col: 5, row: 1 }],
      [{ col: 5, row: 0 }, { col: 4, row: 1 }],
    ];

    pairs.forEach(([a, b]) => {
      const segA = shortEdgeSegment(grid.getCellPolygon(a));
      const segB = shortEdgeSegment(grid.getCellPolygon(b));
      expect(segmentsCoincide(segA, segB)).toBe(true);
    });
  });

  it('should align long edges for expected adjacent cells', () => {
    const pairs: Array<[{ col: number; row: number }, { col: number; row: number }]> = [
      [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      [{ col: 0, row: 0 }, { col: 0, row: 1 }],
      [{ col: 1, row: 0 }, { col: 2, row: 0 }],
      [{ col: 6, row: 0 }, { col: 7, row: 0 }],
      [{ col: 6, row: 0 }, { col: 4, row: 1 }],
      [{ col: 0, row: 1 }, { col: 2, row: 0 }],
      [{ col: 1, row: 1 }, { col: 0, row: 1 }],
      [{ col: 1, row: 1 }, { col: 3, row: 0 }],
      [{ col: 2, row: 1 }, { col: 4, row: 2 }],
      [{ col: 2, row: 1 }, { col: 2, row: 2 }],
    ];

    pairs.forEach(([a, b]) => {
      expect(anyLongEdgeCoincide(a, b)).toBe(true);
    });
  });
});
