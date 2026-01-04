# Asimov Hex

## Project Overview

**Asimov Hex** is a web-based project containing a suite of interactive visualization and grid-based tools. It is built using **TypeScript**, **Vite**, and **PixiJS** (v8) for high-performance 2D rendering. The user interface controls are managed using **Tweakpane**.

The project is structured as a multi-page application, with each "app" having its own entry point and HTML file.

## Applications

The project consists of the following distinct applications, located in `src/apps`:

1.  **Main App** (`index.html` / `src/apps/main`):
    *   The primary grid interactive playground.
    *   Features: Configurable grids (Hex, Square, Triangle, Cairo), particle simulation, orbit visualization, and cell state painting.

2.  **Tile Editor** (`tile-editor.html` / `src/apps/tile-editor`):
    *   A tool for editing and visualizing polygon tilings.
    *   Likely used for defining the geometry of the grids used in the main app.

3.  **Timeline** (`timeline.html` / `src/apps/timeline`):
    *   A tool for visualizing the project's Git history and development timeline.
    *   Supports grouped views and statistics.

4.  **Statistics** (`statistics.html` / `src/apps/statistics`):
    *   A dashboard for viewing project statistics (code count, file types, repository size, etc.).
    *   Data is generated via scripts (`scripts/create-project-statistics.ts`).

5.  **Markdown Viewer** (`markdown-viewer.html` / `src/apps/markdown-viewer`):
    *   A built-in utility to view Markdown documentation directly within the browser context.

## Building and Running

### Prerequisites
*   Node.js (v20+ recommended)
*   npm

### Key Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server (usually at `http://localhost:5173`). |
| `npm run build` | Compiles TypeScript and builds the production assets via Vite. |
| `npm run preview` | Previews the built production build locally. |
| `npm run test` | Runs the test suite using **Vitest**. |
| `npm run lint` | Runs **ESLint** to check for code quality issues. |
| `npm run verify` | Comprehensive check: runs tests, linting, and a production build. **Use this before pushing.** |

### Helper Scripts

*   `npm run stats`: Runs `scripts/repo-statistics.sh`.
*   `npm run create-project-statistics`: Generates JSON statistics for the Statistics app.
*   `npm run re-create-git-timeline`: Regenerates the Git timeline JSON data.

## Project Structure

*   `src/`: Source code.
    *   `apps/`: Entry points for each application.
    *   `core/`: Shared logic (Grid systems, Particle engine, Rendering, Solver).
    *   `gui/`: Shared UI components (Tweakpane blades, etc.).
    *   `types/`: Shared TypeScript definitions.
*   `docs/`: Project documentation.
*   `public/`: Static assets (and generated data for statistics/timeline).
*   `scripts/`: Automation scripts (TypeScript and Shell).

## Development Conventions

*   **Language:** TypeScript (Strict mode enabled).
*   **Styling:** Prettier/ESLint integration.
*   **Testing:** Vitest for unit testing. Place tests next to the source file (e.g., `grid.test.ts`).
*   **Rendering:** Use the `GridRenderer` in `src/core/rendering` for PixiJS abstractions where possible.
*   **Commits:** Use the provided scripts (e.g., `npm run commit-from-file`) or follow the project's commit message conventions if manually committing.
