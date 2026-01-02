# Project Statistics

[Back to User Manual](../index.md)

## Overview
Project Statistics displays generated repository metrics, file breakdowns, and storage information. It is read-only and intended for exploring snapshot data produced by the statistics generator.

## Layout
- Header: title and link back to the Main App.
- Left panel (Statistics Controls): file selection and timestamp formatting.
- Main panel: sections with overview metrics, tables, and detailed repository statistics.

## Coordinate Systems
This app does not use spatial coordinates. It presents tabular and summary data only.

## Controls
- Statistics File: choose a generated JSON snapshot to view.
- Timestamp Format: toggle between local time and UTC for the displayed snapshot timestamp.

## Sections and Tables
- Overview: totals for files, lines, words, bytes, and repo size metrics.
- File Types Breakdown: table grouped by file extension.
- All Files: per-file statistics (available only if included file data exists).
- Excluded Paths: lists excluded folders and files.
- Repo Statistics: detailed git metadata, object storage, disk usage, and largest blobs.

## Table Interaction
- Click a column header in File Types Breakdown or All Files to sort.
- Clicking the same header toggles ascending/descending order.
- Section headers can be toggled to expand or collapse details.

## Data Source
- The file list loads from `/project-statistics/generated/index.json`.
- Selected statistics load from `/project-statistics/generated/<filename>`.

[Back to User Manual](../index.md)
