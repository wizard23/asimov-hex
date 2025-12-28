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
type ScaleUnit = 'decade' | 'year' | 'month' | 'day' | 'hour' | 'minute';
type GroupBy = 'None' | 'Day' | 'Week' | 'Month' | 'Year';

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

  private timelineApp: Application | null = null;
  private timelineGraphics: Graphics | null = null;
  private timelineLineGraphics: Graphics | null = null;
  private timelineChangeGraphics: Graphics | null = null;
  private timelineChangeScaleGraphics: Graphics | null = null;
  private timelineScaleGraphics: Graphics | null = null;
  private timelineHoverGraphics: Graphics | null = null;
  private timelineTextContainer: Container | null = null;
  private timelineChangeTextContainer: Container | null = null;
  private timelineResizeObserver: ResizeObserver | null = null;
  private timelineViewOffset = { x: 0, y: 0 };
  private timelineViewOffsetStart = { x: 0, y: 0 };
  private timelineViewportCenter = { x: 0, y: 0 };
  private timelineScale = 1;
  private timelineScaleBounds = { min: 0.000001, max: 1 };
  private timelineDragging = false;
  private timelineDragStart = { x: 0, y: 0 };
  private timelineCommitPoints: Array<{ commit: Commit; screenX: number; screenY: number }> = [];
  private timelineRange = { startMs: 0, endMs: 0 };
  private timelineInfoContainer: HTMLElement | null = null;
  private hoveredCommit: Commit | null = null;
  private readonly timelineScaleHeight = 50;
  private readonly timelineChangeMaxHeight = 80;
  private readonly timelineChangeScaleRightPadding = 24;
  private readonly timelineLineGap = 28;
  
  private config = {
    startDate: '',
    endDate: '',
    displayMode: 'Timeline' as DisplayMode,
    groupBy: 'Day' as GroupBy,
    searchTerm: '',
    enableDateFilter: false,
  };

  constructor() {
    this.timelinePanel = document.getElementById('timeline-panel')!;
    this.init();
  }

  private async init() {
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
      this.render();
    });

    this.startDateElement = startDateBinding.element;
    this.endDateElement = endDateBinding.element;
    this.groupByElement = groupByBinding.element;
    this.updateDateFilterVisibility();
    this.updateGroupByVisibility();
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
        <div id="timeline-canvas"></div>
        <div id="timeline-info" class="timeline-info-overlay">${this.renderCommitInfo(null)}</div>
      </div>
    `;

    const canvasContainer = document.getElementById('timeline-canvas');
    if (!canvasContainer) return;
    this.timelineInfoContainer = document.getElementById('timeline-info');

    await this.initTimelinePixi(canvasContainer);
    this.updateTimelineData();
    this.resetTimelineView();
    this.drawTimeline();
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

    return this.buildCommitCard(commit);
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
    this.timelineTextContainer = new Container();
    this.timelineChangeTextContainer = new Container();

    this.timelineScaleGraphics.zIndex = 1;
    this.timelineLineGraphics.zIndex = 2;
    this.timelineChangeGraphics.zIndex = 3;
    this.timelineGraphics.zIndex = 4;
    this.timelineHoverGraphics.zIndex = 5;
    this.timelineChangeScaleGraphics.zIndex = 6;
    this.timelineTextContainer.zIndex = 7;
    this.timelineChangeTextContainer.zIndex = 8;

    this.timelineApp.stage.addChild(this.timelineScaleGraphics);
    this.timelineApp.stage.addChild(this.timelineLineGraphics);
    this.timelineApp.stage.addChild(this.timelineChangeGraphics);
    this.timelineApp.stage.addChild(this.timelineGraphics);
    this.timelineApp.stage.addChild(this.timelineHoverGraphics);
    this.timelineApp.stage.addChild(this.timelineChangeScaleGraphics);
    this.timelineApp.stage.addChild(this.timelineTextContainer);
    this.timelineApp.stage.addChild(this.timelineChangeTextContainer);

    this.timelineApp.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerDown(e);
    });
    this.timelineApp.stage.on('pointermove', (e: FederatedPointerEvent) => {
      this.handleTimelinePointerMove(e);
    });
    this.timelineApp.stage.on('pointerup', () => {
      this.handleTimelinePointerUp();
    });
    this.timelineApp.stage.on('pointerupoutside', () => {
      this.handleTimelinePointerUp();
    });

    this.timelineApp.canvas.addEventListener('wheel', this.handleTimelineWheel, { passive: false });
    this.timelineApp.canvas.addEventListener('mousemove', this.handleTimelineMouseMove);
    this.timelineApp.canvas.addEventListener('mouseleave', this.handleTimelineMouseLeave);

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
      this.timelineApp.destroy(true);
      this.timelineApp = null;
    }
    this.timelineGraphics = null;
    this.timelineLineGraphics = null;
    this.timelineChangeGraphics = null;
    this.timelineChangeScaleGraphics = null;
    this.timelineScaleGraphics = null;
    this.timelineHoverGraphics = null;
    this.timelineTextContainer = null;
    this.timelineChangeTextContainer = null;
    this.timelineCommitPoints = [];
    this.timelineInfoContainer = null;
    this.hoveredCommit = null;
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
  }

  private updateTimelineData() {
    this.timelineRange = this.getTimelineRange();
    this.hoveredCommit = null;
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
    const rangeSeconds = this.getDisplayRangeSeconds(this.getGroupedCommits());
    const padding = 60;
    const availableWidth = Math.max(1, this.timelineApp.screen.width - padding * 2);
    const nextScale = rangeSeconds > 0 ? availableWidth / rangeSeconds : 1;
    this.timelineScale = nextScale;
    this.timelineScaleBounds = {
      min: nextScale / 200,
      max: nextScale * 200,
    };
    this.timelineViewOffset = {
      x: padding - this.timelineViewportCenter.x,
      y: this.timelineViewOffset.y,
    };
    this.updateTimelineVerticalOffset();
  }

  private handleTimelinePointerDown(e: FederatedPointerEvent) {
    if (e.button !== 0) return;
    this.timelineDragging = true;
    this.timelineDragStart = { x: e.global.x, y: e.global.y };
    this.timelineViewOffsetStart = { ...this.timelineViewOffset };
  }

  private handleTimelinePointerMove(e: FederatedPointerEvent) {
    if (this.timelineDragging) {
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

  private handleTimelinePointerUp() {
    this.timelineDragging = false;
  }

  private handleTimelineWheel = (e: WheelEvent) => {
    if (!this.timelineApp) return;
    e.preventDefault();

    const rect = this.timelineApp.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(screenX, screenY);
    const direction = Math.sign(e.deltaY);
    const factor = Math.pow(1.08, -direction);
    const nextScale = this.clamp(this.timelineScale * factor, this.timelineScaleBounds.min, this.timelineScaleBounds.max);
    if (nextScale === this.timelineScale) return;

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
    // Keep the last highlighted commit when not hovering any other commit.
  };

  private updateHoverCommit(screenX: number, screenY: number) {
    const radius = 10;
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
    this.timelineInfoContainer.innerHTML = this.renderCommitInfo(this.hoveredCommit);
    if (this.hoveredCommit) {
      this.bindCheckoutButtons();
    }
    this.drawTimeline();
  }

  private drawHoverCommit() {
    if (!this.timelineHoverGraphics) return;
    this.timelineHoverGraphics.clear();
    if (!this.hoveredCommit) return;
    const point = this.timelineCommitPoints.find(candidate => candidate.commit.hash === this.hoveredCommit?.hash);
    if (!point) return;
    this.timelineHoverGraphics.circle(point.screenX, point.screenY, 7);
    this.timelineHoverGraphics.fill({ color: 0xffffff, alpha: 1 });
    this.timelineHoverGraphics.circle(point.screenX, point.screenY, 9);
    this.timelineHoverGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
  }

  private drawTimeline() {
    if (!this.timelineApp || !this.timelineGraphics || !this.timelineScaleGraphics || !this.timelineTextContainer || !this.timelineLineGraphics || !this.timelineChangeGraphics || !this.timelineChangeScaleGraphics || !this.timelineChangeTextContainer) {
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
    this.drawChangeScale(lineYs);
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
    timelineScaleGraphics.moveTo(0, scaleHeight);
    timelineScaleGraphics.lineTo(timelineApp.screen.width, scaleHeight);
    timelineScaleGraphics.stroke({ color: 0x7a7a7a, width: 1, alpha: 0.9 });

    const unitSelection = this.pickScaleUnits(pxPerSecond);
    const majorStyle = new TextStyle({ fill: 0xf0f0f0, fontSize: 15 });
    const minorStyle = new TextStyle({ fill: 0xb0b0b0, fontSize: 13 });

    this.timelineTextContainer.removeChildren().forEach(child => child.destroy());

    const majorLabelSpacing = 60;
    const minorLabelSpacing = 50;
    this.drawScaleUnit(unitSelection.major, true, visibleRange.startMs, visibleRange.endMs, scaleHeight, majorStyle, majorLabelSpacing, scaleRange.startMs);
    if (unitSelection.minor) {
      this.drawScaleUnit(unitSelection.minor, false, visibleRange.startMs, visibleRange.endMs, scaleHeight, minorStyle, minorLabelSpacing, scaleRange.startMs);
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

  private drawChangeScale(lineYs: number[]) {
    if (!this.timelineApp || !this.timelineChangeScaleGraphics || !this.timelineChangeTextContainer) return;
    const timelineApp = this.timelineApp;
    const timelineChangeScaleGraphics = this.timelineChangeScaleGraphics;

    const maxAdded = Math.max(1, ...this.filteredCommits.map(commit => commit.addedLines));
    const maxRemoved = Math.max(1, ...this.filteredCommits.map(commit => commit.removedLines));
    const maxValue = Math.max(maxAdded, maxRemoved, 1);
    const axisX = timelineApp.screen.width - this.timelineChangeScaleRightPadding;
    const height = this.timelineChangeMaxHeight;

    timelineChangeScaleGraphics.clear();
    lineYs.forEach(lineY => {
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
      lineYs.forEach(lineY => {
        timelineChangeScaleGraphics.moveTo(axisX - 6, lineY - offset);
        timelineChangeScaleGraphics.lineTo(axisX, lineY - offset);
        timelineChangeScaleGraphics.moveTo(axisX - 6, lineY + offset);
        timelineChangeScaleGraphics.lineTo(axisX, lineY + offset);
      });
    }
    timelineChangeScaleGraphics.stroke({ color: 0x8a8a8a, width: 1, alpha: 0.9 });

    const labelLineY = lineYs[Math.floor(lineYs.length / 2)] ?? 0;
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
    scaleStartMs: number
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
      const tickColor = isMajor ? 0x777777 : 0x4b4b4b;
      const tickAlpha = isMajor ? 0.9 : 0.7;
      timelineScaleGraphics.moveTo(screenX, 0);
      timelineScaleGraphics.lineTo(screenX, lineHeight);
      timelineScaleGraphics.stroke({
        color: tickColor,
        width: 1,
        alpha: tickAlpha,
      });
      timelineScaleGraphics.rect(screenX - 0.5, 0, 1, lineHeight);
      timelineScaleGraphics.fill({ color: tickColor, alpha: tickAlpha });

      if (screenX - lastLabelX >= minLabelSpacing) {
        const label = new Text({ text: this.formatScaleLabel(date, unit), style });
        label.rotation = -Math.PI / 2;
        label.x = screenX + labelOffset;
        label.y = scaleHeight - 4;
        this.timelineTextContainer.addChild(label);
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
    const units: Array<{ unit: ScaleUnit; seconds: number }> = [
      { unit: 'minute', seconds: 60 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'day', seconds: 24 * 3600 },
      { unit: 'month', seconds: 30 * 24 * 3600 },
      { unit: 'year', seconds: 365.25 * 24 * 3600 },
      { unit: 'decade', seconds: 10 * 365.25 * 24 * 3600 },
    ];

    let major = units[units.length - 1].unit;
    for (const entry of units) {
      if (pxPerSecond * entry.seconds >= 120) {
        major = entry.unit;
        break;
      }
    }

    const majorIndex = units.findIndex(entry => entry.unit === major);
    let minor: ScaleUnit | null = null;
    for (let i = majorIndex - 1; i >= 0; i -= 1) {
      if (pxPerSecond * units[i].seconds >= 60) {
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
      case 'minute':
        return `${hour}:${minute}`;
      default:
        return `${year}`;
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
    return Array.from({ length: count }, (_, idx) => (idx - mid) * this.timelineLineGap);
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
