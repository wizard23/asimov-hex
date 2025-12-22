import { Application, Graphics, Container } from 'pixi.js';
import { Pane } from 'tweakpane';
import { GridRenderer } from './grid-renderer';
import { GridType } from './types';
import { createDrawStateBlade, DrawStateBladeApi } from './draw-state-blade';
import palettesData from './assets/palettes.json';
import { ParticleSystem } from './particle-system';

type ColorValue = string | { r: number; g: number; b: number; a?: number };

interface PaletteData {
  name: string;
  colors: Record<string, string>;
}

type LeftClickMode = 'draw' | 'spawnParticle';
type EdgeSelectionRule = 'randomNoBacktrack' | 'randomWithBacktrack' | 'clockwise' | 'counterClockwise' | 'followCursor' | 'avoidCursor';

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
  particleSpeed: number;
  leftClickMode: LeftClickMode;
  edgeSelectionRule: EdgeSelectionRule;
}

class GridApp {
  private app!: Application;
  private gridRenderer!: GridRenderer;
  private pane!: Pane;
  private config: AppConfig;
  private gridContainer!: Container;
  private edgeContainer!: Container;
  private particleContainer!: Container;
  private highlightedEdge: Graphics | null = null;
  private highlightedCell: Graphics | null = null;
  private highlightedVertex: Graphics | null = null;
  private cellStates: number[][] = [];
  private drawStateBlade: DrawStateBladeApi | null = null;
  private palettes: PaletteData[] = [];
  private particleSystem!: ParticleSystem;
  private mouseX: number = 0;
  private mouseY: number = 0;

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
      particleSpeed: 100,
      leftClickMode: 'spawnParticle',
      edgeSelectionRule: 'randomNoBacktrack',
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
    this.particleContainer = new Container();
    this.app.stage.addChild(this.gridContainer);
    this.app.stage.addChild(this.edgeContainer);
    this.app.stage.addChild(this.particleContainer);

    // Initialize particle system
    this.particleSystem = new ParticleSystem(this.particleContainer);

