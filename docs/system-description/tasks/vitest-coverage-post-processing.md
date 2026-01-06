# Vitest coverage post-processing

## Goal
Apply a dark theme to the generated Vitest HTML coverage report without changing upstream tooling.

## Approach: invert with selective re-invert
The post-processing script writes a CSS file into the coverage output directory and injects it into every HTML report. The CSS uses a global invert filter to flip the default light theme into a dark theme, then re-inverts elements that should keep their semantic traffic-light colors (green/yellow/red).

Key points:
- `html { filter: invert(1) hue-rotate(180deg); }` flips the entire page.
- Media elements (`img`, `svg`, `canvas`, etc.) are inverted back so they render normally.
- Coverage status classes (e.g., `.high`, `.medium`, `.low`, `.cline-yes`, `.cline-no`) are also inverted back to preserve the original red/yellow/green meaning.
- The approach is idempotent because the CSS file is overwritten and HTML injection is skipped if already present.

## How to run
- Generate coverage: `npm run test-coverage`
- Post-process: `npm run post-process-test-coverage`
- Combined: `npm run test-coverage-and-post-process`
