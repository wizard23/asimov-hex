import { Pane } from 'tweakpane';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { showToast } from '../../core/utils/toast';

interface Commit {
  hash: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
  message: string;
  addedLines: number;
  removedLines: number;
}

type DisplayMode = 'List' | 'Timeline';
type ScaleUnit = 'decade' | 'year' | 'month' | 'day' | 'hour' | 'tenMinute' | 'minute';
type GroupBy = 'None' | 'Day' | 'Week' | 'Month' | 'Year';
type LeftPanMode = 'Time Axis Only' | 'Naive Combined' | 'Direction-lock on drag start' | 'Dead-zone + axis snapping';

interface GroupedCommits {
  key: string;
  startMs: number;
  endMs: number;
  commits: Commit[];
}

class TimelineViewer {
  private pane!: Pane;
  private timelinePanel: HTMLElement;
  private commits: Commit[] = [];
  private filteredCommits: Commit[] = [];
  private startDateElement: HTMLElement | null = null;
  private endDateElement: HTMLElement | null = null;
  private groupByElement: HTMLElement | null = null;
  private centerViewElement: HTMLElement | null = null;
  private fullscreenToggleElement: HTMLButtonElement | null = null;
  private fullscreenExitElement: HTMLButtonElement | null = null;

  private timelineApp: Application | null = null;
  private timelineGraphics: Graphics | null = null;
  private timelineLineGraphics: Graphics | null = null;
  private timelineChangeGraphics: Graphics | null = null;
  private timelineChangeScaleGraphics: Graphics | null = null;
  private timelineScaleGraphics: Graphics | null = null;
  private timelineHoverGraphics: Graphics | null = null;
  private timelineLockedGraphics: Graphics | null = null;
  private timelineTextContainer: Container | null = null;
  private timelineChangeTextContainer: Container | null = null;
  private timelineGroupLabelContainer: Container | null = null;
  private timelineResizeObserver: ResizeObserver | null = null;
  private timelineViewOffset = { x: 0, y: 0 };
  private timelineViewOffsetStart = { x: 0, y: 0 };
  private timelineViewportCenter = { x: 0, y: 0 };
  private timelineScale = 1;
  private timelineScaleBounds = { min: 0.000001, max: 1 };
  private timelineGroupScrollOffsetY = 0;
  private timelineGroupScrollOffsetStart = 0;
  private timelineTransitionFrame: number | null = null;
  private timelineDragging = false;
  private timelineDragStart = { x: 0, y: 0 };
  private timelineEmptyClickCandidate = false;
  private timelineDragButton: number | null = null;
  private timelineSmartPanAxis: 'none' | 'x' | 'y' = 'none';
  private timelineCommitPoints: Array<{ commit: Commit; screenX: number; screenY: number }> = [];
  private timelineRange = { startMs: 0, endMs: 0 };
  private timelineInfoContainer: HTMLElement | null = null;
  private hoveredCommit: Commit | null = null;
  private lockedCommit: Commit | null = null;
  private readonly timelineScaleHeight = 50;
  private readonly timelineChangeMaxHeight = 80;
  private readonly timelineChangeScaleRightPadding = 24;
  private readonly timelineLineGap = 28;
  private readonly timelineGroupedLineGap = 48;
  private groupGapElement: HTMLElement | null = null;
  private groupScrollSpeedElement: HTMLElement | null = null;
  private extendedScaleTicksElement: HTMLElement | null = null;
  private gestureHintsElement: HTMLElement | null = null;
  private gestureGroupScrollElement: HTMLElement | null = null;
  private transitionDurationElement: HTMLElement | null = null;
  private gestureLockElement: HTMLElement | null = null;
  private gestureUnlockElement: HTMLElement | null = null;
  private hotkeyEscElement: HTMLElement | null = null;
  private leftPanModeElement: HTMLElement | null = null;
  private gestureCombinedPanElement: HTMLElement | null = null;
  
  private config = {
    startDate: '',
    endDate: '',
    displayMode: 'Timeline' as DisplayMode,
    groupBy: 'Day' as GroupBy,
    searchTerm: '',
    enableDateFilter: false,
    groupGap: this.timelineGroupedLineGap,
    groupScrollSpeed: 1,
    extendedScaleTicks: true,
    transitionDuration: 0.5,
    leftPanMode: 'Direction-lock on drag start' as LeftPanMode,
  };

  constructor() {
    this.timelinePanel = document.getElementById('timeline-panel')!;
    this.init();
  }

  private async init() {
    this.initFullscreenToggle();
    this.initHotkeys();
    this.initContextMenuClear();
    await this.loadTimeline();
    this.initTweakpane();
    this.filterCommits();
    this.render();
  }

