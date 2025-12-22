# System Description

## Overview

This application is an interactive grid editor built with TypeScript, PixiJS, and Tweakpane. It allows users to create and edit grids composed of cells that can exist in multiple states, with support for three different grid types: squares, hexagons, and triangles. The application provides real-time visual feedback through edge highlighting and coordinate display, with all parameters configurable via a Tweakpane sidebar.

## Technology Stack

### Core Technologies
- **TypeScript** (v5.3.3): Primary programming language with strict type checking
- **Vite** (v5.0.8): Build tool and development server
- **PixiJS** (v8.0.0): 2D WebGL/Canvas rendering engine for graphics
- **Tweakpane** (v4.0.3): GUI library for parameter tuning
- **@tweakpane/core** (v2.0.5): Core types and utilities for Tweakpane

### Build Configuration
- **Target**: ES2020, modern browsers
- **Module System**: ESNext modules
- **Development Server**: Port 3000 with auto-open

## Architecture

### High-Level Structure

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│           GridApp (main.ts)              │
│  - Application orchestration             │
│  - Configuration management              │
│  - Event handling                        │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                 │
┌──────▼──────┐  ┌──────▼──────────┐
│ GridRenderer│  │ Tweakpane UI     │
│             │  │ - Controls       │
│ - Rendering │  │ - Custom Blade   │
│ - Hit tests │  └──────────────────┘
└─────────────┘
```

### Component Responsibilities

#### 1. GridApp (`src/main.ts`)

The main application class that orchestrates all components:

- **Initialization**:
  - Sets up PixiJS Application with WebGL/Canvas rendering
  - Initializes Tweakpane with all configuration controls
  - Creates grid state data structures
  - Sets up mouse interaction handlers

- **State Management**:
  - Maintains `AppConfig` with all user-configurable parameters
  - Manages `cellStates: number[][]` - 2D array storing cell state values
  - Tracks currently selected draw state

- **Rendering Coordination**:
  - Delegates rendering to `GridRenderer`
  - Manages two PixiJS containers: `gridContainer` (cells) and `edgeContainer` (edges)
  - Handles edge highlighting on mouseover

- **User Interaction**:
  - Left-click: Sets cell state to current draw state
  - Right-click: Clears cell (sets state to 0)
  - Mouse move: Highlights edges and detects cell/edge intersections

#### 2. GridRenderer (`src/grid-renderer.ts`)

Handles all grid rendering logic for different grid types:

- **Rendering Methods**:
  - `renderSquares()`: Standard rectangular grid
  - `renderHexagons()`: Hexagonal tiling with offset rows
  - `renderTriangles()`: Triangular tiling with staggered layout

- **Hit Testing**:
  - `getCellAt(x, y)`: Converts screen coordinates to grid coordinates
  - `getEdgeAt(x, y)`: Detects which edge is under the mouse cursor
  - Each grid type has specialized hit-testing logic

- **Features**:
  - Renders cells with colors from palette based on state
  - Draws edges with configurable colors
  - Optionally displays cell coordinates as text overlays
  - Creates separate Graphics objects for each cell and edge

#### 3. DrawStateBlade (`src/draw-state-blade.ts`)

Custom Tweakpane blade component for draw state selection:

- **Implementation**:
  - Extends Tweakpane's `View` interface
  - Creates a horizontal row of color-coded buttons
  - Each button represents a state with its palette color

- **Features**:
  - Buttons sized 32x32px with palette colors as backgrounds
  - Automatic text color (black/white) based on brightness
  - Selected state highlighted with yellow border and glow
  - Updates dynamically when number of states changes

#### 4. Color Utilities (`src/color-utils.ts`)

Converts color values between formats:

- `colorToHex()`: Converts Tweakpane color format (string or object) to PixiJS numeric format
- Handles both hex strings (`#rrggbb`) and RGBA objects (`{r, g, b, a}`)

#### 5. Types (`src/types.ts`)

Type definitions:

- `GridType`: Union type for grid types ('squares' | 'hexagons' | 'triangles')
- `Point`: 2D coordinate interface
- `EdgeInfo`: Edge detection result
- `CellInfo`: Cell detection result

## Data Flow

### Configuration Flow

```
User adjusts Tweakpane control
    ↓
Config property updated
    ↓
Change event handler triggered
    ↓
updateGrid() called
    ↓
GridRenderer.render() invoked
    ↓
PixiJS graphics updated
```

### Interaction Flow

```
Mouse event (click/move)
    ↓
Screen coordinates → Grid coordinates (hit test)
    ↓
Cell/Edge identified
    ↓
State updated / Edge highlighted
    ↓
Grid re-rendered
```

## Configuration System

### AppConfig Interface

```typescript
interface AppConfig {
  gridWidth: number;        // Horizontal cell count (1-100)
  gridHeight: number;       // Vertical cell count (1-100)
  gridType: GridType;       // 'squares' | 'hexagons' | 'triangles'
  gridScale: number;        // Cell edge length in pixels (5-100)
  numStates: number;       // Number of possible states (2-16)
  drawState: number;        // Currently selected state (0 to numStates-1)
  palette: Record<number, ColorValue>;  // State → color mapping
  edgeColor: ColorValue;    // Color for grid edges
  edgeHighlightColor: ColorValue;  // Color for highlighted edges
  showCoordinates: boolean; // Toggle coordinate text display
}
```

### Default Configuration

