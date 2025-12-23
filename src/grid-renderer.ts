import { Graphics, Container, Text } from 'pixi.js';
import { EdgeInfo, CellInfo, Point } from './types';
import { colorToHex } from './color-utils';
import { Grid } from './grid';

export class GridRenderer {
  render(
    container: Container,
    edgeContainer: Container,
    width: number,
    height: number,
    grid: Grid,
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

        const poly = grid.getCellPolygon({ col, row });
        const cellShape = this.createPolygonShape(poly);
        cellShape.fill(fillColor);
        
        const edgeShape = this.createPolygonShape(poly);
        edgeShape.stroke({ color: colorToHex(edgeColor), width: edgeWidth });

        container.addChild(cellShape);
        edgeContainer.addChild(edgeShape);

        if (showCoordinates) {
          const center = grid.cellToPixel({ col, row });
          // Scale estimation for text size: distance between first two points of polygon / 4 roughly
          const scaleEst = Math.sqrt(Math.pow(poly[0].x - poly[1].x, 2) + Math.pow(poly[0].y - poly[1].y, 2)); 
          this.drawCoordinates(container, `${col},${row}`, center.x, center.y, scaleEst / 2);
        }
      }
    }
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
  
  drawCellHighlight(cellInfo: CellInfo, grid: Grid, color: string): Graphics {
    const graphics = new Graphics();
    const poly = grid.getCellPolygon({ col: cellInfo.col, row: cellInfo.row });
    const shape = this.createPolygonShape(poly);
    shape.stroke({ color: colorToHex(color), width: 3, alignment: 0 });
    graphics.addChild(shape);
    return graphics;
  }
}