  private async loadTimeline() {
    try {
      const response = await fetch('/project-history/git-timeline.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch timeline data (status: ${response.status})`);
      }
      this.commits = (await response.json()) as Commit[];
      
      // Sort commits by timestamp descending (newest first)
      this.commits.sort((a, b) => b.timestamp - a.timestamp);

      if (this.commits.length > 0) {
        // Set default dates based on data
        // Commits are sorted desc, so last is oldest, first is newest
        const lastCommit = this.commits[0];
        const firstCommit = this.commits[this.commits.length - 1];
        
        this.config.startDate = this.formatDateForInput(new Date(firstCommit.timestamp * 1000));
        this.config.endDate = this.formatDateForInput(new Date(lastCommit.timestamp * 1000));
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
      this.timelinePanel.innerHTML = `
        <div class="no-data">
          <p>Could not load timeline data.</p>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  private formatDateForInput(date: Date): string {
    // Format YYYY-MM-DD for date input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private initTweakpane() {
    const container = document.getElementById('tweakpane-container');
    if (!container) return;

    this.pane = new Pane({ 
      title: 'Timeline Controls',
      container: container
    });

    // Date inputs are not natively supported well in Tweakpane v3 as simple text bindings for now,
    // but string binding works for YYYY-MM-DD.
    // Alternatively, we could inject actual HTML inputs if we wanted, but text input is simplest.
    
    this.pane.addBinding(this.config, 'searchTerm', {
      label: 'Search',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });

    this.pane.addBinding(this.config, 'enableDateFilter', {
      label: 'Enable Date Filter',
    }).on('change', () => {
      this.updateDateFilterVisibility();
      this.filterCommits();
      this.render();
    });

    const startDateBinding = this.pane.addBinding(this.config, 'startDate', {
      label: 'Start Date',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });

    const endDateBinding = this.pane.addBinding(this.config, 'endDate', {
      label: 'End Date',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });

    this.pane.addBinding(this.config, 'displayMode', {
      options: {
        'List': 'List',
        'Timeline': 'Timeline',
      },
      label: 'Display Mode',
    }).on('change', () => {
      this.updateGroupByVisibility();
      this.updateCenterViewVisibility();
      this.updateScaleTickVisibility();
      this.updateGestureHintsVisibility();
      this.updateFullscreenToggleVisibility();
      this.updateTransitionDurationVisibility();
      this.updateLeftPanModeVisibility();
      if (this.config.displayMode !== 'Timeline' && document.body.classList.contains('fullscreen-mode')) {
        this.exitFullscreenMode();
      }
      this.render();
    });

    const groupByBinding = this.pane.addBinding(this.config, 'groupBy', {
      options: {
        '(None)': 'None',
        'Day': 'Day',
        'Week': 'Week',
        'Month': 'Month',
        'Year': 'Year',
      },
      label: 'Group By',
    }).on('change', () => {
      if (this.config.displayMode !== 'Timeline') return;
      this.updateGroupGapVisibility();
      this.updateLeftPanModeVisibility();
      this.updateGestureHintsContent();
      this.render();
    });

    const groupGapBinding = this.pane.addBinding(this.config, 'groupGap', {
      label: 'Group Gap',
      min: 20,
      max: 120,
      step: 2,
    }).on('change', () => {
      if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') return;
      this.drawTimeline();
    });

    const groupScrollSpeedBinding = this.pane.addBinding(this.config, 'groupScrollSpeed', {
      label: 'Group Scroll Speed',
      min: 0.1,
      max: 2,
      step: 0.1,
    });

    const transitionDurationBinding = this.pane.addBinding(this.config, 'transitionDuration', {
      label: 'Transition Time (s)',
      min: 0,
      max: 1,
      step: 0.01,
    });

    const leftPanModeBinding = this.pane.addBinding(this.config, 'leftPanMode', {
      label: 'Left Pan',
      options: {
        'Time Axis Only': 'Time Axis Only',
        'Naive Combined': 'Naive Combined',
        'Direction-lock on drag start': 'Direction-lock on drag start',
        'Dead-zone + axis snapping': 'Dead-zone + axis snapping',
      },
    });

    const extendedScaleTicksBinding = this.pane.addBinding(this.config, 'extendedScaleTicks', {
      label: 'Extend Scale Ticks',
    }).on('change', () => {
      if (this.config.displayMode !== 'Timeline') return;
      this.drawTimeline();
    });

    const centerViewButton = this.pane.addButton({
      title: 'Center View',
    }).on('click', () => {
      if (this.config.displayMode !== 'Timeline') return;
      this.resetTimelineView();
      this.drawTimeline();
    });

    this.startDateElement = startDateBinding.element;
    this.endDateElement = endDateBinding.element;
    this.groupByElement = groupByBinding.element;
    this.groupGapElement = groupGapBinding.element;
    this.groupScrollSpeedElement = groupScrollSpeedBinding.element;
    this.transitionDurationElement = transitionDurationBinding.element;
    this.leftPanModeElement = leftPanModeBinding.element;
    this.extendedScaleTicksElement = extendedScaleTicksBinding.element;
    this.centerViewElement = centerViewButton.element;
    this.gestureHintsElement = document.getElementById('gesture-hints');
    this.gestureGroupScrollElement = document.getElementById('gesture-group-scroll');
    this.gestureLockElement = document.getElementById('gesture-lock');
    this.gestureUnlockElement = document.getElementById('gesture-unlock');
    this.hotkeyEscElement = document.getElementById('hotkey-esc');
    this.gestureCombinedPanElement = document.getElementById('gesture-combined-pan');
    this.updateDateFilterVisibility();
    this.updateGroupByVisibility();
    this.updateCenterViewVisibility();
    this.updateGroupGapVisibility();
    this.updateScaleTickVisibility();
    this.updateGestureHintsVisibility();
    this.updateGestureHintsContent();
    this.updateFullscreenToggleVisibility();
    this.updateTransitionDurationVisibility();
    this.updateLeftPanModeVisibility();
  }

  private initFullscreenToggle() {
    this.fullscreenToggleElement = document.getElementById('fullscreen-toggle') as HTMLButtonElement | null;
    this.fullscreenToggleElement?.addEventListener('click', () => this.toggleFullscreenMode());
    this.bindFullscreenExit();
  }

  private bindFullscreenExit() {
    this.fullscreenExitElement = document.getElementById('fullscreen-exit') as HTMLButtonElement | null;
    if (!this.fullscreenExitElement) return;
    this.fullscreenExitElement.onclick = () => this.toggleFullscreenMode();
  }

  private initContextMenuClear() {
    // Scoped to the Pixi canvas when it exists.
  }

  private initHotkeys() {
    document.addEventListener('keydown', (event) => this.handleHotkeys(event));
  }

  private handleHotkeys(event: KeyboardEvent) {
    if (event.defaultPrevented || this.isTextInputActive()) return;

    if (event.key === 'Escape') {
      if (this.lockedCommit) {
        event.preventDefault();
        this.clearLockedCommit();
      }
      return;
    }

    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      this.toggleFullscreenMode();
      return;
    }

    if (this.config.displayMode !== 'Timeline') return;
    if (!this.lockedCommit) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.navigateCommit(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.navigateCommit(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') return;
      event.preventDefault();
      this.navigateGroupRow(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') return;
      event.preventDefault();
      this.navigateGroupRow(1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.navigateGroupEdge(-1);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.navigateGroupEdge(1);
    }
  }

  private isTextInputActive(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tweakpane = document.getElementById('tweakpane-container');
    if (tweakpane && tweakpane.contains(active)) return true;
    if (active instanceof HTMLInputElement) return true;
    if (active instanceof HTMLTextAreaElement) return true;
    if (active instanceof HTMLSelectElement) return true;
    if (active instanceof HTMLElement && active.isContentEditable) return true;
    return false;
  }

  private toggleFullscreenMode() {
    if (this.config.displayMode !== 'Timeline') return;
    document.body.classList.toggle('fullscreen-mode');
    this.timelineApp?.resize();
    this.updateTimelineViewport();
    this.updateTimelineVerticalOffset();
    this.drawTimeline();
    if (this.fullscreenToggleElement) {
      this.fullscreenToggleElement.textContent = document.body.classList.contains('fullscreen-mode')
        ? 'Exit Fullscreen'
        : 'Fullscreen Mode';
    }
  }

  private exitFullscreenMode() {
    if (!document.body.classList.contains('fullscreen-mode')) return;
    document.body.classList.remove('fullscreen-mode');
    this.timelineApp?.resize();
    this.updateTimelineViewport();
    this.updateTimelineVerticalOffset();
    this.drawTimeline();
    if (this.fullscreenToggleElement) {
      this.fullscreenToggleElement.textContent = 'Fullscreen Mode';
    }
  }

  private filterCommits() {
    const start = new Date(this.config.startDate).getTime() / 1000;
    // End date should include the full day, so add 24 hours (roughly) or set to end of day
    // Simple way: treat input as midnight UTC or Local? Date.parse handles local.
    // Let's assume user input YYYY-MM-DD means "from the start of this day" to "end of that day"
    const endDateObj = new Date(this.config.endDate);
    endDateObj.setHours(23, 59, 59, 999);
    const end = endDateObj.getTime() / 1000;

    const term = this.config.searchTerm.toLowerCase();

    this.filteredCommits = this.commits.filter(commit => {
      // Date filter (optional)
      if (this.config.enableDateFilter) {
        // Check if valid dates provided
        if (!isNaN(start) && commit.timestamp < start) return false;
        if (!isNaN(end) && commit.timestamp > end) return false;
      }

      // Search filter
      if (term) {
        const content = `${commit.message} ${commit.authorName} ${commit.hash}`.toLowerCase();
        if (!content.includes(term)) return false;
      }

      return true;
    });
  }

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

  private updateScaleTickVisibility() {
    const display = this.config.displayMode === 'Timeline' ? '' : 'none';
    if (this.extendedScaleTicksElement) this.extendedScaleTicksElement.style.display = display;
  }

  private updateGestureHintsVisibility() {
    const display = this.config.displayMode === 'Timeline' ? '' : 'none';
    if (this.gestureHintsElement) this.gestureHintsElement.style.display = display;
    this.updateGestureHintsContent();
  }

  private updateGroupGapVisibility() {
    const display = this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None' ? '' : 'none';
    if (this.groupGapElement) this.groupGapElement.style.display = display;
    if (this.groupScrollSpeedElement) this.groupScrollSpeedElement.style.display = display;
  }

  private updateGestureHintsContent() {
    const display = this.config.groupBy === 'None' ? 'none' : '';
    if (this.gestureGroupScrollElement) {
      this.gestureGroupScrollElement.style.display = display;
    }
    if (this.gestureCombinedPanElement) {
      this.gestureCombinedPanElement.style.display = this.config.leftPanMode !== 'Time Axis Only' ? '' : 'none';
    }
    const showLock = this.lockedCommit ? 'none' : '';
    const showUnlock = this.lockedCommit ? '' : 'none';
    if (this.gestureLockElement) {
      this.gestureLockElement.style.display = showLock;
    }
    if (this.gestureUnlockElement) {
      this.gestureUnlockElement.style.display = showUnlock;
    }
    if (this.hotkeyEscElement) {
      this.hotkeyEscElement.style.display = showUnlock;
    }
  }

  private updateFullscreenToggleVisibility() {
    const display = this.config.displayMode === 'Timeline' ? '' : 'none';
    if (this.fullscreenToggleElement) {
      this.fullscreenToggleElement.style.display = display;
    }
  }

  private updateTransitionDurationVisibility() {
    const display = this.config.displayMode === 'Timeline' ? '' : 'none';
    if (this.transitionDurationElement) {
      this.transitionDurationElement.style.display = display;
    }
  }

  private updateLeftPanModeVisibility() {
    const display = this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None' ? '' : 'none';
    if (this.leftPanModeElement) {
      this.leftPanModeElement.style.display = display;
    }
  }

  private render() {
    if (this.filteredCommits.length === 0) {
      this.destroyTimelinePixi();
      this.timelinePanel.innerHTML = '<div class="no-data">No commits found matching criteria.</div>';
      return;
    }

    if (this.config.displayMode === 'List') {
      this.destroyTimelinePixi();
      this.renderList();
      return;
    }

    void this.renderTimeline();
  }

  private renderList() {
    this.timelinePanel.className = '';
    const html = this.filteredCommits.map(commit => this.buildCommitCard(commit)).join('');

    const searchSuffix = this.config.searchTerm.trim()
      ? ` (filtered by "${this.escapeHtml(this.config.searchTerm.trim())}")`
      : '';
    const dateSuffix = this.config.enableDateFilter ? ' (date filter enabled)' : '';
    this.timelinePanel.innerHTML = `
      <h2>Timeline (${this.filteredCommits.length} commits)${searchSuffix}${dateSuffix}</h2>
      ${html}
    `;

    this.bindCheckoutButtons();
  }

  private async renderTimeline() {
    this.timelinePanel.className = 'timeline-mode';
    const searchSuffix = this.config.searchTerm.trim()
      ? ` (filtered by "${this.escapeHtml(this.config.searchTerm.trim())}")`
      : '';
    const dateSuffix = this.config.enableDateFilter ? ' (date filter enabled)' : '';

    this.timelinePanel.innerHTML = `
      <h2>Timeline (${this.filteredCommits.length} commits)${searchSuffix}${dateSuffix}</h2>
      <div class="timeline-canvas-container">
        <button id="fullscreen-exit" class="fullscreen-button" type="button">Exit Fullscreen</button>
        <div id="timeline-canvas"></div>
        <div id="timeline-info" class="timeline-info-overlay">${this.renderCommitInfo(null)}</div>
      </div>
    `;

    const canvasContainer = document.getElementById('timeline-canvas');
    if (!canvasContainer) return;
    this.timelineInfoContainer = document.getElementById('timeline-info');
    this.bindFullscreenExit();

    await this.initTimelinePixi(canvasContainer);
    this.updateTimelineData();
    this.resetTimelineView();
    this.drawTimeline();
  }

  private navigateCommit(direction: -1 | 1) {
    if (this.filteredCommits.length === 0) return;
    if (!this.lockedCommit) return;
    const current = this.lockedCommit;
    const currentIndex = this.filteredCommits.findIndex(commit => commit.hash === current.hash);
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = this.clamp(startIndex + (direction > 0 ? -1 : 1), 0, this.filteredCommits.length - 1);
    const nextCommit = this.filteredCommits[nextIndex];
    if (!nextCommit) return;
    if (nextCommit.hash === current.hash) return;
    this.setLockedCommit(nextCommit);
    this.centerOnCommitData(nextCommit);
  }

  private navigateGroupEdge(direction: -1 | 1) {
    if (this.filteredCommits.length === 0 || !this.lockedCommit) return;
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      const target = direction < 0 ? this.filteredCommits[this.filteredCommits.length - 1] : this.filteredCommits[0];
      if (!target) return;
      if (target.hash === this.lockedCommit.hash) return;
      this.setLockedCommit(target);
      this.centerOnCommitData(target);
      return;
    }

    const grouped = this.getGroupedCommits();
    if (grouped.length === 0) return;
    const current = this.lockedCommit;
    const currentGroupIndex = grouped.findIndex(group => (
      group.commits.some(commit => commit.hash === current.hash)
    ));
    const groupIndex = currentGroupIndex >= 0 ? currentGroupIndex : 0;
    const group = grouped[groupIndex];
    if (!group || group.commits.length === 0) return;
    const target = direction < 0 ? this.getGroupEarliestCommit(group) : this.getGroupLatestCommit(group);
    if (target.hash === current.hash) return;
    this.setLockedCommit(target);
    this.centerOnCommitData(target);
  }

  private navigateGroupRow(direction: -1 | 1) {
    if (!this.lockedCommit) return;
    const grouped = this.getGroupedCommits();
    if (grouped.length === 0) return;

    const current = this.lockedCommit;
    const currentGroupIndex = grouped.findIndex(group => (
      group.commits.some(commit => commit.hash === current.hash)
    ));
    const groupIndex = currentGroupIndex >= 0 ? currentGroupIndex : 0;
    const nextGroupIndex = this.clamp(groupIndex + direction, 0, grouped.length - 1);
    const nextGroup = grouped[nextGroupIndex];
    if (!nextGroup || nextGroup.commits.length === 0) return;

    let bestCommit = nextGroup.commits[0];
    if (nextGroupIndex === groupIndex) {
      bestCommit = direction < 0
        ? this.getGroupEarliestCommit(nextGroup)
        : this.getGroupLatestCommit(nextGroup);
    } else {
      const currentGroup = grouped[groupIndex];
      const currentPosition = this.getCommitGroupPosition(current, currentGroup ?? nextGroup);
      let bestDistance = Math.abs(this.getCommitGroupPosition(bestCommit, nextGroup) - currentPosition);
      for (const commit of nextGroup.commits) {
        const distance = Math.abs(this.getCommitGroupPosition(commit, nextGroup) - currentPosition);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCommit = commit;
        }
      }
    }

    if (bestCommit.hash === current.hash) return;
    this.setLockedCommit(bestCommit);
    this.centerOnCommitData(bestCommit);
  }

  private getCommitGroupPosition(commit: Commit, group: GroupedCommits): number {
    const commitMs = commit.timestamp * 1000;
    return Math.max(0, commitMs - group.startMs);
  }

  private applyGroupDrag(dy: number) {
    const grouped = this.getGroupedCommits();
    const gap = this.getLineGap();
    const maxOffset = Math.max(0, (grouped.length - 1) * gap * 0.5);
    this.timelineGroupScrollOffsetY = this.clamp(
      this.timelineGroupScrollOffsetStart + dy,
      -maxOffset,
      maxOffset
    );
    this.updateTimelineVerticalOffset();
  }

  private getSmartPanMode(): LeftPanMode | null {
    if (this.config.leftPanMode === 'Direction-lock on drag start') return this.config.leftPanMode;
    if (this.config.leftPanMode === 'Dead-zone + axis snapping') return this.config.leftPanMode;
    return null;
  }

  private updateSmartPanAxis(dx: number, dy: number, mode: LeftPanMode): 'none' | 'x' | 'y' {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (this.timelineSmartPanAxis === 'none') {
      if (mode === 'Dead-zone + axis snapping') {
        const distance = Math.hypot(dx, dy);
        if (distance < 8) return 'none';
        this.timelineSmartPanAxis = absX >= absY ? 'x' : 'y';
        return this.timelineSmartPanAxis;
      }

      const threshold = 6;
      if (Math.hypot(dx, dy) < threshold) return 'none';
      const ratio = 1.4;
      if (absX >= absY * ratio) {
        this.timelineSmartPanAxis = 'x';
        return 'x';
      }
      if (absY >= absX * ratio) {
        this.timelineSmartPanAxis = 'y';
        return 'y';
      }
      return 'none';
    }

    return this.timelineSmartPanAxis;
  }

  private getGroupEarliestCommit(group: GroupedCommits): Commit {
    return group.commits.reduce((earliest, commit) => (
      commit.timestamp < earliest.timestamp ? commit : earliest
    ), group.commits[0]);
  }

  private getGroupLatestCommit(group: GroupedCommits): Commit {
    return group.commits.reduce((latest, commit) => (
      commit.timestamp > latest.timestamp ? commit : latest
    ), group.commits[0]);
  }

  private buildCommitCard(commit: Commit): string {
    const date = new Date(commit.timestamp * 1000).toLocaleString();
    const checkoutCommand = `git checkout ${commit.hash}`;
    const tooltip = `Click to copy '${checkoutCommand}' to clipboard`;
    return `
      <div class="commit-item">
        <div class="commit-header">
          <span title="${commit.hash}">${commit.hash.substring(0, 7)}</span>
          <span>${date}</span>
          <span>${commit.authorName}</span>
        </div>
        <div class="commit-message">${this.escapeHtml(commit.message)}</div>
        <div class="commit-stats">
          <span class="added">+${commit.addedLines}</span>
          <span class="removed">-${commit.removedLines}</span>
          <button class="checkout-button" data-checkout="${this.escapeHtml(checkoutCommand)}" title="${this.escapeHtml(tooltip)}">git checkout</button>
        </div>
      </div>
    `;
  }

  private renderCommitInfo(commit: Commit | null): string {
    if (!commit) {
      return '<div class="commit-item commit-item-empty">Hover a commit to see details.</div>';
    }

    const card = this.buildCommitCard(commit);
    if (!this.lockedCommit || this.lockedCommit.hash !== commit.hash) {
      return card;
    }
    return card.replace('<div class="commit-item">', '<div class="commit-item commit-item-locked">');
  }

  private async initTimelinePixi(container: HTMLElement) {
    this.destroyTimelinePixi();

    this.timelineApp = new Application();
    await this.timelineApp.init({
      background: 0x141414,
      resizeTo: container,
      antialias: true,
    });

    container.appendChild(this.timelineApp.canvas);
    this.timelineApp.stage.sortableChildren = true;
    this.timelineApp.stage.eventMode = 'static';
    this.timelineApp.stage.hitArea = this.timelineApp.screen;

    this.timelineScaleGraphics = new Graphics();
    this.timelineLineGraphics = new Graphics();
    this.timelineChangeGraphics = new Graphics();
    this.timelineChangeScaleGraphics = new Graphics();
    this.timelineGraphics = new Graphics();
    this.timelineHoverGraphics = new Graphics();
    this.timelineLockedGraphics = new Graphics();
    this.timelineTextContainer = new Container();
    this.timelineChangeTextContainer = new Container();
    this.timelineGroupLabelContainer = new Container();

    this.timelineLineGraphics.zIndex = 2;
    this.timelineChangeGraphics.zIndex = 3;
    this.timelineGraphics.zIndex = 4;
    this.timelineHoverGraphics.zIndex = 5;
    this.timelineLockedGraphics.zIndex = 6;
    this.timelineChangeScaleGraphics.zIndex = 7;
    this.timelineChangeTextContainer.zIndex = 9;
    this.timelineGroupLabelContainer.zIndex = 10;
    this.timelineScaleGraphics.zIndex = 11;
    this.timelineTextContainer.zIndex = 12;

    this.timelineApp.stage.addChild(this.timelineScaleGraphics);
    this.timelineApp.stage.addChild(this.timelineLineGraphics);
    this.timelineApp.stage.addChild(this.timelineChangeGraphics);
    this.timelineApp.stage.addChild(this.timelineGraphics);
    this.timelineApp.stage.addChild(this.timelineHoverGraphics);
    this.timelineApp.stage.addChild(this.timelineLockedGraphics);
    this.timelineApp.stage.addChild(this.timelineChangeScaleGraphics);
    this.timelineApp.stage.addChild(this.timelineTextContainer);
    this.timelineApp.stage.addChild(this.timelineChangeTextContainer);
    this.timelineApp.stage.addChild(this.timelineGroupLabelContainer);

    this.timelineApp.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerDown(e);
    });
    this.timelineApp.stage.on('pointermove', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerMove(e);
    });
    this.timelineApp.stage.on('pointerup', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerUp(e);
    });
    this.timelineApp.stage.on('pointerupoutside', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerUp(e);
    });

    this.timelineApp.canvas.addEventListener('wheel', this.handleTimelineWheel, { passive: false });
    this.timelineApp.canvas.addEventListener('mousemove', this.handleTimelineMouseMove);
    this.timelineApp.canvas.addEventListener('mouseleave', this.handleTimelineMouseLeave);
    this.timelineApp.canvas.addEventListener('contextmenu', this.handleTimelineContextMenu);

    this.timelineResizeObserver = new ResizeObserver(() => {
      if (!this.timelineApp) return;
      this.timelineApp.resize();
      this.timelineApp.stage.hitArea = this.timelineApp.screen;
      this.updateTimelineViewport();
      this.updateTimelineVerticalOffset();
      this.drawTimeline();
    });
    this.timelineResizeObserver.observe(container);

    this.updateTimelineViewport();
    this.updateTimelineVerticalOffset();
  }

  private destroyTimelinePixi() {
    if (this.timelineResizeObserver) {
      this.timelineResizeObserver.disconnect();
      this.timelineResizeObserver = null;
    }
    if (this.timelineApp) {
      this.timelineApp.canvas.removeEventListener('wheel', this.handleTimelineWheel);
      this.timelineApp.canvas.removeEventListener('mousemove', this.handleTimelineMouseMove);
      this.timelineApp.canvas.removeEventListener('mouseleave', this.handleTimelineMouseLeave);
      this.timelineApp.canvas.removeEventListener('contextmenu', this.handleTimelineContextMenu);
      this.timelineApp.destroy(true);
      this.timelineApp = null;
    }
    this.timelineGraphics = null;
    this.timelineLineGraphics = null;
    this.timelineChangeGraphics = null;
    this.timelineChangeScaleGraphics = null;
    this.timelineScaleGraphics = null;
    this.timelineHoverGraphics = null;
    this.timelineLockedGraphics = null;
    this.timelineTextContainer = null;
    this.timelineChangeTextContainer = null;
    this.timelineGroupLabelContainer = null;
    this.timelineCommitPoints = [];
    this.timelineInfoContainer = null;
    this.hoveredCommit = null;
    this.lockedCommit = null;
  }

  private updateTimelineViewport() {
    if (!this.timelineApp) return;
    this.timelineViewportCenter = {
      x: this.timelineApp.screen.width / 2,
      y: this.timelineApp.screen.height / 2,
    };
  }

  private updateTimelineVerticalOffset() {
    if (!this.timelineApp) return;
    const lineY = this.timelineApp.screen.height / 2;
    this.timelineViewOffset.y = lineY - this.timelineViewportCenter.y;
    if (this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None') {
      this.timelineViewOffset.y += this.timelineGroupScrollOffsetY;
    }
  }

  private updateTimelineData() {
    this.timelineRange = this.getTimelineRange();
    this.hoveredCommit = null;
    if (this.lockedCommit && !this.filteredCommits.some(commit => commit.hash === this.lockedCommit?.hash)) {
      this.lockedCommit = null;
    }
    this.updateTimelineInfo();
  }

  private getTimelineRange(): { startMs: number; endMs: number } {
    let startMs: number | null = null;
    let endMs: number | null = null;

    if (this.config.enableDateFilter) {
      const startDate = new Date(this.config.startDate);
      const endDate = new Date(this.config.endDate);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        startMs = startDate.getTime();
        endMs = endDate.getTime();
      }
    }

    if (startMs === null || endMs === null) {
      const timestamps = this.filteredCommits.map(commit => commit.timestamp * 1000);
      startMs = Math.min(...timestamps);
      endMs = Math.max(...timestamps);
    }

    if (endMs <= startMs) {
      endMs = startMs + 1000;
    }

    return { startMs, endMs };
  }

  private resetTimelineView() {
    if (!this.timelineApp) return;
    const grouped = this.getGroupedCommits();
    const rangeSeconds = this.getDisplayRangeSeconds(grouped);
    const basePadding = 60;
    let leftPadding = basePadding;
    let rightPadding = basePadding;

    if (this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None') {
      leftPadding = Math.max(basePadding, this.getGroupLabelPadding(grouped));
      const maxAdded = Math.max(1, ...this.filteredCommits.map(commit => commit.addedLines));
      const maxRemoved = Math.max(1, ...this.filteredCommits.map(commit => commit.removedLines));
      const maxValue = Math.max(maxAdded, maxRemoved, 1);
      rightPadding = Math.max(basePadding, this.getChangeScalePadding(maxValue) + 8);
    }

    const availableWidth = Math.max(1, this.timelineApp.screen.width - leftPadding - rightPadding);
    const nextScale = rangeSeconds > 0 ? availableWidth / rangeSeconds : 1;
    this.timelineScale = nextScale;
    this.timelineScaleBounds = {
      min: nextScale / 200,
      max: nextScale * 200,
    };
    this.timelineViewOffset = {
      x: leftPadding - this.timelineViewportCenter.x,
      y: this.timelineViewOffset.y,
    };
    this.timelineGroupScrollOffsetY = 0;
    this.updateTimelineVerticalOffset();
  }

  private handleTimelinePointerDown(e: FederatedPointerEvent) {
    if (e.button !== 0) return;
    if (!e.ctrlKey && this.hoveredCommit) {
      const commitPoint = this.findCommitPointForCommit(this.hoveredCommit);
      if (commitPoint) {
        this.setLockedCommit(commitPoint.commit);
        this.centerOnScreenPoint(commitPoint.screenX, commitPoint.screenY);
        return;
      }
    }
    this.cancelTimelineTransition();
    this.timelineDragging = true;
    this.timelineDragButton = 0;
    this.timelineSmartPanAxis = 'none';
    this.timelineDragStart = { x: e.global.x, y: e.global.y };
    this.timelineViewOffsetStart = { ...this.timelineViewOffset };
    this.timelineEmptyClickCandidate = !this.hoveredCommit && !e.ctrlKey;
    this.timelineGroupScrollOffsetStart = this.timelineGroupScrollOffsetY;
  }

  private handleTimelinePointerMove(e: FederatedPointerEvent) {
    if (this.timelineDragging) {
      const canGroupDrag = this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None';
      const isLeft = this.timelineDragButton === 0;
      const smartMode = this.getSmartPanMode();
      const useCombined = isLeft && canGroupDrag && this.config.leftPanMode !== 'Time Axis Only';
    const groupOnly = canGroupDrag && (isLeft && e.ctrlKey);

      if (groupOnly) {
        this.applyGroupDrag(e.global.y - this.timelineDragStart.y);
        this.drawTimeline();
        return;
      }

      if (useCombined && smartMode) {
        const axis = this.updateSmartPanAxis(e.global.x - this.timelineDragStart.x, e.global.y - this.timelineDragStart.y, smartMode);
        if (axis === 'y') {
          this.applyGroupDrag(e.global.y - this.timelineDragStart.y);
          this.drawTimeline();
          return;
        }
        if (axis === 'none') {
          return;
        }
      } else if (useCombined && this.config.leftPanMode === 'Naive Combined') {
        this.applyGroupDrag(e.global.y - this.timelineDragStart.y);
      }

      const dx = e.global.x - this.timelineDragStart.x;
      this.timelineViewOffset = {
        x: this.timelineViewOffsetStart.x + dx,
        y: this.timelineViewOffsetStart.y,
      };
      this.drawTimeline();
      return;
    }

    this.updateHoverCommit(e.global.x, e.global.y);
  }

  private findCommitPointForCommit(commit: Commit) {
    return this.timelineCommitPoints.find(point => point.commit.hash === commit.hash) ?? null;
  }

  private centerOnCommitData(commit: Commit) {
    if (!this.timelineApp) return;
    const grouped = this.getGroupedCommits();
    const lineOffsets = this.getLineOffsets(grouped.length);
    const baseLineY = this.worldToScreen(0, 0).y;
    const lineYs = lineOffsets.map(offset => baseLineY + offset);
    let groupIndex = 0;
    for (let i = 0; i < grouped.length; i += 1) {
      if (grouped[i]?.commits.some(item => item.hash === commit.hash)) {
        groupIndex = i;
        break;
      }
    }
    const group = grouped[groupIndex];
    if (!group) return;
    const lineY = lineYs[groupIndex] ?? baseLineY;
    const commitMs = commit.timestamp * 1000;
    const worldX = (commitMs - group.startMs) / 1000;
    const screenX = this.worldToScreen(worldX, 0).x;
    this.centerOnScreenPoint(screenX, lineY);
  }

  private centerOnScreenPoint(screenX: number, screenY: number) {
    const dx = this.timelineViewportCenter.x - screenX;
    const targetViewOffsetX = this.timelineViewOffset.x + dx;
    let targetGroupScrollOffsetY = this.timelineGroupScrollOffsetY;

    if (this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None') {
      const grouped = this.getGroupedCommits();
      const gap = this.getLineGap();
      const maxOffset = Math.max(0, (grouped.length - 1) * gap * 0.5);
      const dy = this.timelineViewportCenter.y - screenY;
      targetGroupScrollOffsetY = this.clamp(
        this.timelineGroupScrollOffsetY + dy,
        -maxOffset,
        maxOffset
      );
    }

    this.animateToOffsets(targetViewOffsetX, targetGroupScrollOffsetY);
  }

  private animateToOffsets(targetViewOffsetX: number, targetGroupScrollOffsetY: number) {
    const duration = Math.max(0, Math.min(1, this.config.transitionDuration)) * 1000;
    if (duration === 0) {
      this.timelineViewOffset.x = targetViewOffsetX;
      this.timelineGroupScrollOffsetY = targetGroupScrollOffsetY;
      this.updateTimelineVerticalOffset();
      this.drawTimeline();
      return;
    }

    this.cancelTimelineTransition();

    const startX = this.timelineViewOffset.x;
    const startGroupY = this.timelineGroupScrollOffsetY;
    const deltaX = targetViewOffsetX - startX;
    const deltaGroupY = targetGroupScrollOffsetY - startGroupY;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.timelineViewOffset.x = startX + deltaX * eased;
      this.timelineGroupScrollOffsetY = startGroupY + deltaGroupY * eased;
      this.updateTimelineVerticalOffset();
      this.drawTimeline();
      if (t < 1) {
        this.timelineTransitionFrame = requestAnimationFrame(step);
      } else {
        this.timelineTransitionFrame = null;
      }
    };

    this.timelineTransitionFrame = requestAnimationFrame(step);
  }

  private cancelTimelineTransition() {
    if (this.timelineTransitionFrame === null) return;
    cancelAnimationFrame(this.timelineTransitionFrame);
    this.timelineTransitionFrame = null;
  }

  private handleTimelinePointerUp(e: FederatedPointerEvent) {
    if (this.timelineDragging) {
      const dx = e.global.x - this.timelineDragStart.x;
      const dy = e.global.y - this.timelineDragStart.y;
      const moved = Math.hypot(dx, dy);
      if (this.timelineDragButton === 0 && this.timelineEmptyClickCandidate && moved < 5) {
        this.clearLockedCommit();
      }
    }
    this.timelineDragging = false;
    this.timelineEmptyClickCandidate = false;
    this.timelineDragButton = null;
    this.timelineSmartPanAxis = 'none';
  }

  private handleTimelineWheel = (e: WheelEvent) => {
    if (!this.timelineApp) return;
    e.preventDefault();

    if (this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None' && e.ctrlKey) {
      this.cancelTimelineTransition();
      const grouped = this.getGroupedCommits();
      const gap = this.getLineGap();
      const maxOffset = Math.max(0, (grouped.length - 1) * gap * 0.5);
      const direction = Math.sign(e.deltaY);
      if (direction === 0) return;
      const speed = Number.isFinite(this.config.groupScrollSpeed) ? this.config.groupScrollSpeed : 1;
      const stepGroups = Math.max(0.1, speed);
      this.timelineGroupScrollOffsetY = this.clamp(
        this.timelineGroupScrollOffsetY - direction * gap * stepGroups,
        -maxOffset,
        maxOffset
      );
      this.updateTimelineVerticalOffset();
      this.drawTimeline();
      return;
    }

    const rect = this.timelineApp.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(screenX, screenY);
    const direction = Math.sign(e.deltaY);
    const factor = Math.pow(1.08, -direction);
    const nextScale = this.clamp(this.timelineScale * factor, this.timelineScaleBounds.min, this.timelineScaleBounds.max);
    if (nextScale === this.timelineScale) return;

    this.cancelTimelineTransition();
    this.timelineScale = nextScale;
    const nextScreen = this.worldToScreen(worldPos.x, worldPos.y);
    this.timelineViewOffset.x += screenX - nextScreen.x;
    this.updateTimelineVerticalOffset();
    this.drawTimeline();
  };

  private handleTimelineMouseMove = (e: MouseEvent) => {
    if (!this.timelineApp || this.timelineDragging) return;
    const rect = this.timelineApp.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    this.updateHoverCommit(screenX, screenY);
  };

  private handleTimelineMouseLeave = () => {
    if (!this.hoveredCommit) return;
    this.hoveredCommit = null;
    this.updateTimelineInfo();
    this.drawHoverCommit();
  };

  private handleTimelineContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private clearLockedCommit() {
    if (!this.lockedCommit) return;
    this.lockedCommit = null;
    this.updateTimelineInfo();
  }

  private setLockedCommit(commit: Commit) {
    this.lockedCommit = commit;
    this.hoveredCommit = commit;
    this.updateTimelineInfo();
  }

  private updateHoverCommit(screenX: number, screenY: number) {
    const radius = 21;
    let nextCommit: Commit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const point of this.timelineCommitPoints) {
      const dx = screenX - point.screenX;
      const dy = screenY - point.screenY;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius && dist < bestDistance) {
        bestDistance = dist;
        nextCommit = point.commit;
      }
    }

    if (!nextCommit) {
      if (!this.hoveredCommit) return;
      this.hoveredCommit = null;
      this.updateTimelineInfo();
      this.drawHoverCommit();
      return;
    }

    if (nextCommit?.hash === this.hoveredCommit?.hash) {
      return;
    }

    this.hoveredCommit = nextCommit;
    this.updateTimelineInfo();
    this.drawHoverCommit();
  }

  private updateTimelineInfo() {
    if (!this.timelineInfoContainer) {
      this.timelineInfoContainer = document.getElementById('timeline-info');
    }

    if (!this.timelineInfoContainer) return;
    const detailCommit = this.lockedCommit ?? this.hoveredCommit;
    this.timelineInfoContainer.innerHTML = this.renderCommitInfo(detailCommit);
    if (detailCommit) {
      this.bindCheckoutButtons();
    }
    this.updateGestureHintsContent();
    this.drawTimeline();
  }

  private drawHoverCommit() {
    if (!this.timelineHoverGraphics) return;
    this.timelineHoverGraphics.clear();
    if (!this.hoveredCommit) return;
    if (this.lockedCommit && this.lockedCommit.hash === this.hoveredCommit.hash) return;
    const point = this.timelineCommitPoints.find(candidate => candidate.commit.hash === this.hoveredCommit?.hash);
    if (!point) return;
    this.timelineHoverGraphics.circle(point.screenX, point.screenY, 7);
    this.timelineHoverGraphics.fill({ color: 0xffffff, alpha: 1 });
    this.timelineHoverGraphics.circle(point.screenX, point.screenY, 9);
    this.timelineHoverGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
  }

  private drawLockedCommit() {
    if (!this.timelineLockedGraphics) return;
    this.timelineLockedGraphics.clear();
    if (!this.lockedCommit) return;
    const point = this.timelineCommitPoints.find(candidate => candidate.commit.hash === this.lockedCommit?.hash);
    if (!point) return;
    this.timelineLockedGraphics.circle(point.screenX, point.screenY, 8);
    this.timelineLockedGraphics.fill({ color: 0xffd54f, alpha: 1 });
    this.timelineLockedGraphics.circle(point.screenX, point.screenY, 10);
    this.timelineLockedGraphics.stroke({ color: 0xffc107, width: 2, alpha: 0.95 });
  }

  private drawTimeline() {
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

    const timelineApp = this.timelineApp;
    const timelineGraphics = this.timelineGraphics;
    const timelineLineGraphics = this.timelineLineGraphics;

    this.updateTimelineVerticalOffset();
    const grouped = this.getGroupedCommits();
    const rangeSeconds = this.getDisplayRangeSeconds(grouped);
    const lineOffsets = this.getLineOffsets(grouped.length);
    const baseLineY = this.worldToScreen(0, 0).y;
    const lineYs = lineOffsets.map(offset => baseLineY + offset);
    const startX = this.worldToScreen(0, 0).x;
    const endX = this.worldToScreen(rangeSeconds, 0).x;

    timelineLineGraphics.clear();
    for (const lineY of lineYs) {
      timelineLineGraphics.moveTo(startX, lineY);
      timelineLineGraphics.lineTo(endX, lineY);
    }
    timelineLineGraphics.stroke({ color: 0x6b9cff, width: 2, alpha: 0.9 });

    this.timelineChangeGraphics.clear();
    this.drawChangeLines(grouped, lineYs);

    timelineGraphics.clear();

    const dotRadius = 7;
    this.timelineCommitPoints = [];
    grouped.forEach((group, index) => {
      const lineY = lineYs[index] ?? baseLineY;
      for (const commit of group.commits) {
        const commitMs = commit.timestamp * 1000;
        const worldX = (commitMs - group.startMs) / 1000;
        const screenX = this.worldToScreen(worldX, 0).x;
        if (screenX < -50 || screenX > timelineApp.screen.width + 50) {
          continue;
        }
        timelineGraphics.circle(screenX, lineY, dotRadius);
        timelineGraphics.fill({ color: 0x4a9eff, alpha: 0.95 });
        this.timelineCommitPoints.push({
          commit,
          screenX,
          screenY: lineY,
        });
      }
    });

    this.drawScale();
    this.drawChangeScale(grouped, lineYs);
    this.drawGroupLabels(grouped, lineYs);
    this.drawLockedCommit();
    this.drawHoverCommit();
  }

  private drawScale() {
    if (!this.timelineScaleGraphics || !this.timelineTextContainer || !this.timelineApp) return;
    const timelineScaleGraphics = this.timelineScaleGraphics;
    const timelineApp = this.timelineApp;
    const scaleHeight = this.timelineScaleHeight;
    const grouped = this.getGroupedCommits();
    const scaleRange = this.getScaleRange(grouped);
    const { startMs, endMs } = scaleRange;
    const visibleRange = this.getVisibleTimelineRange(scaleRange.startMs, scaleRange.endMs);
    const pxPerSecond = this.timelineScale;

    timelineScaleGraphics.clear();
    const scaleOverlayHeight = scaleHeight + 28;
    timelineScaleGraphics.rect(0, 0, timelineApp.screen.width, scaleOverlayHeight);
    timelineScaleGraphics.fill({ color: 0x141414, alpha: 0.92 });
    timelineScaleGraphics.stroke({ color: 0x2f2f2f, width: 1, alpha: 0.8 });
    timelineScaleGraphics.moveTo(0, scaleHeight);
    timelineScaleGraphics.lineTo(timelineApp.screen.width, scaleHeight);
    timelineScaleGraphics.stroke({ color: 0x7a7a7a, width: 1, alpha: 0.9 });

    const unitSelection = this.pickScaleUnits(pxPerSecond);
    const majorStyle = new TextStyle({ fill: 0xf0f0f0, fontSize: 15 });
    const minorStyle = new TextStyle({ fill: 0xb0b0b0, fontSize: 13 });

    this.timelineTextContainer.removeChildren().forEach(child => child.destroy());

    const majorLabelSpacing = 60;
    const minorLabelSpacing = 50;
    const usedLabelPositions = new Set<number>();
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      this.drawScaleMilestones(
        unitSelection.major,
        visibleRange.startMs,
        visibleRange.endMs,
        scaleHeight,
        new TextStyle({ fill: 0xe6e6e6, fontSize: 14 }),
        110,
        scaleRange.startMs,
        usedLabelPositions
      );
    }
    this.drawScaleUnit(
      unitSelection.major,
      true,
      visibleRange.startMs,
      visibleRange.endMs,
      scaleHeight,
      majorStyle,
      majorLabelSpacing,
      scaleRange.startMs,
      usedLabelPositions
    );
    if (unitSelection.minor) {
      this.drawScaleUnit(
        unitSelection.minor,
        false,
        visibleRange.startMs,
        visibleRange.endMs,
        scaleHeight,
        minorStyle,
        minorLabelSpacing,
        scaleRange.startMs,
        usedLabelPositions
      );
    }

    if (visibleRange.startMs > endMs || visibleRange.endMs < startMs) {
      return;
    }
  }

  private drawChangeLines(grouped: GroupedCommits[], lineYs: number[]) {
    if (!this.timelineChangeGraphics) return;
    const timelineChangeGraphics = this.timelineChangeGraphics;

    const maxAdded = Math.max(1, ...this.filteredCommits.map(commit => commit.addedLines));
    const maxRemoved = Math.max(1, ...this.filteredCommits.map(commit => commit.removedLines));
    const maxValue = Math.max(maxAdded, maxRemoved, 1);

    const valueToHeight = (value: number) => {
      const clamped = Math.max(0, value);
      const scaled = Math.log10(1 + clamped) / Math.log10(1 + maxValue);
      return scaled * this.timelineChangeMaxHeight;
    };

    timelineChangeGraphics.clear();
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

    grouped.forEach((group, index) => {
      const lineY = lineYs[index] ?? 0;
      for (const commit of group.commits) {
        const commitMs = commit.timestamp * 1000;
        const worldX = (commitMs - group.startMs) / 1000;
        const screenX = this.worldToScreen(worldX, 0).x;
        const height = valueToHeight(commit.removedLines);
        if (height <= 0) continue;
        timelineChangeGraphics.moveTo(screenX, lineY);
        timelineChangeGraphics.lineTo(screenX, lineY + height);
      }
    });
    timelineChangeGraphics.stroke({ color: 0xff5b5b, width: 2, alpha: 0.9 });
  }

  private drawChangeScale(grouped: GroupedCommits[], lineYs: number[]) {
    if (!this.timelineApp || !this.timelineChangeScaleGraphics || !this.timelineChangeTextContainer) return;
    const timelineApp = this.timelineApp;
    const timelineChangeScaleGraphics = this.timelineChangeScaleGraphics;

    const maxAdded = Math.max(1, ...this.filteredCommits.map(commit => commit.addedLines));
    const maxRemoved = Math.max(1, ...this.filteredCommits.map(commit => commit.removedLines));
    const maxValue = Math.max(maxAdded, maxRemoved, 1);
    const axisX = timelineApp.screen.width - this.getChangeScalePadding(maxValue);
    const height = this.timelineChangeMaxHeight;
    const scaleLineYs = this.getChangeScaleLineYs(grouped, lineYs);

    timelineChangeScaleGraphics.clear();
    scaleLineYs.forEach(lineY => {
      timelineChangeScaleGraphics.moveTo(axisX, lineY - height);
      timelineChangeScaleGraphics.lineTo(axisX, lineY + height);
    });
    timelineChangeScaleGraphics.stroke({ color: 0x8a8a8a, width: 1, alpha: 0.9 });

    this.timelineChangeTextContainer.removeChildren().forEach(child => child.destroy());

    const ticks = [1, 10, 100, 1000, 10000, 100000];
    const labelStyle = new TextStyle({ fill: 0xcfcfcf, fontSize: 12 });
    const valueToHeight = (value: number) => {
      const scaled = Math.log10(1 + value) / Math.log10(1 + maxValue);
      return scaled * height;
    };

    for (const tick of ticks) {
      if (tick > maxValue) continue;
      const offset = valueToHeight(tick);
      scaleLineYs.forEach(lineY => {
        timelineChangeScaleGraphics.moveTo(axisX - 6, lineY - offset);
        timelineChangeScaleGraphics.lineTo(axisX, lineY - offset);
        timelineChangeScaleGraphics.moveTo(axisX - 6, lineY + offset);
        timelineChangeScaleGraphics.lineTo(axisX, lineY + offset);
      });
    }
    timelineChangeScaleGraphics.stroke({ color: 0x8a8a8a, width: 1, alpha: 0.9 });

    const labelLineY = scaleLineYs[Math.floor(scaleLineYs.length / 2)] ?? 0;
    for (const tick of ticks) {
      if (tick > maxValue) continue;
      const offset = valueToHeight(tick);
      const labelUp = new Text({ text: `${tick}`, style: labelStyle });
      labelUp.x = axisX - 8 - labelUp.width;
      labelUp.y = labelLineY - offset - labelUp.height / 2;
      this.timelineChangeTextContainer.addChild(labelUp);

      const labelDown = new Text({ text: `${tick}`, style: labelStyle });
      labelDown.x = axisX - 8 - labelDown.width;
      labelDown.y = labelLineY + offset - labelDown.height / 2;
      this.timelineChangeTextContainer.addChild(labelDown);
    }
  }

  private drawScaleUnit(
    unit: ScaleUnit,
    isMajor: boolean,
    startMs: number,
    endMs: number,
    scaleHeight: number,
    style: TextStyle,
    minLabelSpacing: number,
    scaleStartMs: number,
    usedLabelPositions: Set<number>
  ) {
    if (!this.timelineScaleGraphics || !this.timelineTextContainer || !this.timelineApp) return;
    const timelineScaleGraphics = this.timelineScaleGraphics;
    const timelineApp = this.timelineApp;
    const lineHeight = isMajor ? scaleHeight : scaleHeight * 0.6;
    const labelOffset = isMajor ? 6 : 8;
    let lastLabelX = Number.NEGATIVE_INFINITY;

    const startDate = this.alignDateToUnit(new Date(startMs), unit);
    for (let date = startDate; date.getTime() <= endMs; date = this.addUnit(date, unit)) {
      const ms = date.getTime();
      if (ms < startMs) continue;
      const worldX = (ms - scaleStartMs) / 1000;
      const screenX = this.worldToScreen(worldX, 0).x;
      if (screenX < -50 || screenX > timelineApp.screen.width + 50) {
        continue;
      }
      if (this.config.extendedScaleTicks) {
        const overlayAlpha = isMajor ? 0.35 : 0.22;
        const overlayColor = isMajor ? 0x4a4a4a : 0x333333;
        timelineScaleGraphics.moveTo(screenX, scaleHeight);
        timelineScaleGraphics.lineTo(screenX, timelineApp.screen.height);
        timelineScaleGraphics.stroke({ color: overlayColor, width: 1, alpha: overlayAlpha });
      }
      const tickColor = isMajor ? 0x777777 : 0x4b4b4b;
      const tickAlpha = isMajor ? 0.9 : 0.7;
      timelineScaleGraphics.moveTo(screenX, scaleHeight);
      timelineScaleGraphics.lineTo(screenX, scaleHeight - lineHeight);
      timelineScaleGraphics.stroke({
        color: tickColor,
        width: 1,
        alpha: tickAlpha,
      });
      timelineScaleGraphics.rect(screenX - 0.5, scaleHeight - lineHeight, 1, lineHeight);
      timelineScaleGraphics.fill({ color: tickColor, alpha: tickAlpha });

      if (screenX - lastLabelX >= minLabelSpacing) {
        const labelKey = Math.round(screenX);
        if (usedLabelPositions.has(labelKey)) {
          continue;
        }
        const label = new Text({ text: this.formatScaleTickLabel(date, unit, scaleStartMs), style });
        label.rotation = -Math.PI / 2;
        label.x = screenX + labelOffset;
        label.y = scaleHeight - 4;
        this.timelineTextContainer.addChild(label);
        usedLabelPositions.add(labelKey);
        lastLabelX = screenX;
      }
    }
  }

  private drawScaleMilestones(
    majorUnit: ScaleUnit,
    startMs: number,
    endMs: number,
    scaleHeight: number,
    style: TextStyle,
    minLabelSpacing: number,
    scaleStartMs: number,
    usedLabelPositions: Set<number>
  ) {
    if (!this.timelineScaleGraphics || !this.timelineTextContainer || !this.timelineApp) return;
    const timelineApp = this.timelineApp;
    const largerUnits: ScaleUnit[] = ['decade', 'year', 'month', 'day', 'hour', 'tenMinute', 'minute'];
    const majorIndex = largerUnits.indexOf(majorUnit);
    const milestoneUnits = majorIndex <= 0 ? [] : largerUnits.slice(0, majorIndex);
    if (milestoneUnits.length === 0) return;

    for (const unit of milestoneUnits) {
      let lastLabelX = Number.NEGATIVE_INFINITY;
      const startDate = this.alignDateToUnit(new Date(startMs), unit);
      for (let date = startDate; date.getTime() <= endMs; date = this.addUnit(date, unit)) {
        const ms = date.getTime();
        if (ms < startMs) continue;
        const worldX = (ms - scaleStartMs) / 1000;
        const screenX = this.worldToScreen(worldX, 0).x;
        if (screenX < -50 || screenX > timelineApp.screen.width + 50) {
          continue;
        }
        if (screenX - lastLabelX < minLabelSpacing) {
          continue;
        }
        const labelKey = Math.round(screenX);
        if (usedLabelPositions.has(labelKey)) {
          continue;
        }
        const label = new Text({ text: this.formatScaleTickLabel(date, unit, scaleStartMs), style });
        label.rotation = -Math.PI / 2;
        label.x = screenX + 6;
        label.y = scaleHeight - 4;
        this.timelineTextContainer.addChild(label);
        usedLabelPositions.add(labelKey);
        lastLabelX = screenX;
      }
    }
  }

  private getVisibleTimelineRange(scaleStartMs: number, scaleEndMs: number): { startMs: number; endMs: number } {
    if (!this.timelineApp) return { startMs: scaleStartMs, endMs: scaleEndMs };
    const leftWorld = this.screenToWorld(0, 0).x;
    const rightWorld = this.screenToWorld(this.timelineApp.screen.width, 0).x;
    const visibleStart = scaleStartMs + leftWorld * 1000;
    const visibleEnd = scaleStartMs + rightWorld * 1000;
    return {
      startMs: Math.max(scaleStartMs, visibleStart),
      endMs: Math.min(scaleEndMs, visibleEnd),
    };
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.timelineViewportCenter.x - this.timelineViewOffset.x) / this.timelineScale,
      y: (screenY - this.timelineViewportCenter.y - this.timelineViewOffset.y) / this.timelineScale,
    };
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.timelineScale + this.timelineViewportCenter.x + this.timelineViewOffset.x,
      y: worldY * this.timelineScale + this.timelineViewportCenter.y + this.timelineViewOffset.y,
    };
  }

  private pickScaleUnits(pxPerSecond: number): { major: ScaleUnit; minor: ScaleUnit | null } {
    // IMPORTANT: Keep this array ordered from smallest to largest unit.
    // The selection logic relies on this ordering when choosing major/minor units.
    const units: Array<{ unit: ScaleUnit; seconds: number }> = [
      { unit: 'minute', seconds: 60 },
      { unit: 'tenMinute', seconds: 10 * 60 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'day', seconds: 24 * 3600 },
      { unit: 'month', seconds: 30 * 24 * 3600 },
      { unit: 'year', seconds: 365.25 * 24 * 3600 },
      { unit: 'decade', seconds: 10 * 365.25 * 24 * 3600 },
    ];

    const majorMinPx = 70;
    const minorMinPx = 40;

    let major = units[0].unit;
    for (const entry of units) {
      if (pxPerSecond * entry.seconds >= majorMinPx) {
        major = entry.unit;
        break;
      }
    }

    const majorIndex = units.findIndex(entry => entry.unit === major);
    let minor: ScaleUnit | null = null;
    for (let i = majorIndex - 1; i >= 0; i -= 1) {
      if (pxPerSecond * units[i].seconds >= minorMinPx) {
        minor = units[i].unit;
        break;
      }
    }

    return { major, minor };
  }

  private alignDateToUnit(date: Date, unit: ScaleUnit): Date {
    const aligned = new Date(date.getTime());
    aligned.setUTCMilliseconds(0);
    aligned.setUTCSeconds(0);
    if (unit === 'minute') {
      return aligned;
    }
    if (unit === 'tenMinute') {
      const minutes = aligned.getUTCMinutes();
      aligned.setUTCMinutes(Math.floor(minutes / 10) * 10);
      return aligned;
    }
    aligned.setUTCMinutes(0);
    if (unit === 'hour') {
      return aligned;
    }
    aligned.setUTCHours(0);
    if (unit === 'day') {
      return aligned;
    }
    aligned.setUTCDate(1);
    if (unit === 'month') {
      return aligned;
    }
    aligned.setUTCMonth(0);
    if (unit === 'year') {
      return aligned;
    }
    const year = aligned.getUTCFullYear();
    aligned.setUTCFullYear(Math.floor(year / 10) * 10);
    return aligned;
  }

  private addUnit(date: Date, unit: ScaleUnit): Date {
    const next = new Date(date.getTime());
    switch (unit) {
      case 'minute':
        next.setUTCMinutes(next.getUTCMinutes() + 1);
        return next;
      case 'tenMinute':
        next.setUTCMinutes(next.getUTCMinutes() + 10);
        return next;
      case 'hour':
        next.setUTCHours(next.getUTCHours() + 1);
        return next;
      case 'day':
        next.setUTCDate(next.getUTCDate() + 1);
        return next;
      case 'month':
        next.setUTCMonth(next.getUTCMonth() + 1);
        return next;
      case 'year':
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        return next;
      case 'decade':
        next.setUTCFullYear(next.getUTCFullYear() + 10);
        return next;
      default:
        return next;
    }
  }

  private formatScaleLabel(date: Date, unit: ScaleUnit): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');

    switch (unit) {
      case 'decade':
        return `${year}s`;
      case 'year':
        return `${year}`;
      case 'month':
        return `${year}-${month}`;
      case 'day':
        return `${month}-${day}`;
      case 'hour':
        return `${hour}:00`;
      case 'tenMinute':
        return `${hour}:${minute}`;
      case 'minute':
        return `${hour}:${minute}`;
      default:
        return `${year}`;
    }
  }

  private formatScaleTickLabel(date: Date, unit: ScaleUnit, scaleStartMs: number): string {
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      return this.formatScaleLabel(date, unit);
    }

    const diffMs = date.getTime() - scaleStartMs;
    const totalMinutes = Math.floor(diffMs / 60000);
    const totalHours = Math.floor(diffMs / 3600000);
    const totalDays = Math.floor(diffMs / (24 * 3600 * 1000));
    const baseDate = new Date(scaleStartMs);
    const yearOffset = date.getUTCFullYear() - baseDate.getUTCFullYear();
    const monthOffset = yearOffset * 12 + (date.getUTCMonth() - baseDate.getUTCMonth());

    const pad2 = (value: number) => String(value).padStart(2, '0');

    switch (unit) {
      case 'minute':
      case 'tenMinute': {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${pad2(hours)}:${pad2(minutes)}`;
      }
      case 'hour': {
        const hours = totalHours;
        return `${pad2(hours)}:00`;
      }
      case 'day': {
        if (this.config.groupBy === 'Week') {
          const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const idx = ((totalDays % 7) + 7) % 7;
          return weekdayLabels[idx] ?? 'Mon';
        }
        return `Day ${totalDays + 1}`;
      }
      case 'month':
        return `Month ${monthOffset + 1}`;
      case 'year':
        return `Year ${yearOffset + 1}`;
      case 'decade':
        return `Decade ${Math.floor(yearOffset / 10) + 1}`;
      default:
        return this.formatScaleLabel(date, unit);
    }
  }

