import { Graphics, Container } from 'pixi.js';
import { Point, EdgeInfo, GridType } from './types';

type EdgeSelectionRule = 'randomNoBacktrack' | 'randomWithBacktrack';

export interface Particle {
  x: number;
  y: number;
  currentEdge: EdgeInfo;
  direction: number; // 1 = toward points[1], -1 = toward points[0]
  progress: number; // 0 to 1 along current edge
  previousEdge: EdgeInfo | null;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private particleContainer: Container;
  private particleGraphics: Map<Particle, Graphics> = new Map();

  constructor(container: Container) {
    this.particleContainer = container;
  }

  spawnParticle(edge: EdgeInfo, clickX: number, clickY: number): void {
    const p1 = edge.points[0];
    const p2 = edge.points[1];
    
    // Calculate distance to each vertex
    const dist1 = Math.sqrt((clickX - p1.x) ** 2 + (clickY - p1.y) ** 2);
    const dist2 = Math.sqrt((clickX - p2.x) ** 2 + (clickY - p2.y) ** 2);
    
    // Determine direction (toward closer vertex)
    const direction = dist1 < dist2 ? -1 : 1;
    
    // Calculate initial progress along edge
    const edgeLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    let progress: number;
    if (direction === -1) {
      // Moving toward p1
      const distFromP1 = dist1;
      progress = 1 - (distFromP1 / edgeLength);
    } else {
      // Moving toward p2
      const distFromP2 = dist2;
      progress = distFromP2 / edgeLength;
    }
    
    // Clamp progress
    progress = Math.max(0, Math.min(1, progress));
    
    // Calculate initial position
    const x = p1.x + (p2.x - p1.x) * progress;
    const y = p1.y + (p2.y - p1.y) * progress;
    
    const particle: Particle = {
      x,
      y,
      currentEdge: edge,
      direction,
      progress,
      previousEdge: null,
    };
    
    this.particles.push(particle);
    this.createParticleGraphics(particle);
  }

  private createParticleGraphics(particle: Particle): void {
    const graphics = new Graphics();
    graphics.circle(0, 0, 4);
    graphics.fill({ color: 0x00ff00 });
    graphics.x = particle.x;
    graphics.y = particle.y;
    this.particleContainer.addChild(graphics);
    this.particleGraphics.set(particle, graphics);
  }

  update(deltaTime: number, particleSpeed: number, gridScale: number, gridRenderer: any, gridWidth: number, gridHeight: number, gridType: GridType, edgeSelectionRule: EdgeSelectionRule): void {
    const distancePerSecond = particleSpeed; // units per second
    const distanceThisFrame = (distancePerSecond * deltaTime) / 1000; // convert ms to seconds
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const edge = particle.currentEdge;
      const p1 = edge.points[0];
      const p2 = edge.points[1];
      
      // Calculate edge length
      const edgeLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      
      // Move particle along edge
      if (particle.direction === 1) {
        // Moving toward p2
        particle.progress += distanceThisFrame / edgeLength;
      } else {
        // Moving toward p1
        particle.progress -= distanceThisFrame / edgeLength;
      }
      
      console.log("particle.progress", particle.progress);
      // Check if reached vertex
      if (particle.progress >= 1) {
        // Reached p2
        this.handleVertexArrival(particle, p2, gridRenderer, gridWidth, gridHeight, gridType, gridScale, edgeSelectionRule);
      } else if (particle.progress <= 0) {
        // Reached p1
        this.handleVertexArrival(particle, p1, gridRenderer, gridWidth, gridHeight, gridType, gridScale, edgeSelectionRule);
      } else {
        // Update position along edge
        particle.x = p1.x + (p2.x - p1.x) * particle.progress;
        particle.y = p1.y + (p2.y - p1.y) * particle.progress;
        
        // Update graphics
        const graphics = this.particleGraphics.get(particle);
        if (graphics) {
          graphics.x = particle.x;
          graphics.y = particle.y;
        }
      }
    }
  }

  private handleVertexArrival(
    particle: Particle,
    vertex: Point,
    gridRenderer: { getEdgesAtVertex: (vertex: Point, width: number, height: number, gridType: GridType, scale: number) => EdgeInfo[] },
    gridWidth: number,
    gridHeight: number,
    gridType: GridType,
    gridScale: number,
    edgeSelectionRule: EdgeSelectionRule
  ): void {
    // Find all edges connected to this vertex
    const connectedEdges = gridRenderer.getEdgesAtVertex(vertex, gridWidth, gridHeight, gridType, gridScale);
    
    if (connectedEdges.length === 0) {
      // No edges found, remove particle
      this.removeParticle(particle);
      return;
    }
    
    let availableEdges: EdgeInfo[];
    console.log("edgeSelectionRule", edgeSelectionRule, "connectedEdges", connectedEdges);
    
    if (edgeSelectionRule === 'randomNoBacktrack') {
      // Filter out the edge we're currently on (the one we just arrived from)
      availableEdges = connectedEdges.filter(edge => {
        if (!particle.currentEdge) return true;
        // Check if this edge is the same as the current edge we're on
        // Use a more robust comparison that handles floating point precision
        const currentP1 = particle.currentEdge.points[0];
        const currentP2 = particle.currentEdge.points[1];
        const edgeP1 = edge.points[0];
        const edgeP2 = edge.points[1];
        
        // Check if edges are the same (same two points, regardless of order)
        const sameEdge = (
          (this.pointsEqual(currentP1, edgeP1) && this.pointsEqual(currentP2, edgeP2)) ||
          (this.pointsEqual(currentP1, edgeP2) && this.pointsEqual(currentP2, edgeP1))
        );
        
        return !sameEdge;
      });
    } else {
      // randomWithBacktrack - allow all edges including the one we came from
      availableEdges = connectedEdges;
    }
    
    if (availableEdges.length === 0) {
      // No available edges, remove particle
      this.removeParticle(particle);
      return;
    }
    
    // Choose random edge
    const nextEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    
    // Determine direction on new edge
    // We're at a vertex, so we need to move away from it along the new edge
    const nextP1 = nextEdge.points[0];
    const vertexIsP1 = this.pointsEqual(vertex, nextP1);
    
    particle.previousEdge = particle.currentEdge;
    particle.currentEdge = nextEdge;
    
    if (vertexIsP1) {
      // Vertex is at p1, so move toward p2 (positive direction)
      particle.direction = 1;
      particle.progress = 0; // Start at p1
    } else {
      // Vertex is at p2, so move toward p1 (negative direction)
      particle.direction = -1;
      particle.progress = 1; // Start at p2
    }
    
    particle.x = vertex.x;
    particle.y = vertex.y;
    
    // Update graphics
    const graphics = this.particleGraphics.get(particle);
    if (graphics) {
      graphics.x = particle.x;
      graphics.y = particle.y;
    }
  }

  private pointsEqual(p1: Point, p2: Point): boolean {
    const epsilon = 0.01; // Increased epsilon for better floating point comparison
    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
  }

  private removeParticle(particle: Particle): void {
    const graphics = this.particleGraphics.get(particle);
    if (graphics) {
      this.particleContainer.removeChild(graphics);
      this.particleGraphics.delete(particle);
    }
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      this.removeParticle(particle);
    }
  }
}

