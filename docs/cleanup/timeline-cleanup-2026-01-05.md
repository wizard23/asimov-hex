# Timeline App Code Cleanup - 2026-01-05

## Overview

Code quality review of `src/apps/timeline/index.ts` (2074 lines).

**Review Categories:**
- Unused/derelict code from previous features
- Debugging code remains
- Code smells
- Redundant/duplicate code
- Type consistency issues
- Unnecessary null/undefined checks

---

## Critical Issues

### 1. Empty Method Stub

**Location:** Lines 324-326

```typescript
private initContextMenuClear() {
  // Scoped to the Pixi canvas when it exists.
}
```

**Issue:** Method is called during initialization but does nothing. Comment suggests it was intended to prevent context menus on the canvas.

**Action Required:** Either implement the functionality or remove the method and its call.

---

### 2. Unused Variable

**Location:** Line 988 in `handleTimelinePointerMove()`

```typescript
const isRight = this.timelineDragButton === 2;
```

**Issue:** Variable is defined but never used. Likely a remnant from when right-button drag functionality existed.

**Action Required:** Remove this line.

---

### 3. Massive Class (Single Responsibility Violation)

**Location:** Entire file (2074 lines)

**Issue:** The `TimelineViewer` class handles too many responsibilities:
- Timeline rendering (PixiJS)
- UI controls (Tweakpane integration)
- Event handling (mouse, keyboard, wheel)
- Data filtering and grouping
- Fullscreen mode management
- List view rendering
- Coordinate transformations
- Scale calculations
- Group management

**Metrics:**
- 60 private fields (lines 28-87)
- 100+ methods
- Multiple rendering systems (list view vs timeline view)

**Recommended Refactoring:**
```
TimelineViewer (coordinator)
├── TimelineData (filtering, grouping)
├── TimelineRenderer (PixiJS rendering)
│   ├── ScaleRenderer
│   ├── CommitRenderer
│   └── ChangeRenderer
├── TimelineControls (Tweakpane UI)
├── TimelineInteraction (mouse/keyboard events)
└── TimelineViewState (offset, scale, viewport)
```

---

## Moderate Issues

### 4. Anonymous Type Repetition

**Locations:** Lines 67, 1027, 1042

```typescript
// Line 67
private timelineCommitPoints: Array<{ commit: Commit; screenX: number; screenY: number }> = [];

// Line 1027
let best: { commit: Commit; screenX: number; screenY: number } | null = null;

// Line 1042
return this.timelineCommitPoints.find(point => point.commit.hash === commit.hash) ?? null;
```

**Issue:** The type `{ commit: Commit; screenX: number; screenY: number }` is used multiple times but not named.

**Action Required:** Extract to named type:
```typescript
interface CommitPoint {
  commit: Commit;
  screenX: number;
  screenY: number;
}

private timelineCommitPoints: CommitPoint[] = [];
```

---

### 5. Redundant Visibility Update Methods

**Locations:** Lines 457-531

**Issue:** Eight nearly identical methods following this pattern:

```typescript
private updateDateFilterVisibility() {
  const display = this.config.enableDateFilter ? '' : 'none';
  if (this.startDateElement) this.startDateElement.style.display = display;
  if (this.endDateElement) this.endDateElement.style.display = display;
}

private updateGroupByVisibility() {
  const display = this.config.displayMode === 'Timeline' ? '' : 'none';
  if (this.groupByElement) this.groupByElement.style.display = display;
  this.updateGestureHintsContent();
}

private updateCenterViewVisibility() {
  const display = this.config.displayMode === 'Timeline' ? '' : 'none';
  if (this.centerViewElement) this.centerViewElement.style.display = display;
}

// ... 5 more similar methods
```

**Action Required:** Consolidate into a helper:

```typescript
private setElementVisibility(
  element: HTMLElement | null,
  visible: boolean,
  onUpdate?: () => void
) {
  if (element) element.style.display = visible ? '' : 'none';
  onUpdate?.();
}

// Then use:
private updateGroupByVisibility() {
  this.setElementVisibility(
    this.groupByElement,
    this.config.displayMode === 'Timeline',
    () => this.updateGestureHintsContent()
  );
}
```

---

### 6. Duplicate Change Line Drawing

**Locations:** Lines 1426-1468

**Issue:** Two nearly identical loops for drawing added (green) and removed (red) lines:

```typescript
// Green lines for added
grouped.forEach((group, index) => {
  const lineY = lineYs[index] ?? 0;
  for (const commit of group.commits) {
    const commitMs = commit.timestamp * 1000;
    const worldX = (commitMs - group.startMs) / 1000;
    const screenX = this.worldToScreen(worldX, 0).x;
    const height = valueToHeight(commit.addedLines);
    if (height <= 0) continue;
    timelineChangeGraphics.moveTo(screenX, lineY);
    timelineChangeGraphics.lineTo(screenX, lineY - height);
  }
});
timelineChangeGraphics.stroke({ color: 0x3ddc6f, width: 2, alpha: 0.9 });

// Red lines for removed (exact same structure)
grouped.forEach((group, index) => {
  // ... same code but with removedLines and lineY + height
});
timelineChangeGraphics.stroke({ color: 0xff5b5b, width: 2, alpha: 0.9 });
```

**Action Required:** Extract to helper:

