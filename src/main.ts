import { Application, Graphics, Container } from 'pixi.js';
import { Pane } from 'tweakpane';
import { GridRenderer } from './grid-renderer';
import { GridType, EdgeSelectionRule } from './types';
import { createDrawStateBlade, DrawStateBladeApi } from './draw-state-blade';
import palettesData from './assets/palettes.json';
import { ParticleSystem } from './particle-system';
import { Grid, SquareGrid, HexagonGrid, TriangleGrid, CairoGrid } from './grid';

type ColorValue = string | { r: number; g: number; b: number; a?: number };

interface PaletteData {
  name: string;
  colors: Record<string, string>;
}

type LeftClickMode = 'draw' | 'spawnParticle';

interface AppConfig {
  gridWidth: number;
  gridHeight: number;
  gridType: GridType;
  gridScale: number;
  numStates: number;
  drawState: number;
  palette: Record<number, ColorValue>;
  selectedPalette: string;
  edgePalette: Record<number, ColorValue>; // New: Palette for edges
  selectedEdgePalette: string;             // New: Selected edge palette name
  edgeColor: ColorValue;                   // Re-add edgeColor
  edgeWidth: number;                       // New: for edge width
  edgeHighlightColor: ColorValue;
  visualizeEdgeDelta: boolean;             // New: for delta visualization
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
  private grid!: Grid;

  constructor() {
    // Load palettes from JSON
    this.palettes = palettesData.palettes;
    
    // Initialize with a palette
    const defaultPalette = this.palettes[1] ?? this.palettes[0] ;
    const initialPalette: Record<number, ColorValue> = {};
    Object.keys(defaultPalette.colors).forEach(key => {
      initialPalette[parseInt(key)] = defaultPalette.colors[key];
    });

    // Initialize edge palette with the contrasting default initially
    const defaultEdgePalette = this.palettes[2] ?? defaultPalette;
    const initialEdgePalette: Record<number, ColorValue> = {};
    Object.keys(defaultEdgePalette.colors).forEach(key => {
      initialEdgePalette[parseInt(key)] = defaultEdgePalette.colors[key];
    });

    this.config = {
      gridWidth: 25,
      gridHeight: 18,
      gridType: 'cairo',
      gridScale: 30,
      numStates: 8,
      drawState: 4,
      palette: initialPalette,
      selectedPalette: defaultPalette.name,
      edgePalette: initialEdgePalette,       // New: Initialize edge palette
      selectedEdgePalette: defaultEdgePalette.name, // New: Initialize selected edge palette
      edgeColor: '#ffffff',                  // Re-add edgeColor
      edgeWidth: 2,                          // New: Initialize edge width
      edgeHighlightColor: '#ffff00',
      visualizeEdgeDelta: false,             // New: Initialize delta visualization
      showCoordinates: false,
      particleSpeed: 100,
      leftClickMode: 'draw',
      edgeSelectionRule: 'randomNoBacktrack',
    };

    this.updateGridInstance();

    this.initPixi().then(() => {
      this.initInfoPanel();
      this.initTweakpane();
      this.initGrid();
      this.setupInteraction();
    });
  }

  private updateGridInstance() {
    switch (this.config.gridType) {
      case 'squares':
        this.grid = new SquareGrid(this.config.gridScale);
        break;
      case 'hexagons':
        this.grid = new HexagonGrid(this.config.gridScale);
        break;
      case 'triangles':
        this.grid = new TriangleGrid(this.config.gridScale);
        break;
      case 'cairo':
        this.grid = new CairoGrid({
          scale: this.config.gridScale,
          pentagonType: 'catalan',
        });
        break;
    }
  }

  private initInfoPanel() {
    const panel = document.createElement('div');
    panel.id = 'info-panel';
    
    const header = document.createElement('div');
    header.id = 'info-panel-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Asimov Hex';
    
    const closeButton = document.createElement('button');
    closeButton.id = 'info-panel-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Minimize info panel');
    closeButton.onclick = () => {
      panel.classList.add('minimized');
    };
    
