# "Polygon Editor"

"Polygon Editor" edits the selected polygon. It separates instance values from type values.

## Instance Values
- Position (x/y) of the selected polygon instance.
- Rotation expression (supports units via the same syntax as angle expressions).

## Type Values
- Side length expressions per edge.
- Interior angle expressions per vertex.
- Expressions support constants and "?" for solver-assisted unknowns.

## Behavior
- Invalid expressions trigger an alert and revert to the last valid value.
- Changes to type values propagate to all instances that share the same description.
