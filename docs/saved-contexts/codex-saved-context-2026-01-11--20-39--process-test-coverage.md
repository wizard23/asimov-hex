# Saved Context: Vitest coverage post-processing

## Current task focus
Continue improving the Vitest coverage post-processing pipeline. The script now supports multiple color inversion algorithms; make sure behavior matches expectations and adjust as needed.

## Key changes made in this session
- Coverage post-processing is now a TypeScript script: `scripts/post-process-test-coverage.ts`.
- It rewrites **all** CSS files under `public/coverage/` and pseudo-inverts colors by flipping lightness in a chosen color space.
- It injects a `coverage-dark.css` (with `color-scheme: dark`) into every coverage HTML file that doesn’t already include it.
- Algorithms supported via CLI args:
  - `hsluv` (default)
  - `hsl`
  - `hsv`
- Dependencies updated to include `hsluv`.
- Docs updated to describe algorithm options.

## How to run
- Default (HSLuv): `npm run post-process-test-coverage`
- HSL: `npm run post-process-test-coverage -- --algo=hsl`
- HSV: `npm run post-process-test-coverage -- --algo=hsv`

## Files changed/added
- `scripts/post-process-test-coverage.ts` (TypeScript version; rewrites CSS + injects HTML links)
- `docs/system-description/tasks/vitest-coverage-post-processing.md` (updated algorithm docs)
- `package.json` and `package-lock.json` (added `hsluv` dependency)

## Notes on implementation
- Uses `Hsluv` class from `hsluv` package (not `hsluvToRgb`/`rgbToHsluv` exports).
- HTML injection uses `path.relative` to compute link paths.
- CSS transform scans property values and replaces colors in hex, rgb/rgba, and named colors.

## CI/testing requirement
- Always validate with `npm run verify` after changes (runs test, lint, build). This was run and passed after the last update.

## Open items / next steps
- If the HSLuv inversion results aren’t satisfactory for some colors, adjust the algorithm or add optional controls.
- Confirm no regressions in coverage HTML rendering after repeated post-process runs.

