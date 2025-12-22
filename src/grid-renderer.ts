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

    const renderer = this.getRenderer(gridType);
    renderer.call(this, container, edgeContainer, width, height, scale, cellStates, palette, edgeColor, edgeWidth, visualizeEdgeDelta, edgePalette, showCoordinates);
  }

  private getRenderer(gridType: GridType) {
    switch (gridType) {
      case 'squares': return this.renderSquares;
      case 'hexagons': return this.renderHexagons;
      case 'triangles': return this.renderTriangles;
    }
  }

  private renderSquares(
    container: Container, edgeContainer: Container, width: number, height: number, scale: number,
    cellStates: number[][], palette: Record<number, string>, edgeColor: string, edgeWidth: number,
    visualizeEdgeDelta: boolean, edgePalette: Record<number, string>, showCoordinates: boolean
  ) {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * scale;
        const y = row * scale;
        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');

        const cell = new Graphics().rect(x, y, scale, scale).fill(color);
        container.addChild(cell);

        if (showCoordinates) this.drawCoordinates(container, `${col},${row}`, x + scale / 2, y + scale / 2, scale / 4);

        if (visualizeEdgeDelta) {
          const neighbors = [{c: col, r: row - 1}, {c: col + 1, r: row}, {c: col, r: row + 1}, {c: col - 1, r: row}];
          const points = [{x, y}, {x: x + scale, y}, {x: x + scale, y: y + scale}, {x, y: y + scale}];
          for (let i = 0; i < 4; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % 4];
            const neighbor = neighbors[i];
            const neighborState = (neighbor.r >= 0 && neighbor.r < height && neighbor.c >= 0 && neighbor.c < width) ? cellStates[neighbor.r][neighbor.c] : state;
            const delta = Math.abs(state - neighborState);
            const finalEdgeColor = colorToHex(edgePalette[delta] || '#ffffff');
            edgeContainer.addChild(new Graphics().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: finalEdgeColor, width: edgeWidth }));
          }
        } else {
          edgeContainer.addChild(new Graphics().rect(x, y, scale, scale).stroke({ color: colorToHex(edgeColor), width: edgeWidth }));
        }
      }
    }
  }

  private renderHexagons(
    container: Container, edgeContainer: Container, width: number, height: number, scale: number,
    cellStates: number[][], palette: Record<number, string>, edgeColor: string, edgeWidth: number,
    visualizeEdgeDelta: boolean, edgePalette: Record<number, string>, showCoordinates: boolean
  ) {
    const hexSpacingX = scale * Math.sqrt(3);
    const hexSpacingY = scale * 1.5;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const offsetX = (row % 2) * (hexSpacingX / 2);
        const centerX = col * hexSpacingX + offsetX;
        const centerY = row * hexSpacingY;
        
        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');
        
        const hex = this.createHexagonCentered(centerX, centerY, scale);
        hex.fill(color);
        container.addChild(hex);
        
        if (showCoordinates) this.drawCoordinates(container, `${col},${row}`, centerX, centerY, scale / 4);

        if (!visualizeEdgeDelta) {
          const edges = this.createHexagonCentered(centerX, centerY, scale);
          edges.stroke({ color: colorToHex(edgeColor), width: edgeWidth });
          edgeContainer.addChild(edges);
        } else {
          const points = Array.from({length: 6}, (_, i) => {
            const angle = (Math.PI / 3) * i + Math.PI/6; // Pointy-top vertices
            return { x: centerX + scale * Math.cos(angle), y: centerY + scale * Math.sin(angle) };
          });
          
          const neighbors = this.getHexagonNeighbors(col, row);

          for (let i = 0; i < 6; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % 6];
            const neighbor = neighbors[i];
            const neighborState = (neighbor.r >= 0 && neighbor.r < height && neighbor.c >= 0 && neighbor.c < width) ? cellStates[neighbor.r][neighbor.c] : state;
            const delta = Math.abs(state - neighborState);
            const finalEdgeColor = colorToHex(edgePalette[delta] || '#ffffff');
            
            edgeContainer.addChild(new Graphics().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: finalEdgeColor, width: edgeWidth }));
          }
        }
      }
    }
  }

  private renderTriangles(
    container: Container, edgeContainer: Container, width: number, height: number, scale: number,
    cellStates: number[][], palette: Record<number, string>, edgeColor: string, edgeWidth: number,
    visualizeEdgeDelta: boolean, edgePalette: Record<number, string>, showCoordinates: boolean
  ) {
    const triangleHeight = scale * Math.sqrt(3) / 2;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * scale * 0.5;
        const y = row * triangleHeight;
        const isUpward = (row + col) % 2 === 0;
        const state = cellStates[row]?.[col] ?? 0;
        const color = colorToHex(palette[state] || '#000000');

        const triangle = this.createTriangle(x, y, scale, isUpward);
        triangle.fill(color);
        container.addChild(triangle);

        if (showCoordinates) this.drawCoordinates(container, `${col},${row}`, x + scale / 2, y + triangleHeight / 2, scale / 5);

        if (!visualizeEdgeDelta) {
          const edges = this.createTriangle(x, y, scale, isUpward);
          edges.stroke({ color: colorToHex(edgeColor), width: edgeWidth });
          edgeContainer.addChild(edges);
        } else {
          const neighbors = this.getTriangleNeighbors(col, row);
          const points = this.getTrianglePoints(x, y, scale, isUpward);
          
          for (let i = 0; i < 3; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % 3];
            const neighbor = neighbors[i];
            const neighborState = (neighbor.r >= 0 && neighbor.r < height && neighbor.c >= 0 && neighbor.c < width) ? cellStates[neighbor.r][neighbor.c] : state;
            const delta = Math.abs(state - neighborState);
            const finalEdgeColor = colorToHex(edgePalette[delta] || '#ffffff');
            
            edgeContainer.addChild(new Graphics().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: finalEdgeColor, width: edgeWidth }));
          }
        }
      }
    }
  }

  private drawCoordinates(container: Container, text: string, x: number, y: number, fontSize: number) {
    const coordText = new Text({ text, style: { fontSize: Math.max(8, fontSize), fill: 0xffffff, stroke: { color: 0x000000, width: 2 }, align: 'center' } });
    coordText.anchor.set(0.5);
    coordText.position.set(x, y);
    container.addChild(coordText);
  }

  private getHexagonNeighbors(col: number, row: number): {c: number, r: number}[] {
    const isOddRow = row % 2 !== 0;
    if (isOddRow) {
      return [{c: col+1, r: row}, {c: col, r: row-1}, {c: col-1, r: row-1}, {c: col-1, r: row}, {c: col-1, r: row+1}, {c: col, r: row+1}];
    } else {
      return [{c: col+1, r: row}, {c: col+1, r: row-1}, {c: col, r: row-1}, {c: col-1, r: row}, {c: col, r: row+1}, {c: col+1, r: row+1}];
    }
  }

  private getTriangleNeighbors(col: number, row: number): {c: number, r: number}[] {
    return (row + col) % 2 === 0
      ? [{c: col - 1, r: row}, {c: col + 1, r: row}, {c: col, r: row + 1}]
      : [{c: col - 1, r: row}, {c: col + 1, r: row}, {c: col, r: row - 1}];
  }

  private getTrianglePoints(x: number, y: number, sideLength: number, isUpward: boolean): {x: number, y: number}[] {
    const height = sideLength * Math.sqrt(3) / 2;
    const centerX = x + sideLength / 2;
    const centerY = y + height / 2;
    if (isUpward) {
      return [{x: centerX, y: centerY - height/2}, {x: centerX - sideLength/2, y: centerY + height/2}, {x: centerX + sideLength/2, y: centerY + height/2}];
    } else {
      return [{x: centerX - sideLength/2, y: centerY - height/2}, {x: centerX + sideLength/2, y: centerY - height/2}, {x: centerX, y: centerY + height/2}];
    }
  }

  private createHexagonCentered(centerX: number, centerY: number, radius: number): Graphics {
    const graphics = new Graphics();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI/6; // Pointy-top vertices
      graphics.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
    }
    graphics.closePath();
    return graphics;
  }

  private createTriangle(x: number, y: number, sideLength: number, isUpward: boolean): Graphics {
    const graphics = new Graphics();
    const points = this.getTrianglePoints(x, y, sideLength, isUpward);
    graphics.moveTo(points[0].x, points[0].y).lineTo(points[1].x, points[1].y).lineTo(points[2].x, points[2].y).closePath();
    return graphics;
  }
}