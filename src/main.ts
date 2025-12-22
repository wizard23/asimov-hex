import { Application, Graphics, Container } from 'pixi.js';
import { Pane } from 'tweakpane';
import { GridRenderer } from './grid-renderer';
import { GridType } from './types';
import { createDrawStateBlade, DrawStateBladeApi } from './draw-state-blade';
import palettesData from './assets/palettes.json';

type ColorValue = string | { r: number; g: number; b: number; a?: number };

interface PaletteData {
  name: string;
  colors: Record<string, string>;
}

interface AppConfig {
  gridWidth: number;
  gridHeight: number;
  gridType: GridType;
  gridScale: number;
  numStates: number;
  drawState: number;
  palette: Record<number, ColorValue>;
  selectedPalette: string;
  edgeColor: ColorValue;
  edgeHighlightColor: ColorValue;
  showCoordinates: boolean;
}

class GridApp {
  private app!: Application;
  private gridRenderer!: GridRenderer;
  private pane!: Pane;
  private config: AppConfig;
  private gridContainer!: Container;
  private edgeContainer!: Container;
  private highlightedEdge: Graphics | null = null;
  private cellStates: number[][] = [];
  private drawStateBlade: DrawStateBladeApi | null = null;
  private palettes: PaletteData[] = [];

  constructor() {
    // Load palettes from JSON
    this.palettes = palettesData.palettes;
    
    // Initialize with first palette
    const defaultPalette = this.palettes[0];
    const initialPalette: Record<number, ColorValue> = {};
    Object.keys(defaultPalette.colors).forEach(key => {
      initialPalette[parseInt(key)] = defaultPalette.colors[key];
    });

    this.config = {
      gridWidth: 25,
      gridHeight: 18,
      gridType: 'hexagons',
      gridScale: 30,
      numStates: 8,
      drawState: 7,
      palette: initialPalette,
      selectedPalette: defaultPalette.name,
      edgeColor: '#ffffff',
      edgeHighlightColor: '#ffff00',
      showCoordinates: false,
    };

    this.initPixi().then(() => {
      this.initTweakpane();
      this.initGrid();
      this.setupInteraction();
    });
  }

  private applyPalette(paletteName: string) {
    const palette = this.palettes.find(p => p.name === paletteName);
    if (!palette) return;

    // Update palette in config
    Object.keys(palette.colors).forEach(key => {
      this.config.palette[parseInt(key)] = palette.colors[key];
    });

    // Update draw state blade to reflect new colors
    this.updateDrawStateBlade();
    
    // Update grid rendering
    this.updateGrid();
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
      appElement.appendChild(this.app.canvas);
    }

    this.gridContainer = new Container();
    this.edgeContainer = new Container();
    this.app.stage.addChild(this.gridContainer);
    this.app.stage.addChild(this.edgeContainer);

    // resizeTo: window handles resizing automatically
  }

  private initTweakpane() {
    this.pane = new Pane({ title: 'Grid Controls' });

    // Add grid width control
    this.pane.addBinding(this.config, 'gridWidth', {
      min: 1,
      max: 80,
      step: 1,
      label: 'Grid Width',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add grid height control
    this.pane.addBinding(this.config, 'gridHeight', {
      min: 1,
      max: 50,
      step: 1,
      label: 'Grid Height',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add grid type control
    this.pane.addBinding(this.config, 'gridType', {
      options: {
        squares: 'squares',
        hexagons: 'hexagons',
        triangles: 'triangles',
      },
      label: 'Grid Type',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add grid scale control
    this.pane.addBinding(this.config, 'gridScale', {
      min: 5,
      max: 50,
      step: 1,
      label: 'Grid Scale',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add number of states control
    this.pane.addBinding(this.config, 'numStates', {
      min: 2,
      max: 16,
      step: 1,
      label: 'Number of States',
    }).on('change', () => {
      // Clamp drawState to valid range when numStates changes
      if (this.config.drawState >= this.config.numStates) {
        this.config.drawState = this.config.numStates - 1;
      }
      // Rebuild draw state selector
      this.updateDrawStateBlade();
      this.updateGrid();
    });

    // Add palette selection dropdown
    const paletteOptions: Record<string, string> = {};
    this.palettes.forEach(palette => {
      paletteOptions[palette.name] = palette.name;
    });
    
    this.pane.addBinding(this.config, 'selectedPalette', {
      options: paletteOptions,
      label: 'Palette',
    }).on('change', () => {
      this.applyPalette(this.config.selectedPalette);
    });

    // Add draw state selector (palette color picker)
    this.updateDrawStateBlade();

    // Add show coordinates checkbox
    this.pane.addBinding(this.config, 'showCoordinates', {
      label: 'Show Coordinates',
    }).on('change', () => {
      this.updateGrid();
    });
  }

  private updateDrawStateBlade() {
    // Remove existing blade if it exists
    if (this.drawStateBlade) {
      this.drawStateBlade.dispose();
    }

    // Create custom blade for draw state selection
    this.drawStateBlade = createDrawStateBlade({
      numStates: this.config.numStates,
      palette: this.config.palette,
      drawState: this.config.drawState,
      onStateChange: (state: number) => {
        this.config.drawState = state;
        if (this.drawStateBlade) {
          this.drawStateBlade.update({
            numStates: this.config.numStates,
            palette: this.config.palette,
            drawState: this.config.drawState,
            onStateChange: (state: number) => {
              this.config.drawState = state;
            },
          });
        }
      },
    });

    // Add the blade to the pane
    this.pane.add(this.drawStateBlade);
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
      const hexSpacingX = this.config.gridScale * Math.sqrt(3);
      const hexSpacingY = this.config.gridScale * 1.5;
      gridWidth = this.config.gridWidth * hexSpacingX + this.config.gridScale;
      gridHeight = this.config.gridHeight * hexSpacingY + this.config.gridScale;
    } else { // triangles
      const triangleHeight = this.config.gridScale * Math.sqrt(3) / 2;
      gridWidth = this.config.gridWidth * this.config.gridScale * 0.5 + this.config.gridScale;
      gridHeight = this.config.gridHeight * triangleHeight + triangleHeight;
    }

    // Center the grid
    const offsetX = (this.app.screen.width - gridWidth) / 2;
    const offsetY = (this.app.screen.height - gridHeight) / 2;

    // Position both containers at the same offset so cells and edges align
    this.gridContainer.x = offsetX;
    this.gridContainer.y = offsetY;
    this.edgeContainer.x = offsetX;
    this.edgeContainer.y = offsetY;

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
      typeof this.config.edgeColor === 'string' ? this.config.edgeColor : '#ffffff',
      this.config.showCoordinates
    );
  }

  private setupInteraction() {
    const canvas = this.app.canvas;
    canvas.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
    canvas.addEventListener('mousedown', (e: MouseEvent) => this.handleMouseDown(e));
    canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
  }

  private handleMouseMove(e: MouseEvent) {
    const canvas = this.app.canvas;
    const rect = canvas.getBoundingClientRect();
    // Use edgeContainer position since edges are in edgeContainer
    const x = e.clientX - rect.left - this.edgeContainer.x;
    const y = e.clientY - rect.top - this.edgeContainer.y;

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
    const canvas = this.app.canvas;
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
      // Left click: set to draw state, Right click: clear (set to state 0)
      if (e.button === 0) {
        this.cellStates[cellInfo.row][cellInfo.col] = this.config.drawState;
      } else if (e.button === 2) {
        this.cellStates[cellInfo.row][cellInfo.col] = 0;
      }
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

