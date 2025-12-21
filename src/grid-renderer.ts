import { Graphics, Container } from 'pixi.js';
import { GridType, EdgeInfo, CellInfo } from './types';
import { colorToHex } from './color-utils';

export class GridRenderer {
  render(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    gridType: GridType,
    scale: number,
    cellStates: number[][],
    palette: Record<number, string>,
    edgeColor: string
  ) {
    switch (gridType) {
      case 'squares':
        this.renderSquares(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor);
        break;
      case 'hexagons':
        this.renderHexagons(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor);
        break;
      case 'triangles':
        this.renderTriangles(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor);
        break;
    }
  }

  private renderSquares(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    scale: number,
    cellStates: number[][],
    palette: Record<number, string>,
    edgeColor: string
  ) {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * scale;
        const y = row * scale;
        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');

        // Draw cell
        const cell = new Graphics();
        cell.rect(x, y, scale, scale);
        cell.fill(color);
        container.addChild(cell);

        // Draw edges
        const edges = new Graphics();
        edges.moveTo(x, y);
        edges.lineTo(x + scale, y);
        edges.lineTo(x + scale, y + scale);
        edges.lineTo(x, y + scale);
        edges.lineTo(x, y);
        edges.stroke({ color: colorToHex(edgeColor), width: 1 });
        edgeContainer.addChild(edges);
      }
    }
  }

  private renderHexagons(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    scale: number,
    cellStates: number[][],
    palette: Record<number, string>,
    edgeColor: string
  ) {
    // For flat-top hexagons, spacing calculations:
    // Horizontal spacing between centers: scale * sqrt(3)
    // Vertical spacing between centers: scale * 1.5
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Offset every other row by half the horizontal spacing
        const offsetX = (row % 2) * (hexSpacingX / 2);
        const centerX = col * hexSpacingX + offsetX;
        const centerY = row * hexSpacingY;

        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');

        // Draw hexagon centered at (centerX, centerY)
        const hex = this.createHexagonCentered(centerX, centerY, scale);
        hex.fill(color);
        container.addChild(hex);

        // Draw edges
        const edges = this.createHexagonCentered(centerX, centerY, scale);
        edges.stroke({ color: colorToHex(edgeColor), width: 1 });
        edgeContainer.addChild(edges);
      }
    }
  }

  private renderTriangles(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    scale: number,
    cellStates: number[][],
    palette: Record<number, string>,
    edgeColor: string
  ) {
    const triangleHeight = scale * Math.sqrt(3) / 2;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * scale * 0.5;
        const y = row * triangleHeight;
        const isUpward = (row + col) % 2 === 0;

        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');

        // Draw triangle
        const triangle = this.createTriangle(x, y, scale, isUpward);
        triangle.fill(color);
        container.addChild(triangle);

        // Draw edges
        const edges = this.createTriangle(x, y, scale, isUpward);
        edges.stroke({ color: colorToHex(edgeColor), width: 1 });
        edgeContainer.addChild(edges);
      }
    }
  }

  private createHexagon(x: number, y: number, radius: number): Graphics {
    // Legacy function - treats x,y as top-left of bounding box
    const graphics = new Graphics();
    const centerX = x + radius;
    const centerY = y + radius * Math.sqrt(3) / 2;

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = centerX + radius * Math.cos(angle);
      const py = centerY + radius * Math.sin(angle);
      if (i === 0) {
        graphics.moveTo(px, py);
      } else {
        graphics.lineTo(px, py);
      }
    }
    graphics.closePath();
    return graphics;
  }

  private createHexagonCentered(centerX: number, centerY: number, radius: number): Graphics {
    // Creates a flat-top hexagon centered at (centerX, centerY)
    const graphics = new Graphics();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = centerX + radius * Math.cos(angle);
      const py = centerY + radius * Math.sin(angle);
      if (i === 0) {
        graphics.moveTo(px, py);
      } else {
        graphics.lineTo(px, py);
      }
    }
    graphics.closePath();
    return graphics;
  }

  private createTriangle(x: number, y: number, sideLength: number, isUpward: boolean): Graphics {
    const graphics = new Graphics();
    const height = sideLength * Math.sqrt(3) / 2;
    const centerX = x + sideLength / 2;
    const centerY = y + height / 2;

    if (isUpward) {
      graphics.moveTo(centerX, centerY - height / 2);
      graphics.lineTo(centerX - sideLength / 2, centerY + height / 2);
      graphics.lineTo(centerX + sideLength / 2, centerY + height / 2);
    } else {
      graphics.moveTo(centerX - sideLength / 2, centerY - height / 2);
      graphics.lineTo(centerX + sideLength / 2, centerY - height / 2);
      graphics.lineTo(centerX, centerY + height / 2);
    }
    graphics.closePath();
    return graphics;
  }

  getCellAt(
    x: number,
    y: number,
    width: number,
    height: number,
    gridType: GridType,
    scale: number
  ): CellInfo | null {
    switch (gridType) {
      case 'squares':
        return this.getSquareCellAt(x, y, width, height, scale);
      case 'hexagons':
        return this.getHexagonCellAt(x, y, width, height, scale);
      case 'triangles':
        return this.getTriangleCellAt(x, y, width, height, scale);
    }
  }

  private getSquareCellAt(x: number, y: number, width: number, height: number, scale: number): CellInfo | null {
    const col = Math.floor(x / scale);
    const row = Math.floor(y / scale);
    if (col >= 0 && col < width && row >= 0 && row < height) {
      return { type: 'cell', row, col };
    }
    return null;
  }

  private getHexagonCellAt(x: number, y: number, width: number, height: number, scale: number): CellInfo | null {
    // Use the same spacing calculations as rendering
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;
    
    // Brute force: check all hexagons to find which one contains the point
    let closestHex: CellInfo | null = null;
    let minDistance = Infinity;
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const offsetX = (row % 2) * (hexSpacingX / 2);
        const centerX = col * hexSpacingX + offsetX;
        const centerY = row * hexSpacingY;
        
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < scale && distance < minDistance) {
          minDistance = distance;
          closestHex = { type: 'cell', row, col };
        }
      }
    }
    
    return closestHex;
  }

  private getTriangleCellAt(x: number, y: number, width: number, height: number, scale: number): CellInfo | null {
    const triangleHeight = scale * Math.sqrt(3) / 2;
    
    // Calculate approximate row and col
    const approxRow = Math.floor(y / triangleHeight);
    const approxCol = Math.floor(x / (scale * 0.5));
    
    // Check the cell and its neighbors (triangles can overlap in coordinate space)
    const candidates = [
      { row: approxRow, col: approxCol },
      { row: approxRow, col: approxCol - 1 },
      { row: approxRow, col: approxCol + 1 },
      { row: approxRow - 1, col: approxCol },
      { row: approxRow - 1, col: approxCol - 1 },
      { row: approxRow - 1, col: approxCol + 1 },
      { row: approxRow + 1, col: approxCol },
      { row: approxRow + 1, col: approxCol - 1 },
      { row: approxRow + 1, col: approxCol + 1 },
    ];
    
    for (const candidate of candidates) {
      if (candidate.col >= 0 && candidate.col < width && candidate.row >= 0 && candidate.row < height) {
        const cellX = candidate.col * scale * 0.5;
        const cellY = candidate.row * triangleHeight;
        const isUpward = (candidate.row + candidate.col) % 2 === 0;
        
        // Check if point is inside triangle
        if (this.isPointInTriangle(x, y, cellX, cellY, scale, isUpward)) {
          return { type: 'cell', row: candidate.row, col: candidate.col };
        }
      }
    }
    return null;
  }

  private isPointInTriangle(px: number, py: number, x: number, y: number, sideLength: number, isUpward: boolean): boolean {
    const height = sideLength * Math.sqrt(3) / 2;
    const centerX = x + sideLength / 2;
    const centerY = y + height / 2;

    let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
    
    if (isUpward) {
      v1x = centerX; v1y = centerY - height / 2;
      v2x = centerX - sideLength / 2; v2y = centerY + height / 2;
      v3x = centerX + sideLength / 2; v3y = centerY + height / 2;
    } else {
      v1x = centerX - sideLength / 2; v1y = centerY - height / 2;
      v2x = centerX + sideLength / 2; v2y = centerY - height / 2;
      v3x = centerX; v3y = centerY + height / 2;
    }

    const d1 = this.sign(px, py, v1x, v1y, v2x, v2y);
    const d2 = this.sign(px, py, v2x, v2y, v3x, v3y);
    const d3 = this.sign(px, py, v3x, v3y, v1x, v1y);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
  }

  private sign(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): number {
    return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  }

  getEdgeAt(
    x: number,
    y: number,
    width: number,
    height: number,
    gridType: GridType,
    scale: number
  ): EdgeInfo | null {
    switch (gridType) {
      case 'squares':
        return this.getSquareEdgeAt(x, y, width, height, scale);
      case 'hexagons':
        return this.getHexagonEdgeAt(x, y, width, height, scale);
      case 'triangles':
        return this.getTriangleEdgeAt(x, y, width, height, scale);
    }
  }

  private getSquareEdgeAt(x: number, y: number, width: number, height: number, scale: number): EdgeInfo | null {
    const col = Math.floor(x / scale);
    const row = Math.floor(y / scale);
    const localX = x - col * scale;
    const localY = y - row * scale;
    const threshold = 5; // pixels

    if (col >= 0 && col < width && row >= 0 && row < height) {
      // Check top edge
      if (localY < threshold && row > 0) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: row * scale },
            { x: (col + 1) * scale, y: row * scale }
          ]
        };
      }
      // Check bottom edge
      if (localY > scale - threshold && row < height - 1) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: (row + 1) * scale },
            { x: (col + 1) * scale, y: (row + 1) * scale }
          ]
        };
      }
      // Check left edge
      if (localX < threshold && col > 0) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: row * scale },
            { x: col * scale, y: (row + 1) * scale }
          ]
        };
      }
      // Check right edge
      if (localX > scale - threshold && col < width - 1) {
        return {
          type: 'edge',
          points: [
            { x: (col + 1) * scale, y: row * scale },
            { x: (col + 1) * scale, y: (row + 1) * scale }
          ]
        };
      }
    }
    return null;
  }

  private getHexagonEdgeAt(x: number, y: number, width: number, height: number, scale: number): EdgeInfo | null {
    // Use the same spacing calculations as rendering
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;
    
    let minDist = Infinity;
    let closestEdge = null;

    // Check all hexagons to find the closest edge
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const offsetX = (row % 2) * (hexSpacingX / 2);
        const centerX = col * hexSpacingX + offsetX;
        const centerY = row * hexSpacingY;
        
        // Check all 6 edges of this hexagon
        const edges = [
          { angle: -Math.PI / 6, index: 0 },
          { angle: Math.PI / 6, index: 1 },
          { angle: Math.PI / 2, index: 2 },
          { angle: 5 * Math.PI / 6, index: 3 },
          { angle: 7 * Math.PI / 6, index: 4 },
          { angle: -Math.PI / 2, index: 5 },
        ];

        for (let i = 0; i < edges.length; i++) {
          const angle1 = edges[i].angle;
          const angle2 = edges[(i + 1) % 6].angle;
          const p1x = centerX + scale * Math.cos(angle1);
          const p1y = centerY + scale * Math.sin(angle1);
          const p2x = centerX + scale * Math.cos(angle2);
          const p2y = centerY + scale * Math.sin(angle2);
          
          const dist = this.distanceToLineSegment(x, y, p1x, p1y, p2x, p2y);
          if (dist < minDist && dist < 10) {
            minDist = dist;
            closestEdge = { points: [{ x: p1x, y: p1y }, { x: p2x, y: p2y }] };
          }
        }
      }
    }

    return closestEdge ? { type: 'edge', points: closestEdge.points } : null;
  }

  private getTriangleEdgeAt(x: number, y: number, width: number, height: number, scale: number): EdgeInfo | null {
    const triangleHeight = scale * Math.sqrt(3) / 2;
    const row = Math.floor(y / triangleHeight);
    const col = Math.floor(x / (scale * 0.5));
    
    if (col >= 0 && col < width && row >= 0 && row < height) {
      const cellX = col * scale * 0.5;
      const cellY = row * triangleHeight;
      const isUpward = (row + col) % 2 === 0;
      const height = scale * Math.sqrt(3) / 2;
      const centerX = cellX + scale / 2;
      const centerY = cellY + height / 2;

      let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
      
      if (isUpward) {
        v1x = centerX; v1y = centerY - height / 2;
        v2x = centerX - scale / 2; v2y = centerY + height / 2;
        v3x = centerX + scale / 2; v3y = centerY + height / 2;
      } else {
        v1x = centerX - scale / 2; v1y = centerY - height / 2;
        v2x = centerX + scale / 2; v2y = centerY - height / 2;
        v3x = centerX; v3y = centerY + height / 2;
      }

      const edges = [
        [{ x: v1x, y: v1y }, { x: v2x, y: v2y }],
        [{ x: v2x, y: v2y }, { x: v3x, y: v3y }],
        [{ x: v3x, y: v3y }, { x: v1x, y: v1y }],
      ];

      let minDist = Infinity;
      let closestEdge = null;

      for (const edge of edges) {
        const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
        if (dist < minDist && dist < 10) {
          minDist = dist;
          closestEdge = edge;
        }
      }

      return closestEdge ? { type: 'edge', points: closestEdge } : null;
    }
    return null;
  }

  private distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  drawEdge(edgeInfo: EdgeInfo, color: string): Graphics {
    const graphics = new Graphics();
    graphics.moveTo(edgeInfo.points[0].x, edgeInfo.points[0].y);
    graphics.lineTo(edgeInfo.points[1].x, edgeInfo.points[1].y);
    graphics.stroke({ color: colorToHex(color), width: 3 });
    return graphics;
  }
}

