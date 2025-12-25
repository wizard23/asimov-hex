import { Graphics, Container, Text } from 'pixi.js';
import { EdgeInfo, CellInfo, Point, ColorValue } from '../../types';
import { colorToHex } from '../utils/color-utils';
import { Grid } from '../grid';

export class GridRenderer {
  render(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    grid: Grid,
    cellStates: number[][],
    palette: Record<number, ColorValue>,
    edgeColor: ColorValue,
    edgeWidth: number,
    visualizeEdgeDelta: boolean,
    edgePalette: Record<number, ColorValue>,
    showCoordinates: boolean = false
  ) {
    container.removeChildren();
    edgeContainer.removeChildren();

    const drawnEdges = new Set<string>();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const state = cellStates[row]?.[col] ?? 0;
        const fillColor = colorToHex(palette[state] || '#000000');

        const poly = grid.getCellPolygon({ col, row });
        const cellShape = this.createPolygonShape(poly);
        cellShape.fill(fillColor);
        container.addChild(cellShape);

        if (showCoordinates) {
          const center = grid.cellToPixel({ col, row });
          // Scale estimation for text size: distance between first two points of polygon / 4 roughly
          const scaleEst = Math.sqrt(Math.pow(poly[0].x - poly[1].x, 2) + Math.pow(poly[0].y - poly[1].y, 2)); 
          this.drawCoordinates(container, `${col},${row}`, center.x, center.y, scaleEst / 2);
        }

        if (visualizeEdgeDelta) {
            const edges = grid.getCellEdges({ col, row });
            const neighbors = grid.getNeighbors({ col, row });
            
            // We need to match edges to neighbors.
            // Since getCellEdges and getNeighbors order is consistent in our implementations (usually CCW or CW),
            // we might try to assume index matching, but it's brittle.
            // Instead, let's find the neighbor that shares the edge geometrically.
            
            for (const edge of edges) {
                // Unique key for edge to avoid drawing twice if transparent? 
                // But we are drawing opaque lines usually. 
                // To avoid double drawing, we can order points.
                const p1 = edge.points[0];
                const p2 = edge.points[1];
                const key = (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)) 
                    ? `${p1.x.toFixed(2)},${p1.y.toFixed(2)}-${p2.x.toFixed(2)},${p2.y.toFixed(2)}` 
                    : `${p2.x.toFixed(2)},${p2.y.toFixed(2)}-${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;

                if (drawnEdges.has(key)) continue;
                drawnEdges.add(key);

                let delta = 0;

                // Find neighbor sharing this edge
                for (const n of neighbors) {
                    // Check bounds for neighbor
                    // Note: Grid.getNeighbors doesn't check bounds, so we must check if n is within grid limits
                    // However, we don't have grid limits here easily accessible except width/height.
                    // Assuming row/col are within 0..height-1 and 0..width-1.
                    // But TriangleGrid/HexagonGrid might return neighbors outside.
                    // We must filter them.
                    
                    // Actually, let's just check if n is in cellStates.
                    if (n.row >= 0 && n.row < height && n.col >= 0 && n.col < width) {
                         const nPoly = grid.getCellPolygon(n);
                         // Check if nPoly has edge matching p1, p2 (order reversed or same)
                         if (this.hasEdge(nPoly, p1, p2)) {
                             const nState = cellStates[n.row][n.col];
                             delta = Math.abs(state - nState);
                             break;
                         }
                    }
                }
                
                // If no neighbor found, it's a boundary edge. 
                // Delta remains 0 (or we could choose a specific boundary color).
                // Using edgePalette[delta].
                const color = edgePalette[delta] || edgeColor; // Fallback
                
                const graphics = new Graphics();
                graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: colorToHex(color), width: edgeWidth });
                edgeContainer.addChild(graphics);
            }

        } else {
            // Original behavior: draw polygon outline
            const edgeShape = this.createPolygonShape(poly);
            edgeShape.stroke({ color: colorToHex(edgeColor), width: edgeWidth });
            edgeContainer.addChild(edgeShape);
        }
      }
    }
  }

  private hasEdge(poly: Point[], p1: Point, p2: Point): boolean {
      const epsilon = 0.1;
      for (let i = 0; i < poly.length; i++) {
          const v1 = poly[i];
          const v2 = poly[(i + 1) % poly.length];
          // Check if segment (v1, v2) is same as (p1, p2) or (p2, p1)
          if ((this.pointsClose(v1, p1, epsilon) && this.pointsClose(v2, p2, epsilon)) ||
              (this.pointsClose(v1, p2, epsilon) && this.pointsClose(v2, p1, epsilon))) {
              return true;
          }
      }
      return false;
  }

  private pointsClose(a: Point, b: Point, epsilon: number): boolean {
      return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
  }

  private createPolygonShape(points: Point[]): Graphics {
    const graphics = new Graphics();
    if (points.length < 3) return graphics;
    
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    return graphics;
  }

  private drawCoordinates(container: Container, text: string, x: number, y: number, fontSize: number) {
    const coordText = new Text({ text, style: { fontSize: Math.max(8, fontSize), fill: 0xffffff, stroke: { color: 0x000000, width: 2 }, align: 'center' } });
    coordText.anchor.set(0.5);
    coordText.position.set(x, y);
    container.addChild(coordText);
  }

  getCellAt(x: number, y: number, width: number, height: number, grid: Grid): CellInfo | null {
    const cell = grid.pixelToCell({ x, y });
    if (cell && cell.col >= 0 && cell.col < width && cell.row >= 0 && cell.row < height) {
      return { type: 'cell', row: cell.row, col: cell.col };
    }
    return null;
  }
  
  getEdgeAt(x: number, y: number, width: number, height: number, grid: Grid): EdgeInfo | null {
    // Threshold for edge selection (e.g. 10 pixels)
    return grid.getEdgeAt({ x, y }, 10, width, height);
  }

  getClosestVertex(x: number, y: number, width: number, height: number, grid: Grid): Point | null { 
      // Threshold for vertex selection (e.g. 20 pixels)
      return grid.getVertexAt({ x, y }, 20, width, height);
  }
  
  getEdgesAtVertex(vertex: Point, width: number, height: number, grid: Grid): EdgeInfo[] {
      return grid.getEdgesAtVertex(vertex, width, height);
  }
  
  drawEdge(edgeInfo: EdgeInfo, color: ColorValue): Graphics {
    const graphics = new Graphics();
    graphics.moveTo(edgeInfo.points[0].x, edgeInfo.points[0].y).lineTo(edgeInfo.points[1].x, edgeInfo.points[1].y).stroke({ color: colorToHex(color), width: 3 });
    return graphics;
  }
  
  drawVertex(vertex: Point, color: ColorValue): Graphics {
    const graphics = new Graphics();
    graphics.circle(vertex.x, vertex.y, 5).fill(colorToHex(color));
    return graphics;
  }
  
  drawCellHighlight(cellInfo: CellInfo, grid: Grid, color: ColorValue): Graphics {
    const graphics = new Graphics();
    const poly = grid.getCellPolygon({ col: cellInfo.col, row: cellInfo.row });
    const shape = this.createPolygonShape(poly);
    shape.stroke({ color: colorToHex(color), width: 3, alignment: 0 });
    graphics.addChild(shape);
    return graphics;
  }
}
