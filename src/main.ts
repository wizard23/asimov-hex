import { Application, Graphics, Container } from 'pixi.js';
import { Pane } from 'tweakpane';
import { GridRenderer } from './grid-renderer';
import { GridType } from './types';
import { colorToHex } from './color-utils';

type ColorValue = string | { r: number; g: number; b: number; a?: number };

interface AppConfig {
  gridWidth: number;
  gridHeight: number;
  gridType: GridType;
  gridScale: number;
  drawState: number;
  palette: Record<number, ColorValue>;
  edgeColor: ColorValue;
  edgeHighlightColor: ColorValue;
}

class GridApp {
  private app: Application;
  private gridRenderer: GridRenderer;
  private pane: Pane;
  private config: AppConfig;
  private gridContainer: Container;
  private edgeContainer: Container;
  private highlightedEdge: Graphics | null = null;
  private cellStates: number[][] = [];

  constructor() {
    this.config = {
      gridWidth: 20,
      gridHeight: 20,
      gridType: 'squares',
      gridScale: 30,
      drawState: 1,
      palette: {
        0: '#000000',
        1: '#ff0000',
        2: '#00ff00',
        3: '#0000ff',
        4: '#ffff00',
        5: '#ff00ff',
        6: '#00ffff',
      },
      edgeColor: '#ffffff',
      edgeHighlightColor: '#ffff00',
    };

    this.initPixi().then(() => {
      this.initTweakpane();
      this.initGrid();
      this.setupInteraction();
    });
  }

  private async initPixi() {
    this.app = new Application();
    await this.app.init({ 
      antialias: true, 
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
    });
    
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.appendChild(this.app.canvas as HTMLCanvasElement);
    }

    this.gridContainer = new Container();
    this.edgeContainer = new Container();
    this.app.stage.addChild(this.gridContainer);
    this.app.stage.addChild(this.edgeContainer);

