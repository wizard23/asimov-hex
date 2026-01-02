# "Polygon Editor"

[Back to Tile Editor](./index.md)

## Overview
The "Polygon Editor" panel appears when a polygon is selected in the Unit Cell Editor. It lets you edit both the polygon instance (position and rotation) and the polygon type (side lengths and interior angles).

## Layout
- Instance Values: position and rotation for the selected polygon instance.
- Type Values: per-side and per-angle expressions for the polygon's shape.

## Coordinate Systems
- Position values are in world coordinates (the same units used for side lengths).
- Rotation values are angles in radians by default, unless a unit is specified (for example: "45,deg").

## Instance Values
- Position: sets the polygon's X and Y location in world units.
- Rotation Expression: expression evaluated as an angle. The polygon points are rotated by this value.

## Type Values
- Side Length Expressions: one expression per edge, labeled by vertex pairs (AB, BC, CD, ...).
- Angle Expressions: one expression per vertex, labeled A, B, C, ... .
- Use "?" to mark an unknown side or angle. The solver attempts to fill in missing values when possible.

## Expressions and Units
- Supported operators: +, -, *, /, ^, parentheses.
- Supported constants: PI, E, PHI (case-insensitive).
- Supported functions:
  - sin(x[, unit]), cos(x[, unit]), tan(x[, unit]) with optional "deg" or "rad".
  - tanh(x), tanh2(y, x) (maps to atan2), pow(a, b), sqrt(x), cbrt(x), log(value, base).
- Variables from the Constants list are case-insensitive and can be used in any field.

## Error Handling
- Invalid expressions are highlighted in red in the editor.
- Expression errors show a toast message and the previous valid value is restored where applicable.

[Back to Tile Editor](./index.md)