    const reopenButton = document.createElement('button');
    reopenButton.id = 'info-panel-reopen';
    reopenButton.innerHTML = '&nbsp;ℹ';
    reopenButton.setAttribute('aria-label', 'Open info panel');
    reopenButton.onclick = () => {
      panel.classList.remove('minimized');
    };
    
    header.appendChild(title);
    header.appendChild(closeButton);
    header.appendChild(reopenButton);
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'info-panel-tabs';
    
    const aboutTab = document.createElement('div');
    aboutTab.className = 'info-panel-tab active';
    aboutTab.textContent = 'About';
    
    const techTab = document.createElement('div');
    techTab.className = 'info-panel-tab';
    techTab.textContent = 'Tech Stack';
    
    tabsContainer.appendChild(aboutTab);
    tabsContainer.appendChild(techTab);
    
    const aboutContent = document.createElement('div');
    aboutContent.className = 'tab-content active';
    
    const content = document.createElement('div');
    content.id = 'info-panel-content';
    
    const description = document.createElement('p');
    description.textContent = `A vibe-coding testbed for visualizing polygon-based tilings and simulating particles that move along their edges using local interaction rules.`;
    
    content.appendChild(description);
    
    const links = document.createElement('div');
    links.id = 'info-panel-links';
    
    const manualLink = document.createElement('a');
    manualLink.href = '#';
    manualLink.textContent = '📖 User Manual';
    manualLink.onclick = (e) => {
      e.preventDefault();
      alert('Manual coming soon!');
    };
    
    const githubLink = document.createElement('a');
    githubLink.href = 'https://github.com/example/asimov-hex';
    githubLink.textContent = '🔗 GitHub Repository';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    
    const statisticsLink = document.createElement('a');
    statisticsLink.href = 'statistics.html';
    statisticsLink.textContent = '📊 Project Statistics';
    
    const timelineLink = document.createElement('a');
    timelineLink.href = 'timeline.html';
    timelineLink.textContent = '📅 Project Timeline';
    
    links.appendChild(manualLink);
    links.appendChild(githubLink);
    links.appendChild(statisticsLink);
    links.appendChild(timelineLink);
    
    aboutContent.appendChild(content);
    aboutContent.appendChild(links);
    
    const techContent = document.createElement('div');
    techContent.className = 'tab-content';
    
    const techList = document.createElement('div');
    techList.className = 'tech-stack-list';
    
    const libraries = [
      { name: 'Pixi.js', version: '8.0.0', desc: 'High-performance 2D renderer' },
      { name: 'Tweakpane', version: '4.0.3', desc: 'Compact UI for parameters' },
      { name: 'Vite', version: '5.0.8', desc: 'Next-generation frontend tool' },
      { name: 'TypeScript', version: '5.3.3', desc: 'Type-safe JavaScript' },
      { name: 'Vitest', version: '2.0.4', desc: 'Vite-native testing framework' },
      { name: 'tsx', version: '4.21.0', desc: 'TypeScript execution environment' },
    ];
    
    libraries.forEach(lib => {
      const item = document.createElement('div');
      item.className = 'tech-stack-item';
      item.innerHTML = `
        <div>
          <div class="tech-stack-name">${lib.name}</div>
          <div style="font-size: 11px; color: #aaa;">${lib.desc}</div>
        </div>
        <div class="tech-stack-version">${lib.version}</div>
      `;
      techList.appendChild(item);
    });
    
    techContent.appendChild(techList);
    
    const switchTab = (tab: 'about' | 'tech') => {
      if (tab === 'about') {
        aboutTab.classList.add('active');
        techTab.classList.remove('active');
        aboutContent.classList.add('active');
        techContent.classList.remove('active');
      } else {
        techTab.classList.add('active');
        aboutTab.classList.remove('active');
        techContent.classList.add('active');
        aboutContent.classList.remove('active');
      }
    };
    
    aboutTab.onclick = () => switchTab('about');
    techTab.onclick = () => switchTab('tech');
    
    panel.appendChild(header);
    panel.appendChild(tabsContainer);
    panel.appendChild(aboutContent);
    panel.appendChild(techContent);
    
