# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Asimov Hex is a vibe-coding testbed for visualizing polygon-based tilings and simulating particles that move along their edges using local interaction rules. The project uses PixiJS for rendering, TypeScript for type safety, and Vite for development tooling.

## Common Development Commands

### Building and Testing
- `npm run dev` - Start development server (port 3000, auto-opens browser)
- `npm run build` - TypeScript compilation + Vite build
- `npm test` - Run all tests with Vitest
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run verify` - Run tests + lint + build (full verification)

### Project Statistics and Tooling
- `npm run stats` - Generate repository statistics
- `npm run create-project-statistics` - Create project statistics JSON
- `npm run re-create-git-timeline` - Regenerate git timeline JSON
- `npm run commit-update-statistics-and-timeline` - Automated commit for statistics updates

### Deployment
- `npm run deploy-to-server` - Deploy dist to server

## Code Architecture

### Core Module (`src/core/`)

The core module contains reusable abstractions for grid systems, rendering, particle simulation, and geometry solving:

- **Grid System (`src/core/grid/`)**: Abstract `Grid` interface with implementations for different tiling patterns:
  - `SquareGrid` - Square tiling
  - `HexagonGrid` - Hexagonal tiling
  - `TriangleGrid` - Triangle tiling
  - `CairoGrid` - Cairo pentagon tiling (supports 'catalan' and 'type4' variants)

  Each grid provides:
  - `pixelToCell()` / `cellToPixel()` - Coordinate transformations
  - `getCellPolygon()` - Vertex coordinates for rendering
  - `getCellEdges()` - Edge information for particle movement
  - `getNeighbors()` - Adjacency queries
  - `getEdgeAt()` / `getVertexAt()` - Hit testing for interaction

- **Grid Search (`grid-search.ts`)**: Functions for hit detection:
  - `getCellAtPixel()` - Find cell containing a point
  - `getEdgeAtPixel()` - Find edge near a point (with threshold)

- **Rendering (`src/core/rendering/`)**: `GridRenderer` handles all PixiJS rendering for grids, edges, and highlights

- **Particle System (`src/core/particles/`)**: `ParticleSystem` manages particle simulation with edge selection algorithms:
  - `randomNoBacktrack` / `randomWithBacktrack`
  - `clockwise` / `counterClockwise`
  - `followCursor` / `avoidCursor`
  - `orbitCursor` - Particles orbit around mouse position
  - `highestEdgeDelta` - Based on cell state differences

- **Solver (`src/core/solver/`)**: Constraint-based polygon solver using Levenberg-Marquardt optimization
  - `solveSimpleNgon()` - Solve N-sided polygons with length/angle constraints
  - Supports vertex kinds: convex, reflex, straight
  - Constraint types: length, interiorAngle, segmentLengthRatio, segmentRelativeAngle

### Apps Module (`src/apps/`)

Multiple standalone apps built on the core system:

- **Main App (`src/apps/main/`)**: Primary interactive grid application with:
  - Tweakpane controls for all parameters
  - Three click modes: 'draw', 'spawnParticle', 'smart'
  - Smart mode: automatically spawns particles on edges or draws cells
  - Pan (Ctrl+drag), zoom (wheel), keyboard shortcuts (Space=pause, O/P=adjust params)

- **Tile Editor (`src/apps/tile-editor/`)**: Tool for designing custom tile shapes
- **Timeline (`src/apps/timeline/`)**: Visualizes git commit history
- **Statistics (`src/apps/statistics/`)**: Displays project metrics
- **Markdown Viewer (`src/apps/markdown-viewer/`)**: Documentation viewer

### Multi-Page Setup

The project uses Vite's multi-page build configuration (see `vite.config.ts`):
- `index.html` → Main App
- `statistics.html` → Statistics
- `timeline.html` → Timeline
- `tile-editor.html` → Tile Editor
- `markdown-viewer.html` → Markdown Viewer

## Key Implementation Patterns

### Grid Coordinate System

All grid implementations use a `{ col: number, row: number }` coordinate system. The grid is "centered" by computing bounds and offsetting to center in viewport. Grid offset is stored in scale-independent units and converted to pixels on render.

### Gauge Fixing in Solver

The polygon solver uses gauge fixing to reduce degrees of freedom:
- Point 0 is fixed at origin: `p0 = (0, 0)`
- Point 1 is on x-axis: `p1.y = 0`
- Variables are packed/unpacked accordingly (see `packVars()`, `unpackVars()`)

### Particle Edge Traversal

Particles move along edges with `EdgeInfo` objects that include:
- `points[2]` - Edge endpoints
- `cells[1..2]` - Adjacent cells (may be null at boundaries)
- Unique edge identification via normalized `(i, j)` segment refs

Selection algorithms use this information to determine next edge at vertices.

### State Management in Main App

The main app uses a centralized `AppConfig` object with Tweakpane bindings. Key state:
- `cellStates: number[][]` - 2D array of cell states
- `config.gridOffset` - Pan offset in grid units
- `config.isSimulationRunning` - Pause/resume particles

## Testing

- Tests use Vitest and are located alongside source files (`*.test.ts`)
- Solver has comprehensive test coverage for various polygon configurations
- Run single test file: `npx vitest run <path-to-test-file>`

## Project Conventions

- TypeScript strict mode enabled
- Grid types defined in `src/types/index.ts`
- Palettes loaded from `src/assets/palettes.json`
- Automated statistics stored in `public/project-statistics/` and `public/project-history/`
