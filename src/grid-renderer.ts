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
    edgeWidth: number,
    visualizeEdgeDelta: boolean,
    edgePalette: Record<number, string>,
    showCoordinates: boolean = false
  ) {
    container.removeChildren();
    edgeContainer.removeChildren();

    const drawnEdges = new Set<string>(); // To prevent drawing duplicate internal edges

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const state = cellStates[row]?.[col] ?? 0;
        const fillColor = colorToHex(palette[state] || '#000000');

        // Draw cell fill
        const cellShape = this.createCellShape(gridType, col, row, scale);
        cellShape.fill(fillColor);
        container.addChild(cellShape);

        // Draw coordinates
        if (showCoordinates) {
          const center = this.getCellCenter(gridType, col, row, scale);
          this.drawCoordinates(container, `${col},${row}`, center.x, center.y, scale / 4);
        }

        // Draw edges
        const edgesForCurrentCell = this.getEdgesForCell(gridType, col, row, width, height, scale);
        
        for (const edge of edgesForCurrentCell) {
          // Create a unique key for each edge to prevent duplicates
          const p1 = edge.p1;
          const p2 = edge.p2;
          const key = (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y))
            ? `${p1.x},${p1.y}-${p2.x},${p2.y}`
            : `${p2.x},${p2.y}-${p1.x},${p1.y}`;

          if (drawnEdges.has(key)) {
            continue; // This edge has already been drawn from an adjacent cell
          }
          drawnEdges.add(key);

          let finalEdgeColor: string;
          if (visualizeEdgeDelta) {
            // Find the neighbor cell corresponding to this edge
            const neighborCell = this.getNeighborForEdge(gridType, col, row, edge, width, height, scale);
            const neighborState = (neighborCell && neighborCell.r >= 0 && neighborCell.r < height && neighborCell.c >= 0 && neighborCell.c < width) ? cellStates[neighborCell.r][neighborCell.c] : state;
            
            const delta = Math.abs(state - neighborState);
            finalEdgeColor = colorToHex(edgePalette[delta] || '#ffffff');
          } else {
            finalEdgeColor = colorToHex(edgeColor);
          }
          
          edgeContainer.addChild(new Graphics().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: finalEdgeColor, width: edgeWidth }));
        }
      }
    }
  }

  // --- Helper methods for creating shapes ---

  private createCellShape(gridType: GridType, col: number, row: number, scale: number): Graphics {
    const graphics = new Graphics();
    switch (gridType) {
      case 'squares':
        graphics.rect(col * scale, row * scale, scale, scale);
        break;
      case 'hexagons':
        const hexCenters = this.getHexagonCenter(col, row, scale);
        this.drawHexagon(graphics, hexCenters.x, hexCenters.y, scale);
        break;
      case 'triangles':
        const triPoints = this.getTrianglePointsAbsolute(col, row, scale);
        this.drawTriangle(graphics, triPoints);
        break;
    }
    return graphics;
  }

  private drawHexagon(graphics: Graphics, centerX: number, centerY: number, radius: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6; // Pointy-top vertices
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    }
    graphics.closePath();
  }

  private drawTriangle(graphics: Graphics, points: Point[]) {
    graphics.moveTo(points[0].x, points[0].y)
            .lineTo(points[1].x, points[1].y)
            .lineTo(points[2].x, points[2].y)
            .closePath();
  }

  private drawCoordinates(container: Container, text: string, x: number, y: number, fontSize: number) {
    const coordText = new Text({ text, style: { fontSize: Math.max(8, fontSize), fill: 0xffffff, stroke: { color: 0x000000, width: 2 }, align: 'center' } });
    coordText.anchor.set(0.5);
    coordText.position.set(x, y);
    container.addChild(coordText);
  }

  // --- Helper methods for geometry and neighbors ---

  private getCellCenter(gridType: GridType, col: number, row: number, scale: number): Point {
    switch (gridType) {
      case 'squares': return { x: col * scale + scale / 2, y: row * scale + scale / 2 };
      case 'hexagons': return this.getHexagonCenter(col, row, scale);
      case 'triangles': 
        const triangleHeight = scale * Math.sqrt(3) / 2;
        const x = col * scale * 0.5;
        const y = row * triangleHeight;
        return { x: x + scale / 2, y: y + triangleHeight / 2 };
    }
  }

  private getHexagonCenter(col: number, row: number, scale: number): Point {
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;
    const offsetX = (row % 2) * (hexSpacingX / 2);
    return { x: col * hexSpacingX + offsetX, y: row * hexSpacingY };
  }

  private getTrianglePointsAbsolute(col: number, row: number, scale: number): Point[] {
    const triangleHeight = scale * Math.sqrt(3) / 2;
    const x = col * scale * 0.5;
    const y = row * triangleHeight;
    const isUpward = (row + col) % 2 === 0;

    const centerX = x + scale / 2;
    const centerY = y + triangleHeight / 2;
    
    if (isUpward) {
      return [{ x: centerX, y: centerY - triangleHeight / 2 }, { x: centerX - scale / 2, y: centerY + triangleHeight / 2 }, { x: centerX + scale / 2, y: centerY + triangleHeight / 2 }];
    } else {
      return [{ x: centerX - scale / 2, y: centerY - triangleHeight / 2 }, { x: centerX + scale / 2, y: centerY - triangleHeight / 2 }, { x: centerX, y: centerY + triangleHeight / 2 }];
    }
  }

  private getEdgesForCell(gridType: GridType, col: number, row: number, width: number, height: number, scale: number): { p1: Point, p2: Point }[] {
    const edges: { p1: Point, p2: Point }[] = [];
    switch (gridType) {
      case 'squares':
        const x = col * scale;
        const y = row * scale;
        edges.push({ p1: {x,y}, p2: {x:x+scale, y} }); // Top
        edges.push({ p1: {x:x+scale, y}, p2: {x:x+scale, y:y+scale} }); // Right
        edges.push({ p1: {x:x+scale, y:y+scale}, p2: {x, y:y+scale} }); // Bottom
        edges.push({ p1: {x, y:y+scale}, p2: {x, y} }); // Left
        break;
      case 'hexagons':
        const hexCenters = this.getHexagonCenter(col, row, scale);
        const hexPoints = Array.from({length: 6}, (_, i) => {
          const angle = (Math.PI / 3) * i + Math.PI/6; // Pointy-top vertices
          return { x: hexCenters.x + scale * Math.cos(angle), y: hexCenters.y + scale * Math.sin(angle) };
        });
        for (let i = 0; i < 6; i++) {
          edges.push({ p1: hexPoints[i], p2: hexPoints[(i+1)%6] });
        }
        break;
      case 'triangles':
        const triPoints = this.getTrianglePointsAbsolute(col, row, scale);
        for (let i = 0; i < 3; i++) {
          edges.push({ p1: triPoints[i], p2: triPoints[(i+1)%3] });
        }
        break;
    }
    return edges;
  }

  private getNeighborForEdge(gridType: GridType, col: number, row: number, edge: {p1: Point, p2: Point}, width: number, height: number, scale: number): {c: number, r: number} | null {
    // This is a simplified approach. A robust implementation would map edge midpoints to adjacent cells.
    // For now, we'll return a representative neighbor for the purpose of delta calculation.
    switch (gridType) {
      case 'squares':
        const x = col * scale;
        const y = row * scale;
        const p1 = edge.p1;
        const p2 = edge.p2;

        // Top edge
        if (p1.y === y && p2.y === y && row > 0) return {c: col, r: row - 1};
        // Bottom edge
        if (p1.y === y + scale && p2.y === y + scale && row < height - 1) return {c: col, r: row + 1};
        // Left edge
        if (p1.x === x && p2.x === x && col > 0) return {c: col - 1, r: row};
        // Right edge
        if (p1.x === x + scale && p2.x === x + scale && col < width - 1) return {c: col + 1, r: row};
        break;
      case 'hexagons':
        const hexCenters = this.getHexagonCenter(col, row, scale);
        const hexPoints = Array.from({length: 6}, (_, i) => {
          const angle = (Math.PI / 3) * i + Math.PI/6; // Pointy-top vertices
          return { x: hexCenters.x + scale * Math.cos(angle), y: hexCenters.y + scale * Math.sin(angle) };
        });

        const neighbors = this.getHexagonNeighborsList(col, row);

        for(let i=0; i<6; i++) {
          const ep1 = hexPoints[i];
          const ep2 = hexPoints[(i+1)%6];
          
          const match1 = (Math.abs(ep1.x - edge.p1.x) < 0.1 && Math.abs(ep1.y - edge.p1.y) < 0.1 &&
                          Math.abs(ep2.x - edge.p2.x) < 0.1 && Math.abs(ep2.y - edge.p2.y) < 0.1);
          const match2 = (Math.abs(ep1.x - edge.p2.x) < 0.1 && Math.abs(ep1.y - edge.p2.y) < 0.1 &&
                          Math.abs(ep2.x - edge.p1.x) < 0.1 && Math.abs(ep2.y - ep1.y) < 0.1);

          if ( (match1 || match2) && neighbors[i].r >= 0 && neighbors[i].r < height && neighbors[i].c >= 0 && neighbors[i].c < width) {
            return neighbors[i];
          }
        }
        break;
      case 'triangles':
        const triPoints = this.getTrianglePointsAbsolute(col, row, scale);
        const triNeighbors = this.getTriangleNeighborsList(col, row);
        
        for(let i=0; i<3; i++) {
          const ep1 = triPoints[i];
          const ep2 = triPoints[(i+1)%3];
          
          const match1 = (Math.abs(ep1.x - edge.p1.x) < 0.1 && Math.abs(ep1.y - edge.p1.y) < 0.1 &&
                          Math.abs(ep2.x - edge.p2.x) < 0.1 && Math.abs(ep2.y - edge.p2.y) < 0.1);
          const match2 = (Math.abs(ep1.x - edge.p2.x) < 0.1 && Math.abs(ep1.y - edge.p2.y) < 0.1 &&
                          Math.abs(ep2.x - edge.p1.x) < 0.1 && Math.abs(ep2.y - ep1.y) < 0.1);

          if ( (match1 || match2) && triNeighbors[i].r >= 0 && triNeighbors[i].r < height && triNeighbors[i].c >= 0 && triNeighbors[i].c < width) {
            return triNeighbors[i];
          }
        }
        break;
    }
    return null; // No neighbor found (boundary edge or invalid edge)
  }

  private getHexagonNeighborsList(col: number, row: number): {c: number, r: number}[] {
    // These correspond to edges 0-5 for pointy-top hexagons starting from top-right.
    const isOddRow = row % 2 !== 0;
    if (!isOddRow) { // Even rows
      return [
        { c: col + 1, r: row },       // 0 (Right)
        { c: col, r: row - 1 },       // 1 (Top-Right)
        { c: col - 1, r: row - 1 },   // 2 (Top-Left)
        { c: col - 1, r: row },       // 3 (Left)
        { c: col - 1, r: row + 1 },   // 4 (Bottom-Left)
        { c: col, r: row + 1 }        // 5 (Bottom-Right)
      ];
    } else { // Odd rows
      return [
        { c: col + 1, r: row },       // 0 (Right)
        { c: col + 1, r: row - 1 },   // 1 (Top-Right)
        { c: col, r: row - 1 },       // 2 (Top-Left)
        { c: col - 1, r: row },       // 3 (Left)
        { c: col, r: row + 1 },       // 4 (Bottom-Left)
        { c: col + 1, r: row + 1 }    // 5 (Bottom-Right)
      ];
    }
  }

  private getTriangleNeighborsList(col: number, row: number): {c: number, r: number}[] {
    const isUpward = (row + col) % 2 === 0; // Upward-pointing triangle
    if (isUpward) {
      // Neighbors for an upward triangle (edges are Bottom-Left, Bottom-Right, Top)
      return [
        {c: col - 1, r: row}, // Left-adjacent triangle
        {c: col + 1, r: row}, // Right-adjacent triangle
        {c: col, r: row + 1}  // Bottom-adjacent (downward) triangle
      ];
    } else {
      // Neighbors for a downward triangle (edges are Top-Left, Top-Right, Bottom)
      return [
        {c: col - 1, r: row}, // Left-adjacent triangle
        {c: col + 1, r: row}, // Right-adjacent triangle
        {c: col, r: row - 1}  // Top-adjacent (upward) triangle
      ];
    }
  }

  // --- Interaction methods (from original file) ---
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
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;
    
    let closestHex: CellInfo | null = null;
    let minDistance = Infinity;
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const center = this.getHexagonCenter(col, row, scale);
        const dx = x - center.x;
        const dy = y - center.y;
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
    const approxCol = Math.floor(x / (scale * 0.5));
    const approxRow = Math.floor(y / triangleHeight);
    
    const candidates = [
      { r: approxRow, c: approxCol }, { r: approxRow, c: approxCol - 1 }, { r: approxRow, c: approxCol + 1 },
      { r: approxRow - 1, c: approxCol }, { r: approxRow + 1, c: approxCol }
    ];
    
    for (const cand of candidates) {
      if (cand.c >= 0 && cand.c < width && cand.r >= 0 && cand.r < height) {
        const points = this.getTrianglePointsAbsolute(cand.c, cand.r, scale);
        if (this.isPointInTriangle(x, y, points)) {
          return { type: 'cell', row: cand.r, col: cand.c };
        }
      }
    }
    return null;
  }

  private isPointInTriangle(px: number, py: number, points: Point[]): boolean {
    const [v1, v2, v3] = points;
    const d1 = this.sign(px, py, v1.x, v1.y, v2.x, v2.y);
    const d2 = this.sign(px, py, v2.x, v2.y, v3.x, v3.y);
    const d3 = this.sign(px, py, v3.x, v3.y, v1.x, v1.y);
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  }

  private sign(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): number {
    return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
  }

  getEdgeAt(
    x: number, y: number, width: number, height: number, gridType: GridType, scale: number
  ): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: { p1: Point, p2: Point } | null = null;
    const searchRadius = scale * 1.5;

    const approxCol = Math.floor(x / scale);
    const approxRow = Math.floor(y / scale);

    for (let row = Math.max(0, approxRow - 2); row < Math.min(height, approxRow + 3); row++) {
        for (let col = Math.max(0, approxCol - 2); col < Math.min(width, approxCol + 3); col++) {
            const edges = this.getEdgesForCell(gridType, col, row, width, height, scale);
            for (const edge of edges) {
                const dist = this.distanceToLineSegment(x, y, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);
                if (dist < minDist && dist < searchRadius) {
                    minDist = dist;
                    closestEdge = edge;
                }
            }
        }
    }
    return closestEdge ? { type: 'edge', points: [closestEdge.p1, closestEdge.p2] } : null;
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

  drawVertex(vertex: Point, color: string): Graphics {
    const graphics = new Graphics();
    const radius = 5;
    graphics.circle(vertex.x, vertex.y, radius);
    graphics.fill(colorToHex(color));
    graphics.stroke({ color: colorToHex('#000000'), width: 1 });
    return graphics;
  }

  drawCellHighlight(cellInfo: CellInfo, _width: number, _height: number, gridType: GridType, scale: number, color: string): Graphics {
    const graphics = new Graphics();
    
    switch (gridType) {
      case 'squares': {
        const x = cellInfo.col * scale;
        const y = cellInfo.row * scale;
        graphics.rect(x, y, scale, scale);
        graphics.stroke({ color: colorToHex(color), width: 3 });
        break;
      }
      case 'hexagons': {
        const hexCenters = this.getHexagonCenter(cellInfo.col, cellInfo.row, scale);
        this.drawHexagon(graphics, hexCenters.x, hexCenters.y, scale);
        graphics.stroke({ color: colorToHex(color), width: 3 });
        break;
      }
      case 'triangles': {
        const triPoints = this.getTrianglePointsAbsolute(cellInfo.col, cellInfo.row, scale);
        this.drawTriangle(graphics, triPoints);
        graphics.stroke({ color: colorToHex(color), width: 3 });
        break;
      }
    }
    return graphics;
  }
}