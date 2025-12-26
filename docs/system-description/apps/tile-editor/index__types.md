# "Tile Editor" Types

## Shared Types
- `Point`: `{ x: number; y: number }`

## Tile Editor Data Structures
- `EditorConfig`
  - `scale`: number
  - `numSides`: number
  - `sideLengthExpression`: string
  - `constantsText`: string
  - `edgeWidth`: number
  - `closedPolygonEpsilon`: number
  - `viewOffset`: `{ x: number; y: number }`

- `PolygonDescription`
  - Purpose: shared geometry definition for multiple instances.
  - `sides`: number
  - `sideLengthExpressions`: string[]
  - `interiorAngleExpressions`: string[]
  - `sideLengths`: number[] (evaluated)
  - `interiorAngles`: number[] (evaluated, radians)
  - `points`: `Point[]` (evaluated, unrotated)
  - `isClosed`: boolean

- `PolygonData`
  - Purpose: an instance of a polygon type.
  - `x`, `y`: number (instance position)
  - `rotationExpression`: string (instance-level expression)
  - `rotation`: number (evaluated, radians)
  - `description`: `PolygonDescription`
  - `points`: `Point[]` (rotated, instance-level cached points)
  - `isClosed`: boolean (mirrors type state)
  - `graphics`: Pixi `Graphics`
  - `isHovered`: boolean

- `ConstantEntry`
  - `name`: string
  - `value?`: number
  - `error?`: string

## Solver Types (used when expressions contain "?")
Imported from `src/core/utils/solver-types.ts`:
- `PolygonConstraint`
- `VertexKinds`
- `SimplePolygonSolveOptions`
- `PolygonData` (solver output)

The Tile Editor consumes the solver's `PolygonData` output to populate `sideLengths`, `interiorAngles`, and base `points` for a `PolygonDescription`.
