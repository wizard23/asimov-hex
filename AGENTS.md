# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains TypeScript source code. App entry points live in `src/apps/*` (e.g., `src/apps/timeline/index.ts`).
- `public/` holds static assets and generated data served at runtime (e.g., `public/project-history`).
- `scripts/` contains Node/TS maintenance tools (stats, git timeline, deploy).
- `docs/` stores project notes and generated documentation.
- Top-level HTML entry files (e.g., `index.html`, `timeline.html`) are Vite inputs.

## Build, Test, and Development Commands
- `npm run dev`: start Vite dev server (port 3000).
- `npm run build`: type-check and build production assets.
- `npm run preview`: serve the production build locally.
- `npm run test`: run Vitest once.
- `npm run lint`: run ESLint across the repo.
- `npm run verify`: run tests, lint, and build in sequence.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules).
- Formatting: follow existing code style; keep changes consistent with nearby files.
- Linting: ESLint (`eslint.config.js`) is the authority—run `npm run lint` before finalizing.
- Naming: use descriptive `camelCase` for variables/functions, `PascalCase` for classes, and kebab-case for HTML files (as already used).

## Testing Guidelines
- Framework: Vitest.
- Test files: `*.test.ts` or `*.spec.ts` under `src/` or `test/`.
- Run tests with `npm run test`. Add/adjust tests when changing core logic or utilities.

## Commit & Pull Request Guidelines
- Commit messages often use a short prefix plus summary, e.g., `feat: ...`, `refactor: ...`, `perf: ...`, `human: ...`, `automated: ...`.
- Keep messages imperative and concise; include scope when helpful.
- For PRs, include a short description of changes, link related issues if any, and add screenshots for UI updates (timeline, viewer, main app).

## Configuration & Scripts Notes
- Git timeline data is generated via `scripts/re-create-git-timeline.ts` and written to `public/project-history/git-timeline.json`.
- Project statistics live under `public/project-statistics/`; use `npm run create-project-statistics` when updating.