```typescript
private drawChangeLinesForType(
  grouped: GroupedCommits[],
  lineYs: number[],
  getValue: (commit: Commit) => number,
  direction: 1 | -1,
  color: number
) {
  grouped.forEach((group, index) => {
    const lineY = lineYs[index] ?? 0;
    for (const commit of group.commits) {
      const commitMs = commit.timestamp * 1000;
      const worldX = (commitMs - group.startMs) / 1000;
      const screenX = this.worldToScreen(worldX, 0).x;
      const height = valueToHeight(getValue(commit));
      if (height <= 0) continue;
      this.timelineChangeGraphics!.moveTo(screenX, lineY);
      this.timelineChangeGraphics!.lineTo(screenX, lineY + direction * height);
    }
  });
  this.timelineChangeGraphics!.stroke({ color, width: 2, alpha: 0.9 });
}

// Usage:
this.drawChangeLinesForType(grouped, lineYs, c => c.addedLines, -1, 0x3ddc6f);
this.drawChangeLinesForType(grouped, lineYs, c => c.removedLines, 1, 0xff5b5b);
```

---

### 7. Long Conditional Guard Clause

**Location:** Lines 1287-1300

```typescript
if (
  !this.timelineApp
  || !this.timelineGraphics
  || !this.timelineScaleGraphics
  || !this.timelineTextContainer
  || !this.timelineLineGraphics
  || !this.timelineChangeGraphics
  || !this.timelineChangeScaleGraphics
  || !this.timelineChangeTextContainer
  || !this.timelineGroupLabelContainer
) {
  return;
}
```

**Issue:** Checking 9 conditions suggests the initialization state is complex.

**Action Required:**
1. Either ensure these are always initialized together
2. Or extract to a method: `private isTimelineInitialized(): boolean`
3. Or use a state flag that tracks initialization

---

### 8. Magic Numbers Throughout Code

**Examples:**
- Line 1026: `const radius = 21;` (hover detection radius)
- Line 72: `private readonly timelineScaleHeight = 50;`
- Line 698: `if (distance < 8) return 'none';` (dead zone threshold)
- Line 703: `const threshold = 6;` (drag threshold)
- Line 705: `const ratio = 1.4;` (direction lock ratio)

**Issue:** Magic numbers make code harder to understand and maintain.

**Action Required:** Extract to named constants at class level or in a constants file:

```typescript
private static readonly HOVER_RADIUS = 21;
private static readonly DRAG_DEAD_ZONE = 8;
private static readonly DRAG_THRESHOLD = 6;
private static readonly DIRECTION_LOCK_RATIO = 1.4;
```

---

## Minor Issues

### 9. Single-Use Variable

**Location:** Line 991

```typescript
const groupOnly = canGroupDrag && (isLeft && e.ctrlKey);
if (groupOnly) {
  // ...
}
```

**Action Required:** Inline into the if statement for simplicity.

---

### 10. Inconsistent Method Calling in Visibility Update

**Location:** Line 206

```typescript
private updateGroupByVisibility() {
  const display = this.config.displayMode === 'Timeline' ? '' : 'none';
  if (this.groupByElement) this.groupByElement.style.display = display;
  this.updateGestureHintsContent(); // Why update content when changing visibility?
}
```

**Issue:** Mixing visibility changes with content updates suggests coupled concerns.

**Action Required:** Consider whether content update should be called separately by the caller rather than buried inside a visibility method.

---

### 11. Empty Default Case

**Location:** Line 1754 in `addUnit()`

```typescript
default:
  return next;
```

**Issue:** The default case returns the unchanged date, which is reasonable but lacks explanation.

**Action Required:** Add comment:
```typescript
default:
  // Unknown unit type - return unchanged date
  return next;
```

---

### 12. Inconsistent Event Handler Patterns

**Locations:** Lines 1144, 1184, 1192, 1199

**Issue:** Some event handlers are arrow functions assigned to fields:

```typescript
private handleTimelineWheel = (e: WheelEvent) => {
  // ...
};
```

While others are regular methods:

```typescript
private handleHotkeys(event: KeyboardEvent) {
  // ...
}
```

**Note:** Arrow functions are fine for auto-binding `this`, but the inconsistency is worth noting. This is a stylistic choice rather than a bug.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Critical Issues | 3 |
| Moderate Issues | 6 |
| Minor Issues | 4 |
| Total Lines | 2074 |
| Private Fields | 60 |
| Methods | ~100 |

---

## Recommended Refactoring Priority

1. **High Priority:**
   - Remove unused code (`isRight` variable, `initContextMenuClear()`)
   - Extract `CommitPoint` type
   - Extract magic numbers to constants

2. **Medium Priority:**
   - Consolidate visibility update methods
   - Deduplicate change line drawing
   - Simplify long guard clause

3. **Low Priority (Larger Refactoring):**
   - Split class into multiple focused classes
   - Extract graphics objects into state container
   - Separate list view from timeline view rendering

---

## Notes

- No inappropriate debugging code found (only proper error logging on line 139)
- All null checks are appropriate - fields are properly typed as nullable
- Code is generally well-structured and functional despite size
- TypeScript types are used consistently throughout

---

**Reviewed by:** Claude Code (Sonnet 4.5)
**Date:** 2026-01-05
**File:** `src/apps/timeline/index.ts`
