import { Graphics, Container } from 'pixi.js';
import { Point, EdgeInfo, EdgeSelectionRule, OrbitAlgorithm } from '../../types';
import { edgesEqual, getOtherPoint, pointsClose } from '../utils/geometry';
import { Grid } from '../grid';

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

  update(deltaTime: number, particleSpeed: number, gridWidth: number, gridHeight: number, grid: Grid, edgeSelectionRule: EdgeSelectionRule, mouseX: number, mouseY: number, cellStates: number[][], orbitDistance: number, orbitAlgorithm: OrbitAlgorithm): void {
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
        this.handleVertexArrival(particle, p2, grid, gridWidth, gridHeight, edgeSelectionRule, mouseX, mouseY, cellStates, orbitDistance, orbitAlgorithm);
      } else if (particle.progress <= 0) {
        // Reached p1
        this.handleVertexArrival(particle, p1, grid, gridWidth, gridHeight, edgeSelectionRule, mouseX, mouseY, cellStates, orbitDistance, orbitAlgorithm);
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
    grid: Grid,
    gridWidth: number,
    gridHeight: number,
    edgeSelectionRule: EdgeSelectionRule,
    mouseX: number,
    mouseY: number,
    cellStates: number[][],
    orbitDistance: number,
    orbitAlgorithm: OrbitAlgorithm
  ): void {
    // Find all edges connected to this vertex
    const connectedEdges = grid.getEdgesAtVertex(vertex, gridWidth, gridHeight);
    
    if (connectedEdges.length === 0) {
      // No edges found, remove particle
      this.removeParticle(particle);
      return;
    }
    
    let availableEdges: EdgeInfo[];
    let nextEdge: EdgeInfo;
    
    if (edgeSelectionRule === 'randomNoBacktrack' || edgeSelectionRule === 'highestEdgeDelta') {
      // Filter out the edge we're currently on (the one we just arrived from)
      availableEdges = connectedEdges.filter(edge => {
        if (!particle.currentEdge) return true;
        return !edgesEqual(particle.currentEdge, edge);
      });
      
      if (availableEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }
      
      if (edgeSelectionRule === 'highestEdgeDelta') {
        // Find edges with highest delta
        let maxDelta = -1;
        let bestEdges: EdgeInfo[] = [];
        
        for (const edge of availableEdges) {
          const delta = this.getEdgeDelta(edge, grid, cellStates, gridWidth, gridHeight);
          if (delta > maxDelta) {
            maxDelta = delta;
            bestEdges = [edge];
          } else if (delta === maxDelta) {
            bestEdges.push(edge);
          }
        }
        
        if (bestEdges.length > 0) {
          nextEdge = bestEdges[Math.floor(Math.random() * bestEdges.length)];
        } else {
          // Should not happen if availableEdges > 0
          nextEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        }
      } else {
        // Choose random edge
        nextEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
      }
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
        return !edgesEqual(particle.currentEdge, edge);
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
    } else if (edgeSelectionRule === 'orbitCursor') {
      // Find the edge that best matches the orbit distance
      if (connectedEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }

      const availableEdges = connectedEdges.filter(edge => {
        if (!particle.currentEdge) return true;
        return !edgesEqual(particle.currentEdge, edge);
      });

      if (availableEdges.length === 0) {
        this.removeParticle(particle);
        return;
      }

      const foundEdge = this.findOrbitEdge(
        vertex,
        availableEdges,
        mouseX,
        mouseY,
        orbitDistance,
        orbitAlgorithm
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
    const vertexIsP1 = pointsClose(vertex, nextP1, 0.01);
    
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

  private getEdgeDelta(edge: EdgeInfo, grid: Grid, cellStates: number[][], gridWidth: number, gridHeight: number): number {
    const p1 = edge.points[0];
    const p2 = edge.points[1];
    
    // Midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    
    // Vector
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    // Normal vector (normalized)
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;
    
    const nx = -dy / length;
    const ny = dx / length;
    
    // Sample points on both sides
    const epsilon = 2; // Small offset
    const sample1 = { x: midX + nx * epsilon, y: midY + ny * epsilon };
    const sample2 = { x: midX - nx * epsilon, y: midY - ny * epsilon };
    
    const cell1 = grid.pixelToCell(sample1);
    const cell2 = grid.pixelToCell(sample2);
    
    let state1 = 0;
    let state2 = 0;
    
    if (cell1 && cell1.col >= 0 && cell1.col < gridWidth && cell1.row >= 0 && cell1.row < gridHeight) {
      state1 = cellStates[cell1.row][cell1.col];
    }
    
    if (cell2 && cell2.col >= 0 && cell2.col < gridWidth && cell2.row >= 0 && cell2.row < gridHeight) {
      state2 = cellStates[cell2.row][cell2.col];
    }
    
    return Math.abs(state1 - state2);
  }


  private findTurnEdge(
    currentEdge: EdgeInfo,
    vertex: Point,
    connectedEdges: EdgeInfo[],
    clockwise: boolean
  ): EdgeInfo | null {
    // Calculate the angle of the incoming edge (from vertex, pointing away from vertex)
    const otherPoint = getOtherPoint(currentEdge, vertex);
    
    // Calculate angle of incoming edge (from vertex to other point)
    const incomingAngle = Math.atan2(otherPoint.y - vertex.y, otherPoint.x - vertex.x);
    
    // Calculate angles of all outgoing edges
    const edgeAngles: Array<{ edge: EdgeInfo; angle: number; relativeAngle: number }> = [];
    
    for (const edge of connectedEdges) {
      // Skip the current edge
      const isCurrentEdge = edgesEqual(currentEdge, edge);
      
      if (isCurrentEdge) continue;
      
      // Find the other endpoint (not the vertex)
      const edgeOtherPoint = getOtherPoint(edge, vertex);
      
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
      const otherPoint = getOtherPoint(edge, vertex);
      
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

  private findOrbitEdge(
    vertex: Point,
    connectedEdges: EdgeInfo[],
    mouseX: number,
    mouseY: number,
    orbitDistance: number,
    orbitAlgorithm: OrbitAlgorithm
  ): EdgeInfo | null {
    if (connectedEdges.length === 0) return null;
    
    let bestEdge: EdgeInfo | null = null;
    let bestDelta = Infinity;
    
    for (const edge of connectedEdges) {
      const otherPoint = getOtherPoint(edge, vertex);
      const targetPoint = orbitAlgorithm === 'gradient'
        ? this.getOrbitGradientPoint(vertex, otherPoint)
        : otherPoint;
      const distToCursor = Math.sqrt((mouseX - targetPoint.x) ** 2 + (mouseY - targetPoint.y) ** 2);
      const delta = Math.abs(distToCursor - orbitDistance);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestEdge = edge;
      }
    }
    
    return bestEdge;
  }

  private getOrbitGradientPoint(start: Point, end: Point): Point {
    const epsilon = 0.1;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: start.x, y: start.y };
    return {
      x: start.x + (dx / len) * epsilon,
      y: start.y + (dy / len) * epsilon,
    };
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