- Grid: 20x20 squares, scale 30px
- States: 4 states (0-3)
- Default palette: Black, Red, Green, Blue (extended to 8 colors)
- Draw state: 1 (red)
- Coordinates: Hidden by default

## Grid Types

### Squares
- **Layout**: Standard rectangular grid
- **Spacing**: `scale` pixels per cell
- **Hit Testing**: Direct coordinate division
- **Coordinates**: `(col, row)` = `(x/scale, y/scale)`

### Hexagons
- **Layout**: Offset rows (odd rows shifted by half hexagon width)
- **Spacing**: 
  - Horizontal: `scale * sqrt(3)` pixels
  - Vertical: `scale * 1.5` pixels
- **Hit Testing**: Brute-force check of all hexagons (for accuracy with offset layout)
- **Rendering**: Centered hexagons using `createHexagonCentered()`

### Triangles
- **Layout**: Staggered triangular tiling
- **Hit Testing**: Checks clicked cell and 8 neighbors (for accuracy with staggered layout)
- **Orientation**: Alternating up/down triangles

## Rendering System

### PixiJS Structure

```
Application
  └── Stage
      ├── gridContainer (cells)
      │   ├── Graphics (cell 0,0)
      │   ├── Graphics (cell 0,1)
      │   └── ...
      └── edgeContainer (edges)
          ├── Graphics (edge 0,0)
          └── ...
```

### Rendering Process

1. **Clear Containers**: Remove all existing children
2. **Iterate Cells**: For each cell in grid:
   - Create Graphics object
   - Fill with palette color based on state
   - Draw edges with stroke
   - Optionally add coordinate text
   - Add to container
3. **Edge Highlighting**: Separate Graphics object for highlighted edge, managed independently

### Coordinate Display

- Text rendered with white fill and black stroke for visibility
- Font size: `max(8, scale / 4)`
- Centered on each cell
- Format: `"col,row"`

## Interaction System

### Mouse Events

1. **Left Click**:
   - Detects cell under cursor
   - Sets cell state to `config.drawState`
   - Triggers grid update

2. **Right Click**:
   - Detects cell under cursor
   - Sets cell state to 0 (clear)
   - Triggers grid update

3. **Mouse Move**:
   - Detects edge under cursor
   - Highlights edge with `edgeHighlightColor`
   - Clears previous highlight

### Hit Testing

Each grid type implements specialized hit testing:

- **Squares**: Direct coordinate division
- **Hexagons**: Iterates all hexagons, calculates distance from center
- **Triangles**: Checks target cell and 8 neighbors for accuracy

## State Management

### Cell States

- **Storage**: 2D array `cellStates[row][col]`
- **Range**: 0 to `numStates - 1`
- **Initialization**: All cells default to state 0
- **Updates**: Direct array mutation on click events

### Draw State

- **Selection**: Via custom Tweakpane blade (color buttons)
- **Validation**: Clamped to valid range when `numStates` changes
- **Visual Feedback**: Selected button highlighted with yellow border

## Development Setup

### Prerequisites
- Node.js (v20+)
- npm

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Starts Vite dev server on port 3000 with hot module replacement.

### Build
```bash
npm run build
```
Compiles TypeScript and bundles with Vite, output to `dist/`.

### Preview
```bash
npm run preview
```
Serves production build locally.

## Project Structure

```
cursor-hex/
├── src/
│   ├── main.ts              # Main application class
│   ├── grid-renderer.ts     # Grid rendering logic
│   ├── draw-state-blade.ts  # Custom Tweakpane blade
│   ├── color-utils.ts       # Color conversion utilities
│   └── types.ts             # TypeScript type definitions
├── docs/
│   └── system-description.md # This document
├── dist/                     # Build output
├── index.html               # Entry HTML file
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite configuration
```

## Key Design Decisions

1. **No Framework**: Pure TypeScript/vanilla JS for simplicity and performance
2. **PixiJS v8**: Modern async initialization API, WebGL/Canvas rendering
3. **Custom Blade**: Custom Tweakpane component for intuitive color-based state selection
4. **Separate Containers**: Grid and edge containers for independent rendering and z-ordering
5. **Brute-Force Hit Testing**: For hexagons, ensures accuracy with offset layouts
6. **State Array**: Simple 2D array for cell states, easy to serialize/deserialize

## Extension Points

### Adding New Grid Types

1. Add type to `GridType` union in `types.ts`
2. Implement rendering method in `GridRenderer`
3. Implement hit testing methods (`getCellAt`, `getEdgeAt`)
4. Add case to `render()` switch statement

### Adding New Features

- **Cell Properties**: Extend `cellStates` to store objects instead of numbers
- **Undo/Redo**: Implement command pattern with state history
- **Export/Import**: Serialize `cellStates` to JSON
- **Palette Editor**: Add Tweakpane controls for palette customization
- **Grid Patterns**: Add preset patterns or generators

## Performance Considerations

- **Rendering**: All cells re-rendered on config change (acceptable for grids up to 100x100)
- **Hit Testing**: Hexagon hit testing is O(n) where n = grid size (could be optimized with spatial indexing)
- **Memory**: Each cell creates separate Graphics object (consider object pooling for large grids)
- **Updates**: Full grid redraw on any change (could be optimized with dirty regions)

## Browser Compatibility

Targets modern browsers with:
- ES2020 support
- WebGL support (for PixiJS)
- Canvas API support (PixiJS fallback)

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

