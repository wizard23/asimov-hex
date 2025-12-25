# Architecture Assessment Findings

Date: 2025-01-01

## Summary

- Code quality is generally solid in core geometry and grids, with clear TypeScript usage and tests.
- The biggest maintainability risk is large monolithic app entrypoints that mix UI, state, rendering, and IO.
- Some duplicated geometry/types and minor pass-through helpers add drift and indirection risk.
- Rendering is fully redrawn on most interactions, which will not scale with growing grid sizes or features.

## Findings

### Code Quality

- Core grid logic and geometry utilities are readable and tested.
- App entrypoints are long and mix concerns, which makes new feature work harder over time.

Files:
- src/core/grid/*.ts
- src/core/utils/geometry.ts
- src/apps/main/index.ts
- src/apps/tile-editor/index.ts

### Unnecessary Indirection

- `distanceToLineSegment` is a pass-through to `distanceToSegment`.
- `GridRenderer.getEdgesAtVertex` just forwards to `grid.getEdgesAtVertex`.
- `grid-selection` / `grid-search` / `grid-scan` split is fine, but if no independent reuse emerges it could be collapsed.

Files:
- src/core/utils/geometry.ts
- src/core/rendering/grid-renderer.ts
- src/core/grid/grid-selection.ts
- src/core/grid/grid-search.ts
- src/core/grid/grid-scan.ts

### Duplicated Data Structures

- `Point` type is defined in multiple places (core types vs tile editor).
- `pointInPolygon` logic exists both in Cairo grid and tile editor helpers.

Files:
- src/types/index.ts
- src/apps/tile-editor/types.ts
- src/apps/tile-editor/geometry-helpers.ts
- src/core/grid/cairo-grid.ts

### Directory Structure

- Good high-level split between `src/apps` and `src/core`.
- Shared geometry/types live inside app-specific folders, which encourages duplication.

Files:
- src/apps/*
- src/core/*

### Refactor / Rewrite Candidates

- Split `src/apps/main/index.ts` into modules: state/model, rendering, interaction, and UI bindings.
- Extract shared geometry/types into a common module and unify `Point`/polygon helpers.
- Consider incremental rendering or caching instead of full re-render on every interaction.

Files:
- src/apps/main/index.ts
- src/apps/tile-editor/index.ts
- src/core/rendering/grid-renderer.ts

### Architectural Decisions to Reevaluate

- Rendering strategy: full redraws vs incremental updates/cached geometry.
- App architecture: monolithic class vs lightweight controller/view or state store separation.

