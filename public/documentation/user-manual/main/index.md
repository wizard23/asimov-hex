# Main App

[Back to User Manual](../index.md)

## Overview
The Main App is a grid-based drawing and particle simulation sandbox. You paint cell states on a polygonal tiling (square, hex, triangle, or Cairo) and spawn particles that travel along edges using selectable routing algorithms.

## Layout
- Full-screen canvas: the grid, edges, highlights, and particles are drawn here.
- Info panel (top-left): contains About and Tech Stack tabs and links to other apps. It can be minimized and reopened.
- Control panel (top-right): Tweakpane folders for File, Grid, Particles, GUI, and Advanced settings.

## Coordinate Systems
- Grid coordinates: integer (col, row) indices. The top-left cell is (0, 0), columns increase to the right, rows increase downward.
- Pixel coordinates: used for mouse interaction and rendering. The grid is centered in the canvas; pixel (0, 0) is the top-left of the grid container, not the page.
- Orbit radius: set in grid units and multiplied by the current grid scale to get pixels.

## Controls
### File
- Save to PNG: exports the current grid state as a grayscale PNG (image width = grid width, image height = grid height).
- Load from PNG: imports a grayscale PNG and maps pixel brightness back to cell states; the grid resizes to match the image.

### Grid
- Type: choose tiling (triangles, squares, hexagons, Cairo).
- Scale: size of each cell in pixels.
- Width, Height: grid dimensions in cells.
- Draw State: choose which cell state will be painted.
- Center View: auto-fit the grid to the canvas.

### GUI
- Palette: choose the color palette for cell states.
- Edge Width: thickness of grid edges.
- Edge Color: base edge color.

### Particles
- Speed: particle speed in grid units per second.
- Algorithm: how particles choose the next edge when reaching a vertex.
- Orbit Radius: only shown for the Orbit Cursor algorithm.
- Clear Particles: removes all particles.

### Advanced
- Click Tool: sets how left-click behaves (Draw Cell, Spawn Particle, or Smart).
- Orbit Algorithm: selects how orbit targets are computed for Orbit Cursor.
- Show Orbit: draws the orbit circle around the mouse cursor.
- Orbit Epsilon: controls where along the next edge the orbit gradient samples.
- Cell States: total number of discrete cell states.
- Show Coordinates: overlays each cell's (col, row) coordinates.
- Show Edge Delta: colors edges based on the difference in adjacent cell states.
- Edge Palette: palette used when Show Edge Delta is enabled.

## Mouse and Keyboard Interaction
### Hover and Highlight
- Move the mouse across the grid to highlight the closest target based on the current Click Tool.
- In Spawn Particle or Smart modes, edges and their nearest vertex are highlighted when the cursor is near an edge.
- In Draw mode (and in Smart when not near an edge), the hovered cell is highlighted.

### Left Click
- Draw Cell mode: set the hovered cell to the current Draw State.
- Spawn Particle mode:
  - Click an edge to spawn a particle on that edge.
  - Click a cell to spawn a particle on a random edge of that cell.
- Smart mode:
  - Click an edge to spawn a particle on that edge.
  - Click a cell to paint it with the Draw State.
  - Shift + click a cell to spawn a particle on a random edge of that cell.

### Right Click
- Draw Cell mode: clear the hovered cell (set to state 0).
- Spawn Particle mode:
  - Right-click an edge to remove particles on that edge.
  - Right-click a cell to remove particles on all of that cell's edges.
- Smart mode:
  - Right-click an edge to remove particles on that edge.
  - Right-click a cell to clear it (set to state 0).
  - Shift + right-click to remove particles (edge if hovered, otherwise all edges of the hovered cell).

### Mouse Wheel
- Scroll to zoom the grid in or out (adjusts the grid scale).

## Particle Algorithms
- Random (No Backtrack): choose a random connected edge, excluding the one just traveled.
- Random (With Backtrack): choose any connected edge, including the one just traveled.
- Always Turn Clockwise / Counter-Clockwise: follow the next edge by angular turn direction.
- Follow Cursor / Avoid Cursor: choose the edge whose far endpoint is closest to or farthest from the cursor.
- Orbit Cursor: choose the edge that best matches a target orbit radius around the cursor.
- Highest Edge Delta: choose an edge with the largest difference between neighboring cell states.

[Back to User Manual](../index.md)
