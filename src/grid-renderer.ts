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
    showCoordinates: boolean = false
  ) {
    container.removeChildren();
    edgeContainer.removeChildren();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const state = cellStates[row]?.[col] ?? 0;
        const fillColor = colorToHex(palette[state] || '#000000');

        const cellShape = this.createCellShape(gridType, col, row, scale);
        cellShape.fill(fillColor);
        
        const edgeShape = this.createCellShape(gridType, col, row, scale);
        edgeShape.stroke({ color: colorToHex(edgeColor), width: edgeWidth });

        container.addChild(cellShape);
        edgeContainer.addChild(edgeShape);

        if (showCoordinates) {
          const center = this.getCellCenter(gridType, col, row, scale);
          this.drawCoordinates(container, `${col},${row}`, center.x, center.y, scale / 4);
        }
      }
    }
  }

  private createCellShape(gridType: GridType, col: number, row: number, scale: number): Graphics {
    const graphics = new Graphics();
    switch (gridType) {
      case 'squares':
        graphics.rect(col * scale, row * scale, scale, scale);
        break;
      case 'hexagons':
        const hexCenter = this.getHexagonCenter(col, row, scale);
        this.drawHexagon(graphics, hexCenter.x, hexCenter.y, scale);
        break;
      case 'triangles':
        const triX = col * scale * 0.5;
        const triY = row * (scale * Math.sqrt(3) / 2);
        const isUpward = (row + col) % 2 === 0;
        this.drawTriangle(graphics, this.getTrianglePoints(triX + scale / 2, triY + (scale * Math.sqrt(3) / 2) / 2, scale, isUpward));
        break;
    }
    return graphics;
  }

  private drawHexagon(graphics: Graphics, centerX: number, centerY: number, radius: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    }
    graphics.closePath();
  }

  private drawTriangle(graphics: Graphics, points: Point[]) {
    graphics.moveTo(points[0].x, points[0].y).lineTo(points[1].x, points[1].y).lineTo(points[2].x, points[2].y).closePath();
  }

  private drawCoordinates(container: Container, text: string, x: number, y: number, fontSize: number) {
    const coordText = new Text({ text, style: { fontSize: Math.max(8, fontSize), fill: 0xffffff, stroke: { color: 0x000000, width: 2 }, align: 'center' } });
    coordText.anchor.set(0.5);
    coordText.position.set(x, y);
    container.addChild(coordText);
  }

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

  private getTrianglePoints(centerX: number, centerY: number, sideLength: number, isUpward: boolean): Point[] {
    const height = sideLength * Math.sqrt(3) / 2;
    if (isUpward) {
      return [{ x: centerX, y: centerY - height / 2 }, { x: centerX - sideLength / 2, y: centerY + height / 2 }, { x: centerX + sideLength / 2, y: centerY + height / 2 }];
    } else {
      return [{ x: centerX - sideLength / 2, y: centerY - height / 2 }, { x: centerX + sideLength / 2, y: centerY - height / 2 }, { x: centerX, y: centerY + height / 2 }];
    }
  }

  getCellAt(x: number, y: number, width: number, height: number, gridType: GridType, scale: number): CellInfo | null {
    switch (gridType) {
        case 'squares':
            const col = Math.floor(x / scale);
            const row = Math.floor(y / scale);
            if (col >= 0 && col < width && row >= 0 && row < height) {
                return { type: 'cell', row, col };
            }
            return null;
        case 'hexagons':
        case 'triangles':
            let closestCell: CellInfo | null = null;
            let minDistance = Infinity;
            const searchRadius = gridType === 'hexagons' ? scale : scale * 0.75;
            for (let r = 0; r < height; r++) {
                for (let c = 0; c < width; c++) {
                    const center = this.getCellCenter(gridType, c, r, scale);
                    const dx = x - center.x;
                    const dy = y - center.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCell = { type: 'cell', row: r, col: c };
                    }
                }
            }
            if (minDistance < searchRadius) {
                return closestCell;
            }
            return null;
    }
  }
  
  getEdgeAt(x: number, y: number, width: number, height: number, gridType: GridType, scale: number): EdgeInfo | null {
    let minDist = Infinity;
    let closestEdge: { p1: Point, p2: Point } | null = null;
    const searchRadius = 10;

    const approxRow = Math.floor(y / (gridType === 'hexagons' ? scale * 1.5 : (gridType === 'triangles' ? scale * Math.sqrt(3)/2 : scale)));
    const approxCol = Math.floor(x / (gridType === 'hexagons' ? scale * Math.sqrt(3) : (gridType === 'triangles' ? scale * 0.5 : scale)));
    
    for (let r = Math.max(0, approxRow - 2); r < Math.min(height, approxRow + 3); r++) {
      for (let c = Math.max(0, approxCol - 2); c < Math.min(width, approxCol + 3); c++) {
        const edges = this.getEdgesForCell(gridType, c, r, scale);
        for (const edge of edges) {
          const dist = this.distanceToLineSegment(x, y, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);
          if (dist < minDist) {
            minDist = dist;
            closestEdge = edge;
          }
        }
      }
    }
    
    if (closestEdge && minDist < searchRadius) {
      return { type: 'edge', points: [closestEdge.p1, closestEdge.p2] };
    }
    return null;
  }

  private getEdgesForCell(gridType: GridType, col: number, row: number, scale: number): { p1: Point, p2: Point }[] {
    switch(gridType) {
      case 'squares':
        const x = col * scale;
        const y = row * scale;
        return [
          { p1: {x, y}, p2: {x: x+scale, y} },
          { p1: {x: x+scale, y}, p2: {x: x+scale, y: y+scale} },
          { p1: {x: x+scale, y: y+scale}, p2: {x, y: y+scale} },
          { p1: {x, y: y+scale}, p2: {x, y} },
        ];
      case 'hexagons':
        const center = this.getHexagonCenter(col, row, scale);
        const points = Array.from({length: 6}, (_, i) => {
          const angle = (Math.PI / 3) * i + Math.PI / 6;
          return { x: center.x + scale * Math.cos(angle), y: center.y + scale * Math.sin(angle) };
        });
        return points.map((p, i) => ({ p1: p, p2: points[(i+1)%6] }));
      case 'triangles':
        const triX = col * scale * 0.5;
        const triY = row * (scale * Math.sqrt(3) / 2);
        const isUpward = (row + col) % 2 === 0;
        const triCenterY = triY + (scale * Math.sqrt(3) / 2) / 2;
        const triPoints = this.getTrianglePoints(triX + scale / 2, triCenterY, scale, isUpward);
        return triPoints.map((p, i) => ({ p1: p, p2: triPoints[(i+1)%3] }));
    }
  }

  private distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
    if (l2 === 0) return Math.sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1));
    let t = ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const dx = px - (x1 + t * (x2 - x1));
    const dy = py - (y1 + t * (y2 - y1));
    return Math.sqrt(dx*dx + dy*dy);
  }

  getClosestVertex(x: number, y: number, width: number, height: number, gridType: GridType, scale: number): Point | null { 
      let closestVertex: Point | null = null;
      let minDistSq = Infinity;
      const searchRadiusSq = 20 * 20;

      const approxRow = Math.floor(y / (gridType === 'hexagons' ? scale * 1.5 : (gridType === 'triangles' ? scale * Math.sqrt(3)/2 : scale)));
      const approxCol = Math.floor(x / (gridType === 'hexagons' ? scale * Math.sqrt(3) : (gridType === 'triangles' ? scale * 0.5 : scale)));

      for (let r = Math.max(0, approxRow - 2); r < Math.min(height, approxRow + 3); r++) {
          for (let c = Math.max(0, approxCol - 2); c < Math.min(width, approxCol + 3); c++) {
              const edges = this.getEdgesForCell(gridType, c, r, scale);
              for (const edge of edges) {
                  for (const p of [edge.p1, edge.p2]) {
                      const distSq = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
                      if (distSq < minDistSq) {
                          minDistSq = distSq;
                          closestVertex = p;
                      }
                  }
              }
          }
      }

      if (minDistSq < searchRadiusSq) {
          return closestVertex;
      }
      return null;
  }
  
  getEdgesAtVertex(vertex: Point, width: number, height: number, gridType: GridType, scale: number): EdgeInfo[] {
      const edges: EdgeInfo[] = [];
      const epsilon = 0.1;

      for (let r = 0; r < height; r++) {
          for (let c = 0; c < width; c++) {
              const cellEdges = this.getEdgesForCell(gridType, c, r, scale);
              for (const edge of cellEdges) {
                  if ((Math.abs(vertex.x - edge.p1.x) < epsilon && Math.abs(vertex.y - edge.p1.y) < epsilon) ||
                      (Math.abs(vertex.x - edge.p2.x) < epsilon && Math.abs(vertex.y - edge.p2.y) < epsilon))
                  {
                      edges.push({ type: 'edge', points: [edge.p1, edge.p2] });
                  }
              }
          }
      }
      return this.removeDuplicateEdges(edges);
  }

  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const unique: EdgeInfo[] = [];
    const epsilon = 0.1;
    
    for (const edge of edges) {
      let isDuplicate = false;
      for (const existing of unique) {
        const p1 = edge.points[0];
        const p2 = edge.points[1];
        const ep1 = existing.points[0];
        const ep2 = existing.points[1];

        if ((Math.abs(p1.x-ep1.x)<epsilon && Math.abs(p1.y-ep1.y)<epsilon && Math.abs(p2.x-ep2.x)<epsilon && Math.abs(p2.y-ep2.y)<epsilon) ||
            (Math.abs(p1.x-ep2.x)<epsilon && Math.abs(p1.y-ep2.y)<epsilon && Math.abs(p2.x-ep1.x)<epsilon && Math.abs(p2.y-ep1.y)<epsilon)) {
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
  
  drawEdge(edgeInfo: EdgeInfo, color: string): Graphics {
    const graphics = new Graphics();
    graphics.moveTo(edgeInfo.points[0].x, edgeInfo.points[0].y).lineTo(edgeInfo.points[1].x, edgeInfo.points[1].y).stroke({ color: colorToHex(color), width: 3 });
    return graphics;
  }
  
  drawVertex(vertex: Point, color: string): Graphics {
    const graphics = new Graphics();
    graphics.circle(vertex.x, vertex.y, 5).fill(colorToHex(color));
    return graphics;
  }
  
  drawCellHighlight(cellInfo: CellInfo, _width: number, _height: number, gridType: GridType, scale: number, color: string): Graphics {
    const graphics = new Graphics();
    const shape = this.createCellShape(gridType, cellInfo.col, cellInfo.row, scale);
    shape.stroke({ color: colorToHex(color), width: 3, alignment: 0 });
    graphics.addChild(shape);
    return graphics;
  }
}