    document.body.appendChild(panel);
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

  private applyEdgePalette(paletteName: string) {
    const palette = this.palettes.find(p => p.name === paletteName);
    if (!palette) return;

    // Update edge palette in config
    Object.keys(palette.colors).forEach(key => {
      this.config.edgePalette[parseInt(key)] = palette.colors[key];
    });
    
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
        this.config.gridWidth,
        this.config.gridHeight,
        this.grid, // Pass grid instance
        this.config.edgeSelectionRule,
        this.mouseX,
        this.mouseY,
        this.cellStates
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
        cairo: 'cairo',
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

    // Add edge palette selection dropdown
    const edgePaletteOptions: Record<string, string> = {};
    this.palettes.forEach(palette => {
      edgePaletteOptions[palette.name] = palette.name;
    });
    
    this.pane.addBinding(this.config, 'selectedEdgePalette', {
      options: edgePaletteOptions,
      label: 'Edge Palette',
    }).on('change', () => {
      this.applyEdgePalette(this.config.selectedEdgePalette);
    });

    // Add edge color picker
    this.pane.addBinding(this.config, 'edgeColor', {
      label: 'Edge Color'
    }).on('change', () => {
      this.updateGrid();
    });

    // Add edge width slider
    this.pane.addBinding(this.config, 'edgeWidth', {
      label: 'Edge Width',
      min: 0,
      max: 10,
      step: 0.1,
    }).on('change', () => {
      this.updateGrid();
    });

    // Add visualize edge delta checkbox
    this.pane.addBinding(this.config, 'visualizeEdgeDelta', {
      label: 'Visualize Edge Delta'
    }).on('change', () => {
      this.updateGrid();
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
        'Highest Edge Delta': 'highestEdgeDelta',
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
    this.updateGridInstance();

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
    } else if (this.config.gridType === 'triangles') {
      const triangleHeight = this.config.gridScale * Math.sqrt(3) / 2;
      gridWidth = this.config.gridWidth * this.config.gridScale * 0.5 + this.config.gridScale;
      gridHeight = this.config.gridHeight * triangleHeight + triangleHeight;
    } else { // cairo
      const cairoGrid = this.grid as CairoGrid;
      const bounds = cairoGrid.getGridBounds(this.config.gridWidth, this.config.gridHeight);
      gridWidth = bounds.width;
      gridHeight = bounds.height;
    }

    // Center the grid
    let offsetX = (this.app.screen.width - gridWidth) / 2;
    let offsetY = (this.app.screen.height - gridHeight) / 2;

    if (this.grid instanceof CairoGrid) {
      const bounds = this.grid.getGridBounds(this.config.gridWidth, this.config.gridHeight);
      offsetX -= bounds.minX;
      offsetY -= bounds.minY;
    }

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

    // Convert edge palette to string format for renderer
    const edgePaletteStrings: Record<number, string> = {};
    for (const [key, value] of Object.entries(this.config.edgePalette)) {
      edgePaletteStrings[parseInt(key)] = typeof value === 'string' ? value : '#000000';
    }

    // Render grid
    this.gridRenderer.render(
      this.gridContainer,
      this.edgeContainer,
      this.config.gridWidth,
      this.config.gridHeight,
      this.grid, // Pass grid instance
      this.cellStates,
      paletteStrings,
      typeof this.config.edgeColor === 'string' ? this.config.edgeColor : '#ffffff',
      this.config.edgeWidth,
      this.config.visualizeEdgeDelta, // Pass visualizeEdgeDelta
      edgePaletteStrings, // Pass edgePalette
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
        this.grid // Pass grid
      );

      if (cellInfo) {
        const highlightColor = typeof this.config.edgeHighlightColor === 'string' 
          ? this.config.edgeHighlightColor 
          : '#ffff00';
        this.highlightedCell = this.gridRenderer.drawCellHighlight(
          cellInfo,
          this.grid, // Pass grid
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
        this.grid // Pass grid
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
          this.grid // Pass grid
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
          this.grid // Pass grid
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
          this.grid // Pass grid
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
        this.grid // Pass grid
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
