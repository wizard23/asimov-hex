import { Graphics, Container, Text } from 'pixi.js';
import { GridType, EdgeInfo, CellInfo, Point } from './types';
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
    edgeColor: string,
    showCoordinates: boolean = false
  ) {
    switch (gridType) {
      case 'squares':
        this.renderSquares(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor, showCoordinates);
        break;
      case 'hexagons':
        this.renderHexagons(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor, showCoordinates);
        break;
      case 'triangles':
        this.renderTriangles(container, edgeContainer, width, height, scale, cellStates, palette, edgeColor, showCoordinates);
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
    edgeColor: string,
    showCoordinates: boolean
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

        // Draw coordinates if enabled (add after cell so it's on top)
        if (showCoordinates) {
          const coordText = new Text({
            text: `${col},${row}`,
            style: {
              fontSize: Math.max(8, scale / 4),
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 2 },
              align: 'center',
            },
          });
          coordText.anchor.set(0.5);
          coordText.x = x + scale / 2;
          coordText.y = y + scale / 2;
          container.addChild(coordText);
        }
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
    edgeColor: string,
    showCoordinates: boolean
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

        // Draw coordinates if enabled (add after hex so it's on top)
        if (showCoordinates) {
          const coordText = new Text({
            text: `${col},${row}`,
            style: {
              fontSize: Math.max(8, scale / 4),
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 2 },
              align: 'center',
            },
          });
          coordText.anchor.set(0.5);
          coordText.x = centerX;
          coordText.y = centerY;
          container.addChild(coordText);
        }
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
    edgeColor: string,
    showCoordinates: boolean
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

        // Draw coordinates if enabled (add after triangle so it's on top)
        if (showCoordinates) {
          const triHeight = scale * Math.sqrt(3) / 2;
          const centerX = x + scale / 2;
          const centerY = y + triHeight / 2;
          
          const coordText = new Text({
            text: `${col},${row}`,
            style: {
              fontSize: Math.max(6, scale / 5),
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 2 },
              align: 'center',
            },
          });
          coordText.anchor.set(0.5);
          coordText.x = centerX;
          coordText.y = centerY;
          container.addChild(coordText);
        }
      }
    }
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

    // Check if we're in a valid cell or just outside the grid boundaries
    const inCell = col >= 0 && col < width && row >= 0 && row < height;
    const onRightBoundary = col === width && row >= 0 && row < height;
    const onBottomBoundary = row === height && col >= 0 && col < width;
    const onTopBoundary = row === -1 && col >= 0 && col < width;
    const onLeftBoundary = col === -1 && row >= 0 && row < height;

    if (inCell) {
      // Check top edge (allow all rows, including boundary)
      if (localY < threshold) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: row * scale },
            { x: (col + 1) * scale, y: row * scale }
          ]
        };
      }
      // Check bottom edge (allow all rows, including boundary)
      if (localY > scale - threshold) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: (row + 1) * scale },
            { x: (col + 1) * scale, y: (row + 1) * scale }
          ]
        };
      }
      // Check left edge (allow all cols, including boundary)
      if (localX < threshold) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: row * scale },
            { x: col * scale, y: (row + 1) * scale }
          ]
        };
      }
      // Check right edge (allow all cols, including boundary)
      if (localX > scale - threshold) {
        return {
          type: 'edge',
          points: [
            { x: (col + 1) * scale, y: row * scale },
            { x: (col + 1) * scale, y: (row + 1) * scale }
          ]
        };
      }
    } else if (onRightBoundary) {
      // Right boundary edge
      const localY = y - row * scale;
      if (localY >= 0 && localY <= scale) {
        return {
          type: 'edge',
          points: [
            { x: width * scale, y: row * scale },
            { x: width * scale, y: (row + 1) * scale }
          ]
        };
      }
    } else if (onBottomBoundary) {
      // Bottom boundary edge
      const localX = x - col * scale;
      if (localX >= 0 && localX <= scale) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: height * scale },
            { x: (col + 1) * scale, y: height * scale }
          ]
        };
      }
    } else if (onTopBoundary) {
      // Top boundary edge
      const localX = x - col * scale;
      if (localX >= 0 && localX <= scale) {
        return {
          type: 'edge',
          points: [
            { x: col * scale, y: 0 },
            { x: (col + 1) * scale, y: 0 }
          ]
        };
      }
    } else if (onLeftBoundary) {
      // Left boundary edge
      const localY = y - row * scale;
      if (localY >= 0 && localY <= scale) {
        return {
          type: 'edge',
          points: [
            { x: 0, y: row * scale },
            { x: 0, y: (row + 1) * scale }
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
    
    let minDist = Infinity;
    let closestEdge: [{ x: number; y: number }, { x: number; y: number }] | null = null;

    // Check the cell at the clicked position and neighboring cells
    // This ensures we catch edges shared between triangles and boundary edges
    const checkRows = [row - 1, row, row + 1].filter(r => r >= -1 && r <= height);
    const checkCols = [col - 1, col, col + 1].filter(c => c >= -1 && c <= width);

    for (const r of checkRows) {
      for (const c of checkCols) {
        // Skip if completely outside grid (but allow boundary checks)
        if (r < 0 || r >= height || c < 0 || c >= width) {
          // Check boundary edges
          if (r === -1 && c >= 0 && c < width) {
            // Top boundary - check top edge of first row
            const cellX = c * scale * 0.5;
            const isUpward = (0 + c) % 2 === 0;
            const centerX = cellX + scale / 2;
            const centerY = triangleHeight / 2;
            
            if (isUpward) {
              // Top vertex of upward triangle
              const v1x = centerX;
              const v1y = centerY - triangleHeight / 2;
              const v2x = centerX - scale / 2;
              const v2y = centerY + triangleHeight / 2;
              const v3x = centerX + scale / 2;
              const v3y = centerY + triangleHeight / 2;
              
              // Top edge (v1 to v2 or v1 to v3)
              const edge1: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v1x, y: v1y }, { x: v2x, y: v2y }];
              const edge2: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v1x, y: v1y }, { x: v3x, y: v3y }];
              
              for (const edge of [edge1, edge2]) {
                const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
                if (dist < minDist && dist < 10) {
                  minDist = dist;
                  closestEdge = edge;
                }
              }
            }
          } else if (r === height && c >= 0 && c < width) {
            // Bottom boundary - check bottom edge of last row
            const cellX = c * scale * 0.5;
            const cellY = (height - 1) * triangleHeight;
            const isUpward = ((height - 1) + c) % 2 === 0;
            const centerX = cellX + scale / 2;
            const centerY = cellY + triangleHeight / 2;
            
            if (!isUpward) {
              // Bottom vertex of downward triangle
              const v1x = centerX - scale / 2;
              const v1y = centerY - triangleHeight / 2;
              const v2x = centerX + scale / 2;
              const v2y = centerY - triangleHeight / 2;
              const v3x = centerX;
              const v3y = centerY + triangleHeight / 2;
              
              // Bottom edge (v3 to v1 or v3 to v2)
              const edge1: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v3x, y: v3y }, { x: v1x, y: v1y }];
              const edge2: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v3x, y: v3y }, { x: v2x, y: v2y }];
              
              for (const edge of [edge1, edge2]) {
                const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
                if (dist < minDist && dist < 10) {
                  minDist = dist;
                  closestEdge = edge;
                }
              }
            }
          } else if (c === -1 && r >= 0 && r < height) {
            // Left boundary - check left edge
            const cellX = 0;
            const cellY = r * triangleHeight;
            const isUpward = (r + 0) % 2 === 0;
            const centerX = cellX + scale / 2;
            const centerY = cellY + triangleHeight / 2;
            
            let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
            
            if (isUpward) {
              v1x = centerX; v1y = centerY - triangleHeight / 2;
              v2x = centerX - scale / 2; v2y = centerY + triangleHeight / 2;
              v3x = centerX + scale / 2; v3y = centerY + triangleHeight / 2;
              // Left edge: v1 to v2
              const edge: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v1x, y: v1y }, { x: v2x, y: v2y }];
              const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
              if (dist < minDist && dist < 10) {
                minDist = dist;
                closestEdge = edge;
              }
            } else {
              v1x = centerX - scale / 2; v1y = centerY - triangleHeight / 2;
              v2x = centerX + scale / 2; v2y = centerY - triangleHeight / 2;
              v3x = centerX; v3y = centerY + triangleHeight / 2;
              // Left edge: v1 to v3
              const edge: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v1x, y: v1y }, { x: v3x, y: v3y }];
              const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
              if (dist < minDist && dist < 10) {
                minDist = dist;
                closestEdge = edge;
              }
            }
          } else if (c === width && r >= 0 && r < height) {
            // Right boundary - check right edge
            const cellX = (width - 1) * scale * 0.5;
            const cellY = r * triangleHeight;
            const isUpward = (r + (width - 1)) % 2 === 0;
            const centerX = cellX + scale / 2;
            const centerY = cellY + triangleHeight / 2;
            
            let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
            
            if (isUpward) {
              v1x = centerX; v1y = centerY - triangleHeight / 2;
              v2x = centerX - scale / 2; v2y = centerY + triangleHeight / 2;
              v3x = centerX + scale / 2; v3y = centerY + triangleHeight / 2;
              // Right edge: v1 to v3
              const edge: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v1x, y: v1y }, { x: v3x, y: v3y }];
              const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
              if (dist < minDist && dist < 10) {
                minDist = dist;
                closestEdge = edge;
              }
            } else {
              v1x = centerX - scale / 2; v1y = centerY - triangleHeight / 2;
              v2x = centerX + scale / 2; v2y = centerY - triangleHeight / 2;
              v3x = centerX; v3y = centerY + triangleHeight / 2;
              // Right edge: v2 to v3
              const edge: [{ x: number; y: number }, { x: number; y: number }] = [{ x: v2x, y: v2y }, { x: v3x, y: v3y }];
              const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
              if (dist < minDist && dist < 10) {
                minDist = dist;
                closestEdge = edge;
              }
            }
          }
          continue;
        }

        // Check edges of this triangle
        const cellX = c * scale * 0.5;
        const cellY = r * triangleHeight;
        const isUpward = (r + c) % 2 === 0;
        const centerX = cellX + scale / 2;
        const centerY = cellY + triangleHeight / 2;

        let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
        
        if (isUpward) {
          v1x = centerX; v1y = centerY - triangleHeight / 2;
          v2x = centerX - scale / 2; v2y = centerY + triangleHeight / 2;
          v3x = centerX + scale / 2; v3y = centerY + triangleHeight / 2;
        } else {
          v1x = centerX - scale / 2; v1y = centerY - triangleHeight / 2;
          v2x = centerX + scale / 2; v2y = centerY - triangleHeight / 2;
          v3x = centerX; v3y = centerY + triangleHeight / 2;
        }

        const edges: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
          [{ x: v1x, y: v1y }, { x: v2x, y: v2y }],
          [{ x: v2x, y: v2y }, { x: v3x, y: v3y }],
          [{ x: v3x, y: v3y }, { x: v1x, y: v1y }],
        ];

        for (const edge of edges) {
          const dist = this.distanceToLineSegment(x, y, edge[0].x, edge[0].y, edge[1].x, edge[1].y);
          if (dist < minDist && dist < 10) {
            minDist = dist;
            closestEdge = edge;
          }
        }
      }
    }

    return closestEdge ? { type: 'edge', points: closestEdge } : null;
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

  getEdgesAtVertex(vertex: Point, width: number, height: number, gridType: GridType, scale: number): EdgeInfo[] {
    switch (gridType) {
      case 'squares':
        return this.getSquareEdgesAtVertex(vertex, width, height, scale);
      case 'hexagons':
        return this.getHexagonEdgesAtVertex(vertex, width, height, scale);
      case 'triangles':
        return this.getTriangleEdgesAtVertex(vertex, width, height, scale);
      default:
        return [];
    }
  }

  private getSquareEdgesAtVertex(vertex: Point, width: number, height: number, scale: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.001;
    
    // Find which grid point this vertex is at
    let foundRow = -1;
    let foundCol = -1;
    
    for (let row = 0; row <= height; row++) {
      for (let col = 0; col <= width; col++) {
        const x = col * scale;
        const y = row * scale;
        
        if (Math.abs(vertex.x - x) < epsilon && Math.abs(vertex.y - y) < epsilon) {
          foundRow = row;
          foundCol = col;
          break;
        }
      }
      if (foundRow >= 0) break;
    }
    
    if (foundRow < 0 || foundCol < 0) return [];
    
    // Add horizontal edges (left and right)
    if (foundCol > 0) {
      // Left edge
      edges.push({
        type: 'edge',
        points: [
          { x: (foundCol - 1) * scale, y: foundRow * scale },
          { x: foundCol * scale, y: foundRow * scale }
        ]
      });
    }
    if (foundCol < width) {
      // Right edge
      edges.push({
        type: 'edge',
        points: [
          { x: foundCol * scale, y: foundRow * scale },
          { x: (foundCol + 1) * scale, y: foundRow * scale }
        ]
      });
    }
    
    // Add vertical edges (up and down)
    if (foundRow > 0) {
      // Top edge (up)
      edges.push({
        type: 'edge',
        points: [
          { x: foundCol * scale, y: (foundRow - 1) * scale },
          { x: foundCol * scale, y: foundRow * scale }
        ]
      });
    }
    if (foundRow < height) {
      // Bottom edge (down)
      edges.push({
        type: 'edge',
        points: [
          { x: foundCol * scale, y: foundRow * scale },
          { x: foundCol * scale, y: (foundRow + 1) * scale }
        ]
      });
    }
    
    return edges;
  }

  private getHexagonEdgesAtVertex(vertex: Point, width: number, height: number, scale: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.001;
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;
    
    // Check all hexagons
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const offsetX = (row % 2) * (hexSpacingX / 2);
        const centerX = col * hexSpacingX + offsetX;
        const centerY = row * hexSpacingY;
        
        // Check all 6 vertices of this hexagon
        const angles = [
          -Math.PI / 6, Math.PI / 6, Math.PI / 2,
          5 * Math.PI / 6, 7 * Math.PI / 6, -Math.PI / 2
        ];
        
        for (let i = 0; i < angles.length; i++) {
          const vx = centerX + scale * Math.cos(angles[i]);
          const vy = centerY + scale * Math.sin(angles[i]);
          
          if (Math.abs(vertex.x - vx) < epsilon && Math.abs(vertex.y - vy) < epsilon) {
            // This vertex matches, add the two edges connected to it
            const angle2 = angles[(i + 1) % 6];
            const angle3 = angles[(i + 5) % 6];
            
            edges.push({
              type: 'edge',
              points: [
                { x: vx, y: vy },
                { x: centerX + scale * Math.cos(angle2), y: centerY + scale * Math.sin(angle2) }
              ]
            });
            
            edges.push({
              type: 'edge',
              points: [
                { x: vx, y: vy },
                { x: centerX + scale * Math.cos(angle3), y: centerY + scale * Math.sin(angle3) }
              ]
            });
          }
        }
      }
    }
    
    return this.removeDuplicateEdges(edges);
  }

  private getTriangleEdgesAtVertex(vertex: Point, width: number, height: number, scale: number): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const epsilon = 0.001;
    const triangleHeight = scale * Math.sqrt(3) / 2;
    
    // Check all triangles using the same coordinate system as getTriangleEdgeAt
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cellX = col * scale * 0.5;
        const cellY = row * triangleHeight;
        const isUpward = (row + col) % 2 === 0;
        const h = scale * Math.sqrt(3) / 2;
        const centerX = cellX + scale / 2;
        const centerY = cellY + h / 2;

        let v1x: number, v1y: number, v2x: number, v2y: number, v3x: number, v3y: number;
        
        if (isUpward) {
          v1x = centerX; v1y = centerY - h / 2;
          v2x = centerX - scale / 2; v2y = centerY + h / 2;
          v3x = centerX + scale / 2; v3y = centerY + h / 2;
        } else {
          v1x = centerX - scale / 2; v1y = centerY - h / 2;
          v2x = centerX + scale / 2; v2y = centerY - h / 2;
          v3x = centerX; v3y = centerY + h / 2;
        }
        
        const triangleVerts = [
          { x: v1x, y: v1y },
          { x: v2x, y: v2y },
          { x: v3x, y: v3y }
        ];
        
        // Check if vertex matches any triangle vertex
        for (let i = 0; i < triangleVerts.length; i++) {
          const v = triangleVerts[i];
          if (Math.abs(vertex.x - v.x) < epsilon && Math.abs(vertex.y - v.y) < epsilon) {
            // Add edges connected to this vertex (matching getTriangleEdgeAt format)
            const next = (i + 1) % 3;
            const prev = (i + 2) % 3;
            
            edges.push({
              type: 'edge',
              points: [v, triangleVerts[next]]
            });
            edges.push({
              type: 'edge',
              points: [v, triangleVerts[prev]]
            });
          }
        }
      }
    }
    
    return this.removeDuplicateEdges(edges);
  }

  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const unique: EdgeInfo[] = [];
    const epsilon = 0.001;
    
    for (const edge of edges) {
      let isDuplicate = false;
      for (const existing of unique) {
        const p1Match = (
          (Math.abs(edge.points[0].x - existing.points[0].x) < epsilon &&
           Math.abs(edge.points[0].y - existing.points[0].y) < epsilon &&
           Math.abs(edge.points[1].x - existing.points[1].x) < epsilon &&
           Math.abs(edge.points[1].y - existing.points[1].y) < epsilon) ||
          (Math.abs(edge.points[0].x - existing.points[1].x) < epsilon &&
           Math.abs(edge.points[0].y - existing.points[1].y) < epsilon &&
           Math.abs(edge.points[1].x - existing.points[0].x) < epsilon &&
           Math.abs(edge.points[1].y - existing.points[0].y) < epsilon)
        );
        if (p1Match) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        unique.push(edge);
      }
    }
    
    return unique;
  }
}

