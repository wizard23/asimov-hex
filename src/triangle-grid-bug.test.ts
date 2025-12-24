import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticleSystem, Particle } from './particle-system';
import { TriangleGrid } from './grid';
import { Container } from 'pixi.js';

// Mock PIXI.js
vi.mock('pixi.js', () => {
  return {
    Container: class Container {
      addChild() {}
      removeChild() {}
    },
    Graphics: class Graphics {
      circle() { return this; }
      fill() { return this; }
      moveTo() { return this; }
      lineTo() { return this; }
      stroke() { return this; }
      x = 0;
      y = 0;
    }
  };
});

describe('TriangleGrid Particle Bug', () => {
  let grid: TriangleGrid;
  let system: ParticleSystem;
  let container: Container;
  const scale = 100;
  const height = scale * Math.sqrt(3) / 2;

  beforeEach(() => {
    grid = new TriangleGrid(scale);
    container = new Container();
    system = new ParticleSystem(container);
  });

  describe('Grid Interface Functions', () => {
    // Vertex at (scale, height) -> (100, 86.6)
    // This vertex connects Cell(0,0)[Up], Cell(1,0)[Down], Cell(1,1)[Up], Cell(2,0)[Up]... wait.
    // Let's verify neighbors/edges for a specific vertex.
    // Vertex V = (100, 86.6025)
    // Cell(0,0) (Up) vertices: (50,0), (0, 86.6), (100, 86.6). -> Has V.
    // Cell(1,0) (Down) vertices: (50,0), (150,0), (100, 86.6). -> Has V.
    // Cell(1,1) (Up) vertices: (150, 86.6), (100, 173.2), (200, 173.2)... wait.
    // Cell(1,1) col 1, row 1. (1+1)=2 even -> Up.
    // Center x: 1*50 + 50 = 100.
    // Center y: 1*86.6 + 43.3 = 129.9.
    // Vertices: (100, 86.6), (50, 173.2), (150, 173.2). -> Has V at (100, 86.6).
    // Cell(0,1) (Down). col 0, row 1. (0+1)=1 odd -> Down.
    // Center x: 0*50 + 50 = 50.
    // Center y: 129.9.
    // Vertices: (0, 86.6), (100, 86.6), (50, 173.2). -> Has V at (100, 86.6).
    
    // So V(100, 86.6) is shared by:
    // (0,0) [Up]
    // (1,0) [Down]
    // (1,1) [Up]
    // (0,1) [Down]
    // (2,0) [Up]? col 2, row 0. 2+0=2 even -> Up. x=100+50=150. V(150,0), (100,86.6), (200,86.6). -> Has V.
    // (-1,0) [Down]? x=-50+50=0. V(-50,0), (50,0), (0,86.6). No.
    
    // It seems V(100, 86.6) is shared by 6 triangles in a hexagonal arrangement.
    // (0,0), (1,0), (2,0), (1,1), (0,1)... and maybe (-1, something)?
    
    const vertex = { x: 100, y: height }; 

    it('getEdgesAtVertex should return edges connected to the vertex', () => {
      const edges = grid.getEdgesAtVertex(vertex, 5, 5); // 5x5 grid
      // Expect 6 edges for an internal vertex in a triangle grid
      expect(edges.length).toBeGreaterThan(0);
      
      // Verify all edges actually touch the vertex
      edges.forEach(edge => {
        const p1 = edge.points[0];
        const p2 = edge.points[1];
        const closeToP1 = Math.abs(p1.x - vertex.x) < 0.1 && Math.abs(p1.y - vertex.y) < 0.1;
        const closeToP2 = Math.abs(p2.x - vertex.x) < 0.1 && Math.abs(p2.y - vertex.y) < 0.1;
        expect(closeToP1 || closeToP2).toBe(true);
      });
    });

    it('pixelToCell should identify cells around the vertex correctly', () => {
        // Check points slightly offset from vertex into assumed cells
        
        // Into Cell (0,0) [Up] -> Up-Leftish from V?
        // (0,0) Polygon: (50,0), (0, 86.6), (100, 86.6).
        // Centroid approx (50, 57.7).
        // Check point (90, 80).
        expect(grid.pixelToCell({ x: 90, y: 80 })).toEqual({ col: 0, row: 0 });

        // Into Cell (1,0) [Down] -> Up-Rightish from V?
        // (1,0) Vertices: (50,0), (150,0), (100, 86.6).
        // Check point (100, 80). (Directly above V?)
        // x=100 is boundary between (0,0) and (2,0)?
        // Wait, (0,0) is x [0, 100] at bottom.
        // (1,0) is x [50, 150] at top.
        // Point (100, 80) is inside (1,0).
        expect(grid.pixelToCell({ x: 100, y: 80 })).toEqual({ col: 1, row: 0 });
        
        // Into Cell (2,0) [Up] -> Right from V?
        // (2,0) Vertices: (150,0), (100, 86.6), (200, 86.6).
        // Check point (110, 80).
        expect(grid.pixelToCell({ x: 110, y: 80 })).toEqual({ col: 2, row: 0 });
    });
  });

  describe('handleVertexArrival with highestEdgeDelta', () => {
    it('should choose the edge with highest delta', () => {
      // Setup a vertex V at (100, 86.6)
      const V = { x: 100, y: height };
      
      // We need to define edges connected to V.
      // E1: V to (50, 0) -- shared by (0,0) and (1,0)
      // E2: V to (150, 0) -- shared by (1,0) and (2,0)
      // E3: V to (0, 86.6) -- shared by (0,0) and (0,1)
      // E4: V to (200, 86.6) -- shared by (2,0) and ?? (2,1 implied?)
      // E5: V to (50, 173.2) -- shared by (0,1) and (1,1)
      // E6: V to (150, 173.2) -- shared by (1,1) and ??
      
      // Let's assume we arrive from E1.
      // We want to test selection among others.
      // Let's set states to create a high delta on E2.
      
      // E2 is shared by (1,0) and (2,0).
      // Let Cell(1,0) have state 10.
      // Let Cell(2,0) have state 0.
      // Delta E2 = 10.
      
      // Other cells 0.
      // Cell(0,0) = 0.
      // Cell(0,1) = 0.
      // Cell(1,1) = 0.
      
      // Delta E3 (between 0,0 and 0,1) = |0-0| = 0.
      // Delta E5 (between 0,1 and 1,1) = |0-0| = 0.
      // ...
      
      // Setup cellStates
      const cellStates = Array(5).fill(0).map(() => Array(5).fill(0));
      cellStates[0][1] = 10; // Cell(1,0) has state 10
      // All others 0.
      
      // We expect E2 to be chosen.
      // E2 connects V(100, 86.6) and (150, 0).
      
      const particle: Particle = {
        x: V.x,
        y: V.y,
        currentEdge: { type: 'edge', points: [{x: 50, y: 0}, {x: 100, y: height}] }, // Arrived from E1
        direction: 1,
        progress: 1,
        previousEdge: null
      };
      
      // Mock getEdgesAtVertex to ensure we get expected edges
      // But we want to test real logic, so we rely on grid.
      
      // Call private method handleVertexArrival
      (system as any).handleVertexArrival(
        particle,
        V,
        grid,
        5,
        5,
        'highestEdgeDelta',
        0, 0, // mouse
        cellStates
      );
      
      const newEdge = particle.currentEdge;
      const p1 = newEdge.points[0];
      const p2 = newEdge.points[1];
      
      // Check if newEdge is E2: (100, 86.6) to (150, 0)
      // or (150,0) to (100,86.6)
      
      const isE2 = (
        (Math.abs(p1.x - 100) < 1 && Math.abs(p1.y - height) < 1 && Math.abs(p2.x - 150) < 1 && Math.abs(p2.y - 0) < 1) ||
        (Math.abs(p2.x - 100) < 1 && Math.abs(p2.y - height) < 1 && Math.abs(p1.x - 150) < 1 && Math.abs(p1.y - 0) < 1)
      );
      
      if (!isE2) {
          console.log("Selected edge points:", p1, p2);
          // Calculate delta for selected edge to see what happened
          const delta = (system as any).getEdgeDelta(newEdge, grid, cellStates, 5, 5);
          console.log("Selected edge delta:", delta);
      }

      expect(isE2).toBe(true);
    });
  });
});