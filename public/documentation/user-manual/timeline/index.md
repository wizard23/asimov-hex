# Project Timeline

[Back to User Manual](../index.md)

## Overview
Project Timeline visualizes the git commit history as either a list or an interactive timeline. It supports search, date filtering, grouping, and quick copying of checkout commands.

## Layout
- Header: title and link back to the Main App.
- Left panel (Timeline Controls): search, date filters, display mode, grouping, and centering.
- Main panel: list view or the interactive timeline canvas.

## Coordinate Systems
- Timeline world coordinates: time expressed in seconds from the start of the visible range.
- Screen coordinates: pixel positions within the timeline canvas.
- Timeline scale: pixels per second; adjusted by zooming.

## Controls
- Search: filters commits by message, author, or hash (case-insensitive).
- Enable Date Filter: toggles start and end date inputs.
- Start Date / End Date: inclusive date range for filtering (YYYY-MM-DD).
- Display Mode: List or Timeline.
- Group By: None, Day, Week, Month, or Year (Timeline mode only).
- Center View: resets pan and zoom (Timeline mode only).

## List Mode
- Each commit card shows hash, timestamp, author, message, and line changes.
- The "git checkout" button copies a checkout command to the clipboard.

## Timeline Mode
- The main horizontal line (or lines, when grouped) represents time.
- Green vertical bars show added lines; red bars show removed lines (log-scaled).
- A timeline scale at the top adjusts automatically with zoom.
- Grouped views stack multiple timeline lines with labels.
- Hover a commit point to show its details in the info overlay.

## Mouse Interaction (Timeline Mode)
- Left-click and drag: pan horizontally across time.
- Mouse wheel: zoom around the cursor position.
- Hover: update the info overlay with the nearest commit.

## Data Source
The timeline loads from `/project-history/git-timeline.json`. If the file is missing or invalid, the app displays an error state.

[Back to User Manual](../index.md)