    // resizeTo: window handles resizing automatically
  }

  private initTweakpane() {
    this.pane = new Pane({ title: 'Grid Controls' });

    this.pane.addInput(this.config, 'gridWidth', {
      min: 1,
      max: 100,
      step: 1,
    }).on('change', () => this.updateGrid());

    this.pane.addInput(this.config, 'gridHeight', {
      min: 1,
      max: 100,
      step: 1,
    }).on('change', () => this.updateGrid());

    this.pane.addInput(this.config, 'gridType', {
      options: {
        squares: 'squares',
        hexagons: 'hexagons',
        triangles: 'triangles',
      },
    }).on('change', () => this.updateGrid());

    this.pane.addInput(this.config, 'gridScale', {
      min: 5,
      max: 100,
      step: 1,
    }).on('change', () => this.updateGrid());

    this.pane.addInput(this.config, 'drawState', {
      min: 0,
      max: 10,
      step: 1,
    });

    // Create palette folder with individual color inputs
    const paletteFolder = this.pane.addFolder({ title: 'Palette' });
    for (let i = 0; i <= 10; i++) {
      if (!this.config.palette[i]) {
        this.config.palette[i] = '#000000';
      }
      paletteFolder.addInput(this.config.palette, i.toString(), {
        view: 'color',
        color: { type: 'float' },
        label: `State ${i}`,
      }).on('change', (ev: any) => {
        this.config.palette[i] = ev.value;
        this.updateGrid();
      });
    }

    this.pane.addInput(this.config, 'edgeColor', {
      view: 'color',
      color: { type: 'float' },
    }).on('change', (ev: any) => {
      this.config.edgeColor = ev.value;
      this.updateGrid();
    });

    this.pane.addInput(this.config, 'edgeHighlightColor', {
      view: 'color',
      color: { type: 'float' },
    }).on('change', (ev: any) => {
      this.config.edgeHighlightColor = ev.value;
    });
  }

  private initGrid() {
    this.gridRenderer = new GridRenderer();
    this.updateGrid();
  }

  private updateGrid() {
    // Initialize cell states if needed
    if (this.cellStates.length !== this.config.gridHeight || 
        this.cellStates[0]?.length !== this.config.gridWidth) {
      this.cellStates = Array(this.config.gridHeight)
        .fill(0)
        .map(() => Array(this.config.gridWidth).fill(0));
    }

    // Clear existing graphics
    this.gridContainer.removeChildren();
    this.edgeContainer.removeChildren();
    this.highlightedEdge = null;

    // Calculate grid dimensions based on type
    let gridWidth: number, gridHeight: number;
    if (this.config.gridType === 'squares') {
      gridWidth = this.config.gridWidth * this.config.gridScale;
      gridHeight = this.config.gridHeight * this.config.gridScale;
    } else if (this.config.gridType === 'hexagons') {
      const hexHeight = this.config.gridScale * Math.sqrt(3);
      const hexWidth = this.config.gridScale * 2;
      gridWidth = this.config.gridWidth * hexWidth * 0.75 + this.config.gridScale;
      gridHeight = this.config.gridHeight * hexHeight * 0.5 + hexHeight;
    } else { // triangles
      const triangleHeight = this.config.gridScale * Math.sqrt(3) / 2;
      gridWidth = this.config.gridWidth * this.config.gridScale * 0.5 + this.config.gridScale;
      gridHeight = this.config.gridHeight * triangleHeight + triangleHeight;
    }

    // Center the grid
    const offsetX = (this.app.screen.width - gridWidth) / 2;
    const offsetY = (this.app.screen.height - gridHeight) / 2;

    this.gridContainer.x = offsetX;
    this.gridContainer.y = offsetY;

    // Convert palette to string format for renderer
    const paletteStrings: Record<number, string> = {};
    for (const [key, value] of Object.entries(this.config.palette)) {
      paletteStrings[parseInt(key)] = typeof value === 'string' ? value : '#000000';
    }

    // Render grid
    this.gridRenderer.render(
      this.gridContainer,
      this.edgeContainer,
      this.config.gridWidth,
      this.config.gridHeight,
      this.config.gridType,
      this.config.gridScale,
      this.cellStates,
      paletteStrings,
      typeof this.config.edgeColor === 'string' ? this.config.edgeColor : '#ffffff'
    );
  }

  private setupInteraction() {
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
    canvas.addEventListener('mousedown', (e: MouseEvent) => this.handleMouseDown(e));
    canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
  }

  private handleMouseMove(e: MouseEvent) {
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - this.gridContainer.x;
    const y = e.clientY - rect.top - this.gridContainer.y;

    const edgeInfo = this.gridRenderer.getEdgeAt(
      x, y,
      this.config.gridWidth,
      this.config.gridHeight,
      this.config.gridType,
      this.config.gridScale
    );

    // Remove previous highlight
    if (this.highlightedEdge) {
      this.edgeContainer.removeChild(this.highlightedEdge);
      this.highlightedEdge = null;
    }

    // Draw new highlight
    if (edgeInfo) {
      const highlightColor = typeof this.config.edgeHighlightColor === 'string' 
        ? this.config.edgeHighlightColor 
        : '#ffff00';
      this.highlightedEdge = this.gridRenderer.drawEdge(edgeInfo, highlightColor);
      this.edgeContainer.addChild(this.highlightedEdge);
    }
  }

  private handleMouseDown(e: MouseEvent) {
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - this.gridContainer.x;
    const y = e.clientY - rect.top - this.gridContainer.y;

    const cellInfo = this.gridRenderer.getCellAt(
      x, y,
      this.config.gridWidth,
      this.config.gridHeight,
      this.config.gridType,
      this.config.gridScale
    );

    if (cellInfo) {
      this.cellStates[cellInfo.row][cellInfo.col] = this.config.drawState;
      this.updateGrid();
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GridApp());
} else {
  new GridApp();
}

