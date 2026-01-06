# Vitest coverage post-processing

## Goal
Apply a dark theme to the generated Vitest HTML coverage report without changing upstream tooling.

## Approach: HSL pseudo-invert for all CSS colors
The post-processing script rewrites every CSS file under `public/coverage/` and pseudo-inverts all color values by flipping the HSL lightness. This keeps hue and saturation consistent while moving light colors to dark equivalents (and vice versa).

Key points:
- Every color token in coverage CSS (hex, rgb/rgba, and named colors) is converted via HSL lightness inversion.
- The script also writes a small `coverage-dark.css` that only sets `color-scheme: dark` and injects it into all coverage HTML files.
- The approach is idempotent because the CSS is deterministically rewritten and HTML injection is skipped if already present.

## How to run
- Generate coverage: `npm run test-coverage`
- Post-process: `npm run post-process-test-coverage`
- Combined: `npm run test-coverage-and-post-process`
