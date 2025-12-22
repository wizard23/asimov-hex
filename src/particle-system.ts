import { Graphics, Container } from 'pixi.js';
import { Point, EdgeInfo, GridType } from './types';

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
    graphics.circle(0, 0, 3);
    graphics.fill(0x00ff00);
    graphics.x = particle.x;
    graphics.y = particle.y;
    this.particleContainer.addChild(graphics);
    this.particleGraphics.set(particle, graphics);
  }

  update(deltaTime: number, particleSpeed: number, gridScale: number, gridRenderer: any, gridWidth: number, gridHeight: number, gridType: GridType): void {
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
      
      // Check if reached vertex
      if (particle.progress >= 1) {
        // Reached p2
        this.handleVertexArrival(particle, p2, gridRenderer, gridWidth, gridHeight, gridType, gridScale);
      } else if (particle.progress <= 0) {
        // Reached p1
        this.handleVertexArrival(particle, p1, gridRenderer, gridWidth, gridHeight, gridType, gridScale);
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
    gridScale: number
  ): void {
    // Find all edges connected to this vertex
    const connectedEdges = gridRenderer.getEdgesAtVertex(vertex, gridWidth, gridHeight, gridType, gridScale);
    
    // Filter out the edge we came from
    const availableEdges = connectedEdges.filter(edge => {
      if (!particle.previousEdge) return true;
      // Check if this edge is the same as previous edge
      const prevP1 = particle.previousEdge.points[0];
      const prevP2 = particle.previousEdge.points[1];
      const currP1 = edge.points[0];
      const currP2 = edge.points[1];
      
      // Check if edges are the same (same two points)
      const sameEdge = (
        (this.pointsEqual(prevP1, currP1) && this.pointsEqual(prevP2, currP2)) ||
        (this.pointsEqual(prevP1, currP2) && this.pointsEqual(prevP2, currP1))
      );
      
      return !sameEdge;
    });
    
    if (availableEdges.length === 0) {
      // No available edges, remove particle
      this.removeParticle(particle);
      return;
    }
    
    // Choose random edge
    const nextEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    
    // Determine direction on new edge (toward the vertex we're at)
    const nextP1 = nextEdge.points[0];
    const towardP1 = this.pointsEqual(vertex, nextP1);
    
    particle.previousEdge = particle.currentEdge;
    particle.currentEdge = nextEdge;
    particle.direction = towardP1 ? -1 : 1;
    particle.progress = towardP1 ? 0 : 1;
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
    const epsilon = 0.001;
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