  private getDisplayRangeSeconds(groups: GroupedCommits[]): number {
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      return (this.timelineRange.endMs - this.timelineRange.startMs) / 1000;
    }
    const maxSpanMs = Math.max(...groups.map(group => group.endMs - group.startMs));
    return maxSpanMs / 1000;
  }

  private getScaleRange(groups: GroupedCommits[]): { startMs: number; endMs: number } {
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      return { startMs: this.timelineRange.startMs, endMs: this.timelineRange.endMs };
    }

    const rangeSeconds = this.getDisplayRangeSeconds(groups);
    const baseMs = this.getScaleBaseMs(this.config.groupBy);
    return { startMs: baseMs, endMs: baseMs + rangeSeconds * 1000 };
  }

  private getScaleBaseMs(groupBy: GroupBy): number {
    if (groupBy === 'Week') {
      return Date.UTC(2000, 0, 3);
    }
    return Date.UTC(2000, 0, 1);
  }

  private getGroupedCommits(): GroupedCommits[] {
    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      return [{
        key: 'all',
        startMs: this.timelineRange.startMs,
        endMs: this.timelineRange.endMs,
        commits: this.filteredCommits,
      }];
    }

    const grouped = new Map<string, GroupedCommits>();
    for (const commit of this.filteredCommits) {
      const date = new Date(commit.timestamp * 1000);
      const { key, startMs, endMs } = this.getGroupKeyAndStart(date, this.config.groupBy);
      const existing = grouped.get(key);
      if (existing) {
        existing.commits.push(commit);
      } else {
        grouped.set(key, { key, startMs, endMs, commits: [commit] });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.startMs - b.startMs);
  }

  private getGroupKeyAndStart(date: Date, groupBy: GroupBy): { key: string; startMs: number; endMs: number } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    if (groupBy === 'Year') {
      const start = Date.UTC(year, 0, 1);
      const end = Date.UTC(year + 1, 0, 1);
      return { key: `${year}`, startMs: start, endMs: end };
    }

    if (groupBy === 'Month') {
      const start = Date.UTC(year, month, 1);
      const end = Date.UTC(year, month + 1, 1);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      return { key, startMs: start, endMs: end };
    }

    if (groupBy === 'Week') {
      const dayIndex = (date.getUTCDay() + 6) % 7;
      const startDate = new Date(Date.UTC(year, month, day));
      startDate.setUTCDate(startDate.getUTCDate() - dayIndex);
      const startMs = startDate.getTime();
      const endMs = startMs + 7 * 24 * 3600 * 1000;
      const weekYear = startDate.getUTCFullYear();
      const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
      const weekStart = new Date(firstThursday);
      const weekStartDay = (weekStart.getUTCDay() + 6) % 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStartDay);
      const weekNumber = Math.floor((startMs - weekStart.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
      return { key: `${weekYear}-W${String(weekNumber).padStart(2, '0')}`, startMs, endMs };
    }

    const start = Date.UTC(year, month, day);
    const end = Date.UTC(year, month, day + 1);
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { key, startMs: start, endMs: end };
  }

  private getLineOffsets(count: number): number[] {
    if (count <= 1) return [0];
    const mid = (count - 1) / 2;
    const gap = this.getLineGap();
    return Array.from({ length: count }, (_, idx) => (idx - mid) * gap);
  }

  private getLineGap(): number {
    if (this.config.displayMode === 'Timeline' && this.config.groupBy !== 'None') {
      return this.config.groupGap;
    }
    return this.timelineLineGap;
  }

  private getGroupLabelPadding(grouped: GroupedCommits[]): number {
    const maxLabelLength = Math.max(0, ...grouped.map(group => this.formatGroupLabel(group).length));
    const estimatedLabelWidth = maxLabelLength * 7;
    const badgePaddingX = 16;
    const basePadding = 20;
    return estimatedLabelWidth + badgePaddingX + basePadding;
  }

  private getChangeScalePadding(maxValue: number): number {
    const ticks = [1, 10, 100, 1000, 10000, 100000];
    let maxTick = 1;
    for (const tick of ticks) {
      if (tick > maxValue) break;
      maxTick = tick;
    }
    const estimatedLabelWidth = String(maxTick).length * 7;
    const tickPadding = 18;
    return Math.max(this.timelineChangeScaleRightPadding, estimatedLabelWidth + tickPadding);
  }

  private getChangeScaleLineYs(grouped: GroupedCommits[], lineYs: number[]): number[] {
    if (lineYs.length === 0) return lineYs;
    if (this.config.groupBy === 'None') return lineYs;
    if (!this.lockedCommit) {
      return [];
    }
    const groupIndex = grouped.findIndex(group => (
      group.commits.some(commit => commit.hash === this.lockedCommit?.hash)
    ));
    if (groupIndex < 0) {
      return [];
    }
    return [lineYs[groupIndex] ?? lineYs[0]];
  }

  private drawGroupLabels(grouped: GroupedCommits[], lineYs: number[]) {
    if (!this.timelineGroupLabelContainer || !this.timelineApp) return;
    const timelineGroupLabelContainer = this.timelineGroupLabelContainer;
    timelineGroupLabelContainer.removeChildren().forEach(child => child.destroy());

    if (this.config.displayMode !== 'Timeline' || this.config.groupBy === 'None') {
      return;
    }

    const labelStyle = new TextStyle({ fill: 0xe0e0e0, fontSize: 12 });
    const padding = 10;
    const badgePaddingX = 8;
    const badgePaddingY = 4;

    grouped.forEach((group, index) => {
      const lineY = lineYs[index] ?? 0;
      const labelText = this.formatGroupLabel(group);
      const label = new Text({ text: labelText, style: labelStyle });
      const badgeWidth = label.width + badgePaddingX * 2;
      const badgeHeight = label.height + badgePaddingY * 2;
      const badge = new Graphics();
      badge.roundRect(0, 0, badgeWidth, badgeHeight, 6);
      badge.fill({ color: 0x141414, alpha: 0.8 });
      badge.stroke({ color: 0x3a3a3a, width: 1, alpha: 0.8 });

      const badgeContainer = new Container();
      badgeContainer.x = padding;
      badgeContainer.y = lineY - badgeHeight / 2;
      label.x = badgePaddingX;
      label.y = badgePaddingY;
      badgeContainer.addChild(badge);
      badgeContainer.addChild(label);
      timelineGroupLabelContainer.addChild(badgeContainer);
    });
  }

  private formatGroupLabel(group: GroupedCommits): string {
    const date = new Date(group.startMs);
    if (this.config.groupBy === 'Day') {
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${weekday} ${year}/${month}/${day}`;
    }

    if (this.config.groupBy === 'Week') {
      return this.formatScaleLabel(date, 'day');
    }

    if (this.config.groupBy === 'Month') {
      return this.formatScaleLabel(date, 'month');
    }

    if (this.config.groupBy === 'Year') {
      return this.formatScaleLabel(date, 'year');
    }

    return '';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private bindCheckoutButtons() {
    const buttons = this.timelinePanel.querySelectorAll<HTMLButtonElement>('.checkout-button');
    buttons.forEach(button => {
      button.onclick = () => {
        const command = button.dataset.checkout;
        if (!command) return;
        navigator.clipboard.writeText(command)
          .then(() => {
            showToast(`Copied: ${command}`, { type: 'success' });
          })
          .catch(() => {
            this.copyToClipboardFallback(command);
            showToast(`Copied: ${command}`, { type: 'success' });
          });
      };
    });
  }

  private copyToClipboardFallback(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

new TimelineViewer();
