import { Graphics, Container } from 'pixi.js';
import { Point, EdgeInfo, GridType } from './types';

type EdgeSelectionRule = 'randomNoBacktrack' | 'randomWithBacktrack' | 'clockwise' | 'counterClockwise' | 'followCursor' | 'avoidCursor';

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

  update(deltaTime: number, particleSpeed: number, gridScale: number, gridRenderer: any, gridWidth: number, gridHeight: number, gridType: GridType, edgeSelectionRule: EdgeSelectionRule, mouseX: number, mouseY: number): void {
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
        this.handleVertexArrival(particle, p2, gridRenderer, gridWidth, gridHeight, gridType, gridScale, edgeSelectionRule, mouseX, mouseY);
      } else if (particle.progress <= 0) {
        // Reached p1
        this.handleVertexArrival(particle, p1, gridRenderer, gridWidth, gridHeight, gridType, gridScale, edgeSelectionRule, mouseX, mouseY);
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
    edgeSelectionRule: EdgeSelectionRule,
    mouseX: number,
    mouseY: number
  ): void {
    // Find all edges connected to this vertex
    const connectedEdges = gridRenderer.getEdgesAtVertex(vertex, gridWidth, gridHeight, gridType, gridScale);
    
    if (connectedEdges.length === 0) {
      // No edges found, remove particle
      this.removeParticle(particle);
      return;
    }
    
    let availableEdges: EdgeInfo[];
    let nextEdge: EdgeInfo;
    
    if (edgeSelectionRule === 'randomNoBacktrack') {
      // Filter out the edge we're currently on (the one we just arrived from)
      availableEdges = connectedEdges.filter(edge => {
        if (!particle.currentEdge) return true;
        // Check if this edge is the same as the current edge we're on
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
      
      if (availableEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      
      // Choose random edge
      nextEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
    } else if (edgeSelectionRule === 'randomWithBacktrack') {
      // Allow all edges including the one we came from
      if (connectedEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      nextEdge = connectedEdges[Math.floor(Math.random() * connectedEdges.length)];
    } else if (edgeSelectionRule === 'clockwise' || edgeSelectionRule === 'counterClockwise') {
      // Find the edge that is clockwise or counter-clockwise from the current edge
      if (!particle.currentEdge) {
        // If no current edge, fall back to random
        if (connectedEdges.length === 0) {
          this.removeParticle(particle);
          return;
        }
        nextEdge = connectedEdges[Math.floor(Math.random() * connectedEdges.length)];
      } else {
        const foundEdge = this.findTurnEdge(
          particle.currentEdge,
          vertex,
          connectedEdges,
          edgeSelectionRule === 'clockwise'
        );
        
        if (!foundEdge) {
          // No valid turn found, remove particle
          this.removeParticle(particle);
          return;
        }
        nextEdge = foundEdge;
      }
    } else if (edgeSelectionRule === 'followCursor' || edgeSelectionRule === 'avoidCursor') {
      // Find the edge that minimizes or maximizes distance to cursor
      if (connectedEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      
      // Filter out current edge for follow/avoid cursor rules
      const availableEdges = connectedEdges.filter(edge => {
        if (!particle.currentEdge) return true;
        const currentP1 = particle.currentEdge.points[0];
        const currentP2 = particle.currentEdge.points[1];
        const edgeP1 = edge.points[0];
        const edgeP2 = edge.points[1];
        
        const sameEdge = (
          (this.pointsEqual(currentP1, edgeP1) && this.pointsEqual(currentP2, edgeP2)) ||
          (this.pointsEqual(currentP1, edgeP2) && this.pointsEqual(currentP2, edgeP1))
        );
        
        return !sameEdge;
      });
      
      if (availableEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      
      const foundEdge = this.findCursorEdge(
        vertex,
        availableEdges,
        mouseX,
        mouseY,
        edgeSelectionRule === 'followCursor'
      );
      
      if (!foundEdge) {
        this.removeParticle(particle);
        return;
      }
      nextEdge = foundEdge;
    } else {
      // Fallback to random
      if (connectedEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      nextEdge = connectedEdges[Math.floor(Math.random() * connectedEdges.length)];
    }
    
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

  private findTurnEdge(
    currentEdge: EdgeInfo,
    vertex: Point,
    connectedEdges: EdgeInfo[],
    clockwise: boolean
  ): EdgeInfo | null {
    // Calculate the angle of the incoming edge (from vertex, pointing away from vertex)
    const currentP1 = currentEdge.points[0];
    const currentP2 = currentEdge.points[1];
    
    // Find the other endpoint of the current edge (not the vertex)
    const otherPoint = this.pointsEqual(vertex, currentP1) ? currentP2 : currentP1;
    
    // Calculate angle of incoming edge (from vertex to other point)
    const incomingAngle = Math.atan2(otherPoint.y - vertex.y, otherPoint.x - vertex.x);
    
    // Calculate angles of all outgoing edges
    const edgeAngles: Array<{ edge: EdgeInfo; angle: number; relativeAngle: number }> = [];
    
    for (const edge of connectedEdges) {
      // Skip the current edge
      const edgeP1 = edge.points[0];
      const edgeP2 = edge.points[1];
      const isCurrentEdge = (
        (this.pointsEqual(currentP1, edgeP1) && this.pointsEqual(currentP2, edgeP2)) ||
        (this.pointsEqual(currentP1, edgeP2) && this.pointsEqual(currentP2, edgeP1))
      );
      
      if (isCurrentEdge) continue;
      
      // Find the other endpoint (not the vertex)
      const edgeOtherPoint = this.pointsEqual(vertex, edgeP1) ? edgeP2 : edgeP1;
      
      // Calculate angle from vertex to other point
      const angle = Math.atan2(edgeOtherPoint.y - vertex.y, edgeOtherPoint.x - vertex.x);
      
      // Calculate relative angle (difference from incoming angle, normalized to -π to π)
      let relativeAngle = angle - incomingAngle;
      
      // Normalize to -π to π
      while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
      while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
      
      edgeAngles.push({ edge, angle, relativeAngle });
    }
    
    if (edgeAngles.length === 0) return null;
    
    // Sort by relative angle
    if (clockwise) {
      // Clockwise: find the edge with the largest negative relative angle
      // If none, wrap around to the most positive (which is actually the next clockwise)
      edgeAngles.sort((a, b) => {
        // Prefer negative angles (clockwise in screen coordinates where y increases downward)
        if (a.relativeAngle < 0 && b.relativeAngle >= 0) return 1;
        if (a.relativeAngle >= 0 && b.relativeAngle < 0) return -1;
        // Both same sign, sort by magnitude (reverse for clockwise)
        return b.relativeAngle - a.relativeAngle;
      });
      
      // Find first negative angle, or if none, use the most positive (wraps around)
      const negativeAngle = edgeAngles.find(e => e.relativeAngle < 0);
      return negativeAngle ? negativeAngle.edge : edgeAngles[edgeAngles.length - 1].edge;
    } else {
      // Counter-clockwise: find the edge with the smallest positive relative angle
      // If none, wrap around to the most negative (which is actually the next counter-clockwise)
      edgeAngles.sort((a, b) => {
        // Prefer positive angles (counter-clockwise in screen coordinates where y increases downward)
        if (a.relativeAngle > 0 && b.relativeAngle <= 0) return -1;
        if (a.relativeAngle <= 0 && b.relativeAngle > 0) return 1;
        // Both same sign, sort by magnitude
        return a.relativeAngle - b.relativeAngle;
      });
      
      // Find first positive angle, or if none, use the most negative (wraps around)
      const positiveAngle = edgeAngles.find(e => e.relativeAngle > 0);
      return positiveAngle ? positiveAngle.edge : edgeAngles[edgeAngles.length - 1].edge;
    }
  }

  private findCursorEdge(
    vertex: Point,
    connectedEdges: EdgeInfo[],
    mouseX: number,
    mouseY: number,
    follow: boolean
  ): EdgeInfo | null {
    if (connectedEdges.length === 0) return null;
    
    let bestEdge: EdgeInfo | null = null;
    let bestDist = follow ? Infinity : -Infinity;
    
    for (const edge of connectedEdges) {
      // Find the other endpoint of the edge (not the vertex)
      const edgeP1 = edge.points[0];
      const edgeP2 = edge.points[1];
      const otherPoint = this.pointsEqual(vertex, edgeP1) ? edgeP2 : edgeP1;
      
      // Calculate distance from the other endpoint to cursor
      const distToCursor = Math.sqrt((mouseX - otherPoint.x) ** 2 + (mouseY - otherPoint.y) ** 2);
      
      // For follow: choose edge that minimizes distance to cursor
      // For avoid: choose edge that maximizes distance to cursor
      if (follow) {
        if (distToCursor < bestDist) {
          bestDist = distToCursor;
          bestEdge = edge;
        }
      } else {
        if (distToCursor > bestDist) {
          bestDist = distToCursor;
          bestEdge = edge;
        }
      }
    }
    
    return bestEdge;
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

