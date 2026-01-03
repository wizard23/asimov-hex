import { Application, Graphics, Container } from 'pixi.js';
import { Pane, FolderApi } from 'tweakpane';
import type { BindingApi } from '@tweakpane/core';
import { GridRenderer } from '../../core/rendering/grid-renderer';
import { GridType, EdgeSelectionRule, OrbitAlgorithm, ColorValue, EdgeInfo } from '../../types';
import { createDrawStateBlade, DrawStateBladeApi } from '../../gui/draw-state-blade';
import palettesData from '../../assets/palettes.json';
import { ParticleSystem } from '../../core/particles/particle-system';
import {
  Grid,
  SquareGrid,
  HexagonGrid,
  TriangleGrid,
  CairoGrid,
  getCellAtPixel,
  getEdgeAtPixel,
  CellHit,
} from '../../core/grid';

interface PaletteData {
  name: string;
  colors: Record<string, string>;
}

type LeftClickMode = 'draw' | 'spawnParticle' | 'smart';

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
  orbitDistance: number;
  orbitAlgorithm: OrbitAlgorithm;
  orbitEpsilon: number;
  showOrbit: boolean;
  vertexHighlighting: boolean;
  gridOffset: { x: number; y: number };
  isSimulationRunning: boolean;
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
  private highlightedEdgeInfo: EdgeInfo | null = null;
  private highlightedCellInfo: CellHit | null = null;
  private cellStates: number[][] = [];
  private drawStateBlade: DrawStateBladeApi | null = null;
  private palettes: PaletteData[] = [];
  private particleSystem!: ParticleSystem;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private grid!: Grid;
  private gridFolder: FolderApi | null = null;
  private gridScaleBinding: BindingApi | null = null;
  private orbitDistanceBinding: BindingApi | null = null;
  private gridOffsetBinding: BindingApi | null = null;
  private orbitOverlay: Graphics | null = null;
  private simulationButton: HTMLButtonElement | null = null;
  private isPanning: boolean = false;
  private panStartMouse: { x: number; y: number } | null = null;
  private panStartOffset: { x: number; y: number } | null = null;
  private panStartContainerPos: { x: number; y: number } | null = null;
  private pendingPanDelta: { x: number; y: number } | null = null;
  private panRafId: number | null = null;

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
      gridType: 'hexagons',
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
      particleSpeed: 5,
      leftClickMode: 'smart',
      edgeSelectionRule: 'orbitCursor',
      orbitDistance: 3.25,
      orbitAlgorithm: 'twoStepGradient',
      orbitEpsilon: 0.5,
      showOrbit: true,
      vertexHighlighting: true,
      gridOffset: { x: 0, y: 0 },
      isSimulationRunning: true,
    };

    this.updateGridInstance();

    this.initPixi().then(() => {
      this.initInfoPanel();
      this.initToolbar();
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

    const appsHeader = document.createElement('h2');
    appsHeader.textContent = "Apps"

    const tileEditorLink = document.createElement('a');
    tileEditorLink.href = 'tile-editor.html';
    tileEditorLink.textContent = '🧩 Tile Editor';

    const metaAppsHeader = document.createElement('h2');
    metaAppsHeader.textContent = "Meta Apps"

    const timelineLink = document.createElement('a');
    timelineLink.href = 'timeline.html';
    timelineLink.textContent = '📅 Project Timeline';
    
    const statisticsLink = document.createElement('a');
    statisticsLink.href = 'statistics.html';
    statisticsLink.textContent = '📊 Project Statistics';

    const docsHeader = document.createElement('h2');
    docsHeader.textContent = "Documentation"

    const manualLink = document.createElement('a');
    manualLink.href = 'markdown-viewer.html?url=/documentation/user-manual/main/index.md';
    manualLink.textContent = '📖 User Manual';
    manualLink.target = '_blank';
    manualLink.rel = 'noopener noreferrer';

    
    // const githubLink = document.createElement('a');
    // githubLink.href = 'https://github.com/wizard23/asimov-hex';
    // githubLink.textContent = '🔗 GitHub Repository';
    // githubLink.target = '_blank';
    // githubLink.rel = 'noopener noreferrer';
    
    links.appendChild(appsHeader);
    links.appendChild(tileEditorLink);

    links.appendChild(metaAppsHeader);
    links.appendChild(timelineLink);
    links.appendChild(statisticsLink);
    links.appendChild(docsHeader);
    links.appendChild(manualLink);

    // links.appendChild(githubLink);
    
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

  private initToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-button';
    button.onclick = () => {
      this.config.isSimulationRunning = !this.config.isSimulationRunning;
      this.updateSimulationButton();
    };

    this.simulationButton = button;
    this.updateSimulationButton();

    toolbar.appendChild(button);
    document.body.appendChild(toolbar);
  }

  private updateSimulationButton() {
    if (!this.simulationButton) return;
    const isRunning = this.config.isSimulationRunning;
    this.simulationButton.textContent = isRunning ? 'Pause' : 'Start';
    this.simulationButton.setAttribute(
      'aria-label',
      isRunning ? 'Pause particle simulation' : 'Start particle simulation'
    );
  }

  private applyPaletteToConfig(
    paletteName: string,
    target: Record<number, ColorValue>,
    updateDrawState: boolean
  ) {
    const palette = this.palettes.find(p => p.name === paletteName);
    if (!palette) return;

    Object.keys(palette.colors).forEach(key => {
      target[parseInt(key)] = palette.colors[key];
    });

    if (updateDrawState) {
      this.updateDrawStateBlade();
    }

    this.updateGrid();
  }

  private applyPalette(paletteName: string) {
    this.applyPaletteToConfig(paletteName, this.config.palette, true);
  }

  private applyEdgePalette(paletteName: string) {
    this.applyPaletteToConfig(paletteName, this.config.edgePalette, false);
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
      if (!this.config.isSimulationRunning) return;
      const particleSpeedPx = this.config.particleSpeed * this.config.gridScale;
      const orbitDistancePx = this.config.orbitDistance * this.config.gridScale;
      this.particleSystem.update(
        ticker.deltaMS,
        particleSpeedPx,
        this.config.gridWidth,
        this.config.gridHeight,
        this.grid, // Pass grid instance
        this.config.edgeSelectionRule,
        this.mouseX,
        this.mouseY,
        this.cellStates,
        orbitDistancePx,
        this.config.orbitAlgorithm,
        this.config.orbitEpsilon
      );
    });

    // resizeTo: window handles resizing automatically
  }

  private initTweakpane() {
    const wrap = document.getElementById('pane-wrap');
    if (!wrap) {
      throw new Error('Missing #pane-wrap container for Tweakpane.');
    }
    this.pane = new Pane({ title: 'Grid Controls', container: wrap });
    const fileFolder = this.pane.addFolder({ title: 'File', expanded: false });
    this.gridFolder = this.pane.addFolder({ title: 'Grid', expanded: true });
    const particlesFolder = this.pane.addFolder({ title: 'Particles', expanded: true });
    const guiFolder = this.pane.addFolder({ title: 'GUI', expanded: false });
    const advancedFolder = this.pane.addFolder({ title: 'Advanced', expanded: false });

    // Add palette selection dropdown
    const paletteOptions: Record<string, string> = {};
    this.palettes.forEach(palette => {
      paletteOptions[palette.name] = palette.name;
    });
    
    guiFolder.addBinding(this.config, 'selectedPalette', {
      options: paletteOptions,
      label: 'Palette',
    }).on('change', () => {
      this.applyPalette(this.config.selectedPalette);
    });

    // Add edge width slider
    guiFolder.addBinding(this.config, 'edgeWidth', {
      label: 'Edge Width',
      min: 0,
      max: 10,
      step: 0.1,
    }).on('change', () => {
      this.updateGrid();
    });

    // Add edge color picker
    guiFolder.addBinding(this.config, 'edgeColor', {
      label: 'Edge Color'
    }).on('change', () => {
      this.updateGrid();
    });

    // Add draw state selector (palette color picker)
    this.updateDrawStateBlade();

    // Add grid scale control
    this.gridScaleBinding = this.gridFolder.addBinding(this.config, 'gridScale', {
      min: 1,
      max: 120,
      step: 0.1,
      label: 'Scale',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add grid type control
    this.gridFolder.addBinding(this.config, 'gridType', {
      options: {
        triangles: 'triangles',
        squares: 'squares',
        hexagons: 'hexagons',
        cairo: 'cairo',
      },
      label: 'Type',
    }).on('change', () => {
      this.centerViewToGrid();
    });

    // Add grid width control
    this.gridFolder.addBinding(this.config, 'gridWidth', {
      min: 1,
      max: 80,
      step: 1,
      label: 'Width',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add grid height control
    this.gridFolder.addBinding(this.config, 'gridHeight', {
      min: 1,
      max: 50,
      step: 1,
      label: 'Height',
    }).on('change', () => {
      this.updateGrid();
    });

    this.gridFolder.addButton({
      title: 'Center View',
    }).on('click', () => {
      this.centerViewToGrid();
    });

    // Add particle speed control
    particlesFolder.addBinding(this.config, 'particleSpeed', {
      min: 0.1,
      max: 12,
      step: 0.05,
      label: 'Speed',
    });

    // Add edge selection rule dropdown
    particlesFolder.addBinding(this.config, 'edgeSelectionRule', {
      options: {
        'Random (No Backtrack)': 'randomNoBacktrack',
        'Random (With Backtrack)': 'randomWithBacktrack',
        'Always Turn Clockwise': 'clockwise',
        'Always Turn Counter-Clockwise': 'counterClockwise',
        'Follow Cursor': 'followCursor',
        'Avoid Cursor': 'avoidCursor',
        'Orbit Cursor': 'orbitCursor',
        'Highest Edge Delta': 'highestEdgeDelta',
      },
      label: 'Algorithm',
    }).on('change', () => {
      this.updateOrbitDistanceVisibility();
      this.updateOrbitOverlay();
    });

    particlesFolder.addButton({
      title: 'Clear Particles',
    }).on('click', () => {
      this.particleSystem.clear();
    });

    this.orbitDistanceBinding = particlesFolder.addBinding(this.config, 'orbitDistance', {
      min: 0.1,
      max: 15,
      step: 0.05,
      label: 'Orbit Radius',
    }).on('change', () => {
      this.updateOrbitOverlay();
    });

    this.updateOrbitDistanceVisibility();

    // Add left click mode dropdown
    advancedFolder.addBinding(this.config, 'leftClickMode', {
      options: {
        'Draw Cell': 'draw',
        'Spawn Particle': 'spawnParticle',
        'Smart': 'smart',
      },
      label: 'Click Tool',
    });

    advancedFolder.addBinding(this.config, 'orbitAlgorithm', {
      options: {
        'Gradient': 'gradient',
        '2 Step Gradient': 'twoStepGradient',
        '3 Step Gradient': 'threeStepGradient',
        '4 Step Gradient': 'fourStepGradient',
        'Distance To Endpoint': 'distanceToEndpoint',
      },
      label: 'Orbit Algorithm',
    });

    advancedFolder.addBinding(this.config, 'showOrbit', {
      label: 'Show Orbit',
    }).on('change', () => {
      this.updateOrbitOverlay();
    });

    advancedFolder.addBinding(this.config, 'orbitEpsilon', {
      min: 0.01,
      max: 2,
      step: 0.01,
      label: 'Orbit Epsilon',
    });

    this.gridOffsetBinding = advancedFolder.addBinding(this.config, 'gridOffset', {
      label: 'Grid Offset',
      x: { min: -40, max: 40, step: 0.001 },
      y: { min: -40, max: 40, step: 0.001 },
    }).on('change', () => {
      this.updateGrid();
    });

    advancedFolder.addBinding(this.config, 'vertexHighlighting', {
      label: 'Vertex Highlighting',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add number of states control
    advancedFolder.addBinding(this.config, 'numStates', {
      min: 2,
      max: 8,
      step: 1,
      label: 'Cell States',
    }).on('change', () => {
      // Clamp drawState to valid range when numStates changes
      if (this.config.drawState >= this.config.numStates) {
        this.config.drawState = this.config.numStates - 1;
      }
      // Rebuild draw state selector
      this.updateDrawStateBlade();
      this.updateGrid();
    });

    // Add show coordinates checkbox
    advancedFolder.addBinding(this.config, 'showCoordinates', {
      label: 'Show Coordinates',
    }).on('change', () => {
      this.updateGrid();
    });

    // Add visualize edge delta checkbox
    advancedFolder.addBinding(this.config, 'visualizeEdgeDelta', {
      label: 'Show Edge Delta'
    }).on('change', () => {
      this.updateGrid();
    });

    // Add edge palette selection dropdown
    const edgePaletteOptions: Record<string, string> = {};
    this.palettes.forEach(palette => {
      edgePaletteOptions[palette.name] = palette.name;
    });
    
    advancedFolder.addBinding(this.config, 'selectedEdgePalette', {
      options: edgePaletteOptions,
      label: 'Edge Palette',
    }).on('change', () => {
      this.applyEdgePalette(this.config.selectedEdgePalette);
    });

    // Add save/load PNG buttons
    fileFolder.addButton({
      title: 'Save to PNG',
    }).on('click', () => {
      this.saveToPNG();
    });

    fileFolder.addButton({
      title: 'Load from PNG',
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
            .map(() => Array(this.config.gridWidth).fill(0) as number[]);

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

    // Add the blade to the grid folder
    if (this.gridFolder) {
      this.gridFolder.add(this.drawStateBlade);
    } else {
      this.pane.add(this.drawStateBlade);
    }
  }

  private updateOrbitDistanceVisibility() {
    if (!this.orbitDistanceBinding) return;
    const isOrbit = this.config.edgeSelectionRule === 'orbitCursor';
    this.orbitDistanceBinding.element.style.display = isOrbit ? '' : 'none';
  }

  private updateOrbitOverlay() {
    if (this.orbitOverlay) {
      this.edgeContainer.removeChild(this.orbitOverlay);
      this.orbitOverlay = null;
    }

    if (!this.config.showOrbit || this.config.edgeSelectionRule !== 'orbitCursor' || this.config.orbitDistance <= 0) {
      return;
    }

    const graphics = new Graphics();
    const orbitDistancePx = this.config.orbitDistance * this.config.gridScale;
    graphics.circle(this.mouseX, this.mouseY, orbitDistancePx).stroke({ color: 0x888888, width: 2 });
    this.edgeContainer.addChild(graphics);
    this.orbitOverlay = graphics;
  }

  private spawnParticleOnRandomCellEdge(cell: CellHit) {
    const edges = this.grid.getCellEdges({ col: cell.col, row: cell.row });
    if (edges.length === 0) return;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const progress = 0.5;
    const direction = Math.random() < 0.5 ? -1 : 1;
    this.particleSystem.spawnParticleOnEdge(edge, progress, direction);
  }

  private initGrid() {
    this.gridRenderer = new GridRenderer();
    this.updateGrid();
  }

  private updateGrid() {
    this.updateGridInstance();

    // Initialize cell states if needed
    if (
      this.cellStates.length !== this.config.gridHeight ||
      this.cellStates[0]?.length !== this.config.gridWidth
    ) {
      this.resizeCellStates(this.config.gridWidth, this.config.gridHeight);
    }

    // Clear existing graphics (but keep particles)
    this.gridContainer.removeChildren();
    this.edgeContainer.removeChildren();
    this.highlightedEdge = null;
    this.highlightedCell = null;
    this.highlightedVertex = null;

    const bounds = this.getGridBounds(this.config.gridWidth, this.config.gridHeight);
    const gridWidth = bounds.maxX - bounds.minX;
    const gridHeight = bounds.maxY - bounds.minY;

    // Center the grid based on true bounds
    const centerOffsetX = (this.app.screen.width - gridWidth) / 2 - bounds.minX;
    const centerOffsetY = (this.app.screen.height - gridHeight) / 2 - bounds.minY;
    const offsetX = centerOffsetX + this.config.gridOffset.x * this.config.gridScale;
    const offsetY = centerOffsetY + this.config.gridOffset.y * this.config.gridScale;

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

    this.updateOrbitOverlay();
  }

  private resizeCellStates(width: number, height: number) {
    const previous = this.cellStates;
    const next = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0) as number[]);

    const rows = Math.min(height, previous.length);
    const cols = Math.min(width, previous[0]?.length ?? 0);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        next[row][col] = previous[row]?.[col] ?? 0;
      }
    }

    this.cellStates = next;
  }

  private getGridBounds(width: number, height: number) {
    return this.getGridBoundsForGrid(this.grid, width, height);
  }

  private getGridBoundsForScale(scale: number) {
    let grid: Grid;
    if (this.config.gridType === 'squares') {
      grid = new SquareGrid(scale);
    } else if (this.config.gridType === 'hexagons') {
      grid = new HexagonGrid(scale);
    } else if (this.config.gridType === 'triangles') {
      grid = new TriangleGrid(scale);
    } else {
      const cairoGrid = new CairoGrid({ scale, pentagonType: 'catalan' });
      const bounds = cairoGrid.getGridBounds(this.config.gridWidth, this.config.gridHeight);
      return {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.minX + bounds.width,
        maxY: bounds.minY + bounds.height,
      };
    }

    return this.getGridBoundsForGrid(grid, this.config.gridWidth, this.config.gridHeight);
  }

  private getGridBoundsForGrid(grid: Grid, width: number, height: number) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const poly = grid.getCellPolygon({ col, row });
        for (const point of poly) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    return { minX, minY, maxX, maxY };
  }

  private getCenterOffsetForScale(scale: number) {
    const bounds = this.getGridBoundsForScale(scale);
    const gridWidth = bounds.maxX - bounds.minX;
    const gridHeight = bounds.maxY - bounds.minY;
    return {
      x: (this.app.screen.width - gridWidth) / 2 - bounds.minX,
      y: (this.app.screen.height - gridHeight) / 2 - bounds.minY,
    };
  }

  private centerViewToGrid() {
    const bounds = this.getGridBoundsForScale(1);
    const gridWidth = bounds.maxX - bounds.minX;
    const gridHeight = bounds.maxY - bounds.minY;
    if (gridWidth <= 0 || gridHeight <= 0) return;

    const maxScale = Math.floor(
      Math.min(this.app.screen.width / gridWidth, this.app.screen.height / gridHeight)
    );
    const clampedScale = Math.max(1, Math.min(100, maxScale));
    if (!Number.isFinite(clampedScale) || clampedScale <= 0) return;

    this.config.gridScale = clampedScale;
    this.config.gridOffset = { x: 0, y: 0 };
    this.gridScaleBinding?.refresh();
    this.gridOffsetBinding?.refresh();
    this.updateGrid();
  }

  private setupInteraction() {
    const canvas = this.app.canvas;
    canvas.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
    canvas.addEventListener('mousedown', (e: MouseEvent) => this.handleMouseDown(e));
    canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
    canvas.addEventListener('wheel', (e: WheelEvent) => this.handleMouseWheel(e), { passive: false });
    window.addEventListener('mouseup', () => this.handleMouseUp());
    window.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e));
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isPanning && this.panStartMouse && this.panStartOffset) {
      const dx = e.clientX - this.panStartMouse.x;
      const dy = e.clientY - this.panStartMouse.y;
      this.pendingPanDelta = { x: dx, y: dy };
      if (this.panRafId === null) {
        this.panRafId = requestAnimationFrame(() => {
          this.panRafId = null;
          if (!this.isPanning || !this.panStartOffset || !this.panStartContainerPos || !this.pendingPanDelta) {
            return;
          }
          const delta = this.pendingPanDelta;
          this.config.gridOffset = {
            x: this.panStartOffset.x + delta.x / this.config.gridScale,
            y: this.panStartOffset.y + delta.y / this.config.gridScale,
          };
          const nextX = this.panStartContainerPos.x + delta.x;
          const nextY = this.panStartContainerPos.y + delta.y;
          this.gridContainer.x = nextX;
          this.gridContainer.y = nextY;
          this.edgeContainer.x = nextX;
          this.edgeContainer.y = nextY;
          this.particleContainer.x = nextX;
          this.particleContainer.y = nextY;
        });
      }
      return;
    }

    const canvas = this.app.canvas;
    const rect = canvas.getBoundingClientRect();
    // Use edgeContainer position since edges are in edgeContainer
    const x = e.clientX - rect.left - this.edgeContainer.x;
    const y = e.clientY - rect.top - this.edgeContainer.y;

    // Store mouse position for particle cursor rules
    this.mouseX = x;
    this.mouseY = y;
    this.updateOrbitOverlay();

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
    this.highlightedEdgeInfo = null;
    this.highlightedCellInfo = null;

    const isSmartMode = this.config.leftClickMode === 'smart';
    const edgeInfo = (this.config.leftClickMode === 'spawnParticle' || isSmartMode)
      ? getEdgeAtPixel(
          this.grid,
          this.config.gridWidth,
          this.config.gridHeight,
          x,
          y,
          10
        )
      : null;

    if (edgeInfo) {
      // Highlight edge and closest vertex
      const highlightColor = typeof this.config.edgeHighlightColor === 'string' 
        ? this.config.edgeHighlightColor 
        : '#ffff00';
      this.highlightedEdge = this.gridRenderer.drawEdge(edgeInfo, highlightColor);
      this.edgeContainer.addChild(this.highlightedEdge);
      this.highlightedEdgeInfo = edgeInfo;

      if (this.config.vertexHighlighting) {
        const p1 = edgeInfo.points[0];
        const p2 = edgeInfo.points[1];
        const dist1 = Math.hypot(x - p1.x, y - p1.y);
        const dist2 = Math.hypot(x - p2.x, y - p2.y);
        const closestVertex = dist1 <= dist2 ? p1 : p2;
        this.highlightedVertex = this.gridRenderer.drawVertex(closestVertex, highlightColor);
        if (this.highlightedVertex) {
          this.edgeContainer.addChild(this.highlightedVertex);
        }
      }
    } else if (this.config.leftClickMode === 'draw' || isSmartMode || this.config.leftClickMode === 'spawnParticle') {
      // Highlight cell
      const cellInfo = getCellAtPixel(
        this.grid,
        this.config.gridWidth,
        this.config.gridHeight,
        x,
        y
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
        this.highlightedCellInfo = cellInfo;
      }
    }
  }

  private handleMouseLeave() {
    this.mouseX = 0;
    this.mouseY = 0;

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
    this.highlightedEdgeInfo = null;
    this.highlightedCellInfo = null;
    this.updateOrbitOverlay();
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.ctrlKey) {
      this.isPanning = true;
      this.panStartMouse = { x: e.clientX, y: e.clientY };
      this.panStartOffset = { ...this.config.gridOffset };
      this.panStartContainerPos = { x: this.gridContainer.x, y: this.gridContainer.y };
      this.pendingPanDelta = null;
      if (this.panRafId !== null) {
        cancelAnimationFrame(this.panRafId);
        this.panRafId = null;
      }
      return;
    }

    if (e.button === 0) {
      // Left click
      if (this.config.leftClickMode === 'smart') {
        if (this.highlightedEdgeInfo) {
          this.particleSystem.spawnParticle(this.highlightedEdgeInfo, this.mouseX, this.mouseY);
          return;
        }

        if (this.highlightedCellInfo) {
          if (e.shiftKey) {
            this.spawnParticleOnRandomCellEdge(this.highlightedCellInfo);
          } else {
            this.cellStates[this.highlightedCellInfo.row][this.highlightedCellInfo.col] = this.config.drawState;
            this.updateGrid();
          }
          return;
        }
      }

      if (this.config.leftClickMode === 'spawnParticle') {
        if (this.highlightedEdgeInfo) {
          this.particleSystem.spawnParticle(this.highlightedEdgeInfo, this.mouseX, this.mouseY);
          return;
        }

        if (this.highlightedCellInfo) {
          this.spawnParticleOnRandomCellEdge(this.highlightedCellInfo);
          return;
        }
      }

      if (this.config.leftClickMode === 'draw') {
        if (this.highlightedCellInfo) {
          this.cellStates[this.highlightedCellInfo.row][this.highlightedCellInfo.col] = this.config.drawState;
          this.updateGrid();
        }
        return;
      }
    } else if (e.button === 2) {
      // Right click: highlight-only actions
      const isShift = e.shiftKey;
      if (this.config.leftClickMode === 'spawnParticle') {
        if (this.highlightedEdgeInfo) {
          this.particleSystem.removeParticlesOnEdge(this.highlightedEdgeInfo);
        }
        if (this.highlightedCellInfo) {
          const edges = this.grid.getCellEdges({
            col: this.highlightedCellInfo.col,
            row: this.highlightedCellInfo.row,
          });
          this.particleSystem.removeParticlesOnEdges(edges);
        }
        return;
      }

      if (this.config.leftClickMode === 'smart') {
        if (isShift) {
          if (this.highlightedEdgeInfo) {
            this.particleSystem.removeParticlesOnEdge(this.highlightedEdgeInfo);
          }
          if (!this.highlightedEdgeInfo && this.highlightedCellInfo) {
            const edges = this.grid.getCellEdges({
              col: this.highlightedCellInfo.col,
              row: this.highlightedCellInfo.row,
            });
            this.particleSystem.removeParticlesOnEdges(edges);
          }
          return;
        }

        if (this.highlightedEdgeInfo) {
          this.particleSystem.removeParticlesOnEdge(this.highlightedEdgeInfo);
          return;
        }
        if (this.highlightedCellInfo) {
          this.cellStates[this.highlightedCellInfo.row][this.highlightedCellInfo.col] = 0;
          this.updateGrid();
          return;
        }
        return;
      }

      if (this.config.leftClickMode === 'draw') {
        if (this.highlightedCellInfo) {
          this.cellStates[this.highlightedCellInfo.row][this.highlightedCellInfo.col] = 0;
          this.updateGrid();
        }
        return;
      }
    }
  }

  private handleMouseUp(): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.panStartMouse = null;
    this.panStartOffset = null;
    this.panStartContainerPos = null;
    this.pendingPanDelta = null;
    if (this.panRafId !== null) {
      cancelAnimationFrame(this.panRafId);
      this.panRafId = null;
    }
    this.gridOffsetBinding?.refresh();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.code !== 'Space') return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
    this.config.isSimulationRunning = !this.config.isSimulationRunning;
    this.updateSimulationButton();
  }

  private handleMouseWheel(e: WheelEvent) {
    e.preventDefault();
    const direction = Math.sign(e.deltaY);
    if (direction === 0) return;
    const currentScale = this.config.gridScale;
    const zoomFactor = 31 / 30;
    const nextScale = direction > 0
      ? Math.max(5, Math.min(100, currentScale / zoomFactor))
      : Math.max(5, Math.min(100, currentScale * zoomFactor));
    if (nextScale === currentScale) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const baseX = (cursorX - this.gridContainer.x) / currentScale;
    const baseY = (cursorY - this.gridContainer.y) / currentScale;

    const nextCenterOffset = this.getCenterOffsetForScale(nextScale);
    this.config.gridScale = nextScale;
    this.config.gridOffset = {
      x: (cursorX - baseX * nextScale - nextCenterOffset.x) / nextScale,
      y: (cursorY - baseY * nextScale - nextCenterOffset.y) / nextScale,
    };

    this.gridScaleBinding?.refresh();
    this.gridOffsetBinding?.refresh();
    this.updateGrid();

    this.mouseX = cursorX - this.edgeContainer.x;
    this.mouseY = cursorY - this.edgeContainer.y;
    this.updateOrbitOverlay();
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GridApp());
} else {
  new GridApp();
}