    // Setup particle update loop
    this.app.ticker.add((ticker) => {
      this.particleSystem.update(
        ticker.deltaMS,
        this.config.particleSpeed,
        this.config.gridScale,
        this.gridRenderer,
        this.config.gridWidth,
        this.config.gridHeight,
        this.config.gridType,
        this.config.edgeSelectionRule,
        this.mouseX,
        this.mouseY
      );
    });

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
      max: 100,
      step: 1,
      label: 'Grid Scale',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add number of states control
    this.pane.addBinding(this.config, 'numStates', {
      min: 2,
      max: 8,
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

    // Add left click mode dropdown
    this.pane.addBinding(this.config, 'leftClickMode', {
      options: {
        'Draw Cell': 'draw',
        'Spawn Particle': 'spawnParticle',
      },
      label: 'Left Click Mode',
    });

    // Add particle speed control
    this.pane.addBinding(this.config, 'particleSpeed', {
      min: 1,
      max: 400,
      step: 1,
      label: 'Particle Speed',
    });

    // Add edge selection rule dropdown
    this.pane.addBinding(this.config, 'edgeSelectionRule', {
      options: {
        'Random (No Backtrack)': 'randomNoBacktrack',
        'Random (With Backtrack)': 'randomWithBacktrack',
        'Always Turn Clockwise': 'clockwise',
        'Always Turn Counter-Clockwise': 'counterClockwise',
        'Follow Cursor': 'followCursor',
        'Avoid Cursor': 'avoidCursor',
      },
      label: 'Edge Selection Rule',
    });

    // Add save/load PNG buttons
    this.pane.addButton({
      title: 'Save to PNG',
      label: 'Save to PNG',
    }).on('click', () => {
      this.saveToPNG();
    });

    this.pane.addButton({
      title: 'Load from PNG',
      label: 'Load from PNG',
    }).on('click', () => {
      this.loadFromPNG();
    });
  }

  private saveToPNG() {
    // Create a canvas with grid dimensions
    const canvas = document.createElement('canvas');
    canvas.width = this.config.gridWidth;
    canvas.height = this.config.gridHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create ImageData
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Convert states to grayscale
    for (let row = 0; row < this.config.gridHeight; row++) {
      for (let col = 0; col < this.config.gridWidth; col++) {
        const state = this.cellStates[row]?.[col] ?? 0;
        const grayscale = Math.round(255 * state / (this.config.numStates - 1));
        const index = (row * canvas.width + col) * 4;
        data[index] = grayscale;     // R
        data[index + 1] = grayscale; // G
        data[index + 2] = grayscale; // B
        data[index + 3] = 255;       // A
      }
    }

    // Draw ImageData to canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert to PNG and download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grid.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  private loadFromPNG() {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create temporary canvas to read image data
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Resize grid if needed
          if (canvas.width !== this.config.gridWidth || canvas.height !== this.config.gridHeight) {
            this.config.gridWidth = canvas.width;
            this.config.gridHeight = canvas.height;
            // Update Tweakpane controls if they exist
            // (The grid will be resized in updateGrid)
          }

          // Initialize cell states array
          this.cellStates = Array(this.config.gridHeight)
            .fill(0)
            .map(() => Array(this.config.gridWidth).fill(0));

          // Convert grayscale back to states
          for (let row = 0; row < this.config.gridHeight; row++) {
            for (let col = 0; col < this.config.gridWidth; col++) {
              const index = (row * canvas.width + col) * 4;
              const r = data[index];
              const g = data[index + 1];
              const b = data[index + 2];
              // Use average of RGB as grayscale value
              const grayscale = Math.round((r + g + b) / 3);
              // Convert back to state
              const state = Math.round(grayscale * (this.config.numStates - 1) / 255);
              // Clamp to valid range
              this.cellStates[row][col] = Math.max(0, Math.min(this.config.numStates - 1, state));
            }
          }

          // Update grid display
          this.updateGrid();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
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

    // Clear existing graphics (but keep particles)
    this.gridContainer.removeChildren();
    this.edgeContainer.removeChildren();
    this.highlightedEdge = null;
    this.highlightedCell = null;
    this.highlightedVertex = null;

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

    // Position all containers at the same offset so cells, edges, and particles align
    this.gridContainer.x = offsetX;
    this.gridContainer.y = offsetY;
    this.edgeContainer.x = offsetX;
    this.edgeContainer.y = offsetY;
    this.particleContainer.x = offsetX;
    this.particleContainer.y = offsetY;

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

    // Store mouse position for particle cursor rules
    this.mouseX = x;
    this.mouseY = y;

    // Remove previous highlights
    if (this.highlightedEdge) {
      this.edgeContainer.removeChild(this.highlightedEdge);
      this.highlightedEdge = null;
    }
    if (this.highlightedCell) {
      this.gridContainer.removeChild(this.highlightedCell);
      this.highlightedCell = null;
    }
    if (this.highlightedVertex) {
      this.edgeContainer.removeChild(this.highlightedVertex);
      this.highlightedVertex = null;
    }

    if (this.config.leftClickMode === 'draw') {
      // Highlight cell
      const cellInfo = this.gridRenderer.getCellAt(
        x, y,
        this.config.gridWidth,
        this.config.gridHeight,
        this.config.gridType,
        this.config.gridScale
      );

      if (cellInfo) {
        const highlightColor = typeof this.config.edgeHighlightColor === 'string' 
          ? this.config.edgeHighlightColor 
          : '#ffff00';
        this.highlightedCell = this.gridRenderer.drawCellHighlight(
          cellInfo,
          this.config.gridWidth,
          this.config.gridHeight,
          this.config.gridType,
          this.config.gridScale,
          highlightColor
        );
        this.gridContainer.addChild(this.highlightedCell);
      }
    } else {
      // Highlight edge and closest vertex
      const edgeInfo = this.gridRenderer.getEdgeAt(
        x, y,
        this.config.gridWidth,
        this.config.gridHeight,
        this.config.gridType,
        this.config.gridScale
      );

      if (edgeInfo) {
        const highlightColor = typeof this.config.edgeHighlightColor === 'string' 
          ? this.config.edgeHighlightColor 
          : '#ffff00';
        this.highlightedEdge = this.gridRenderer.drawEdge(edgeInfo, highlightColor);
        this.edgeContainer.addChild(this.highlightedEdge);

        // Find and highlight closest vertex
        const closestVertex = this.gridRenderer.getClosestVertex(
          x, y,
          this.config.gridWidth,
          this.config.gridHeight,
          this.config.gridType,
          this.config.gridScale
        );

        if (closestVertex) {
          this.highlightedVertex = this.gridRenderer.drawVertex(closestVertex, highlightColor);
          if (this.highlightedVertex) {
            this.edgeContainer.addChild(this.highlightedVertex);
          }
        }
      }
    }
  }

  private handleMouseDown(e: MouseEvent) {
    const canvas = this.app.canvas;
    const rect = canvas.getBoundingClientRect();

    console.log("leftClickMode", this.config.leftClickMode);
    
    if (e.button === 0) {
      console.log("left click");

      // Left click
      if (this.config.leftClickMode === 'spawnParticle') {
        console.log("spawn branch");

        // Check for edge click for particle spawning
        const edgeX = e.clientX - rect.left - this.edgeContainer.x;
        const edgeY = e.clientY - rect.top - this.edgeContainer.y;
        
        const edgeInfo = this.gridRenderer.getEdgeAt(
          edgeX, edgeY,
          this.config.gridWidth,
          this.config.gridHeight,
          this.config.gridType,
          this.config.gridScale
        );

        if (edgeInfo) {
          // Spawn particle on edge click
          this.particleSystem.spawnParticle(edgeInfo, edgeX, edgeY);
          return;
        }
      } else {
        console.log("draw branch");
        
        // Draw mode - check for cell click
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
    } else if (e.button === 2) {
      // Right click: always clear cell (set to state 0)
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
        this.cellStates[cellInfo.row][cellInfo.col] = 0;
        this.updateGrid();
      }
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GridApp());
} else {
  new GridApp();
}

