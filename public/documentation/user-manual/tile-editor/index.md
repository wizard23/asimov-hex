# Tile Editor

[Back to User Manual](../index.md)

## Overview
The Tile Editor lets you build and arrange polygon tiles using expression-driven side lengths and angles. You can create, select, move, and clone polygon instances, while editing their geometry and viewing calculated values.

## Layout
- Header: app title and a link back to the Main App.
- Left panel (Editor Controls): commands, tiling settings, view controls, GUI settings, and advanced options.
- Center panel:
  - Current Values: live readout of view offset, constants, and selected polygon metrics.
  - Unit Cell Editor: the main canvas where polygons are drawn and edited.
- Right panel: the "Polygon Editor" for the selected polygon. (See ["Polygon Editor"](./polygon-editor.md).)

## Coordinate Systems
- World coordinates: polygon geometry is defined in these units. Side lengths and angles are expressed in world units and radians (unless a degree unit is specified).
- Screen coordinates: pixel positions inside the Unit Cell Editor canvas.
- View offset: a world-space translation applied to the entire scene.
- Polygon local coordinates: each polygon's points are stored relative to its own origin, then shifted by its instance position and rotation.

## Editor Controls
### Commands
- Center View: zooms and pans to fit all polygons in view.
- Save Tiling: downloads the current tiling as JSON.
- Load Tiling: loads a saved JSON tiling; you are prompted if you have unsaved changes.

### Tiling
- Number of Sides: how many sides new polygons will have.
- Side Length Expr: expression used for each new side length.
- Constants: multi-line list of NAME=EXPR entries used by expressions.

### View
- Scale: zoom level for the canvas (also controlled by the mouse wheel).
- View Offset: pan values in world units.

### GUI Settings
- Edge Width: polygon stroke width in pixels.
- Draw Axes: toggle the X/Y axes overlay.
- Axes Color / Axes Line Width: styling for the axes.

### Advanced/Debug
- Closed Polygon Epsilon: tolerance used to decide whether a polygon is considered closed.

## Mouse Interaction
### Create and Clone
- Double-click empty space: create a new polygon at the cursor (only if Side Length Expr evaluates to a positive number and the polygon can be closed).
- Double-click a polygon: clone it. The clone is placed beyond the polygon's outer boundary in the direction of the click.

### Select and Move
- Click a polygon: select it and open the "Polygon Editor" panel.
- Drag a selected polygon: move it in world space.

### Pan the View
- Click and drag empty space: pan the view.

### Zoom
- Mouse wheel: zoom in or out. The scale updates in the View controls.

### Hover Feedback
- Hovered polygons show highlight styling.
- When a polygon is hovered, the closest edge or vertex is emphasized.

## Current Values Panel
The Current Values panel shows:
- View offset and evaluated constants.
- Selected polygon position, number of sides, angle sum, and closure diagnostics.
- Per-side length values and per-vertex angle values for the selected polygon.

## Expressions and Constants (Summary)
- Expressions support +, -, *, /, ^, parentheses, and functions (sin, cos, tan, tanh, tanh2, pow, sqrt, cbrt, log).
- Constants are case-insensitive and can reference earlier constants in the list.
- Angles and rotations accept optional units: "deg" or "rad" (for example: "90,deg").
- Use "?" in side or angle fields to mark unknowns; the solver will attempt to fill them when possible.

See ["Polygon Editor"](./polygon-editor.md) for detailed editing behavior.

[Back to User Manual](../index.md)
