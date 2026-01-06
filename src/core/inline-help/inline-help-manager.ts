import { renderMarkdown, resolveRelativeHref } from '../markdown/renderer';

type SnapSide = 'left' | 'right' | 'top' | 'bottom' | 'none';

type InlineHelpWindowConfig = {
  id: string;
  title: string;
  markdownUrl: string;
};

type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type StoredWindowState = {
  rect: WindowRect;
  snapSide: SnapSide;
  snapIndex: number;
  minimized: boolean;
  maximized: boolean;
  scrollTop: number;
  markdownUrl: string;
  opacity: number;
};

const STORAGE_PREFIX = 'inline-help-window:';
const SNAP_THRESHOLD = 48;
const SNAP_SIDE_RATIO = 0.4;

export class InlineHelpWindowManager {
  private root: HTMLElement;
  private windows = new Map<string, InlineHelpWindow>();
  private activeWindow: InlineHelpWindow | null = null;
  private zIndexCounter = 2000;
  private snapCounters: Record<Exclude<SnapSide, 'none'>, number> = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };

  constructor() {
    this.root = ensureRoot();
    ensureStyles();
    window.addEventListener('resize', () => this.layoutSnappedWindows());
    document.addEventListener('keydown', (event) => this.handleShortcuts(event));
  }

  openWindow(config: InlineHelpWindowConfig): void {
    const existing = this.windows.get(config.id);
    if (existing) {
      existing.setActive();
      return;
    }
    const windowInstance = new InlineHelpWindow(this, config);
    this.windows.set(config.id, windowInstance);
    this.root.appendChild(windowInstance.element);
    windowInstance.restoreState();
    windowInstance.loadMarkdown();
    windowInstance.setActive();
    this.layoutSnappedWindows();
  }

  closeWindow(id: string): void {
    const existing = this.windows.get(id);
    if (!existing) return;
    if (this.activeWindow === existing) {
      this.activeWindow = null;
    }
    existing.destroy();
    this.windows.delete(id);
    this.layoutSnappedWindows();
  }

  setActiveWindow(windowInstance: InlineHelpWindow): void {
    this.activeWindow = windowInstance;
    this.zIndexCounter += 1;
    windowInstance.element.style.zIndex = String(this.zIndexCounter);
  }

  layoutSnappedWindows(): void {
    const groups: Record<Exclude<SnapSide, 'none'>, InlineHelpWindow[]> = {
      left: [],
      right: [],
      top: [],
      bottom: [],
    };
    for (const windowInstance of this.windows.values()) {
      if (windowInstance.snapSide === 'none') continue;
      groups[windowInstance.snapSide].push(windowInstance);
    }

    (Object.keys(groups) as Array<Exclude<SnapSide, 'none'>>).forEach((side) => {
      const windows = groups[side].sort((a, b) => a.snapIndex - b.snapIndex);
      if (windows.length === 0) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (side === 'left' || side === 'right') {
        const width = Math.max(260, Math.round(viewport.width * SNAP_SIDE_RATIO));
        const height = Math.max(120, viewport.height / windows.length);
        windows.forEach((win, idx) => {
          const x = side === 'left' ? 0 : viewport.width - width;
          const y = Math.round(idx * height);
          win.applySnapRect({ x, y, width, height });
        });
        return;
      }

      const height = Math.max(180, Math.round(viewport.height * SNAP_SIDE_RATIO));
      const width = Math.max(220, viewport.width / windows.length);
      windows.forEach((win, idx) => {
        const x = Math.round(idx * width);
        const y = side === 'top' ? 0 : viewport.height - height;
        win.applySnapRect({ x, y, width, height });
      });
    });
  }

  getNextSnapIndex(side: Exclude<SnapSide, 'none'>): number {
    this.snapCounters[side] += 1;
    return this.snapCounters[side];
  }

  syncSnapIndex(side: Exclude<SnapSide, 'none'>, index: number): void {
    if (index > this.snapCounters[side]) {
      this.snapCounters[side] = index;
    }
  }

  findSnappedWindowAt(x: number, y: number, ignoreId: string): InlineHelpWindow | null {
    for (const windowInstance of this.windows.values()) {
      if (windowInstance.id === ignoreId) continue;
      if (windowInstance.snapSide === 'none') continue;
      const rect = windowInstance.element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return windowInstance;
      }
    }
    return null;
  }

  handleShortcuts(event: KeyboardEvent): void {
    if (!event.ctrlKey || event.defaultPrevented) return;
    if (isTextInputActive()) return;
    const windowInstance = this.activeWindow;
    if (!windowInstance) return;
    const key = event.key.toLowerCase();
    if (key === 'q') {
      event.preventDefault();
      windowInstance.close();
      return;
    }
    if (key === 'm') {
      event.preventDefault();
      windowInstance.toggleMinimize();
      return;
    }
    if (key === '1') {
      event.preventDefault();
      windowInstance.snapTo('left');
      return;
    }
    if (key === '2') {
      event.preventDefault();
      windowInstance.snapTo('right');
      return;
    }
    if (key === '3') {
      event.preventDefault();
      windowInstance.snapTo('top');
      return;
    }
    if (key === '4') {
      event.preventDefault();
      windowInstance.snapTo('bottom');
    }
  }
}

class InlineHelpWindow {
  readonly id: string;
  readonly element: HTMLDivElement;
  readonly contentScroll: HTMLDivElement;
  readonly titleEl: HTMLSpanElement;
  readonly opacityControl: HTMLInputElement;
  private manager: InlineHelpWindowManager;
  private header: HTMLDivElement;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private rect: WindowRect;
  private restoreRect: WindowRect | null = null;
  private minimizedRestoreRect: WindowRect | null = null;
  private opacity = 1;
  private markdownUrl: string;
  private scrollSaveTimer: number | null = null;
  private isResizing = false;
  private resizeDir: ResizeDirection | null = null;
  private resizeStart: { x: number; y: number; rect: WindowRect } | null = null;
  snapSide: SnapSide = 'none';
  snapIndex = 0;
  minimized = false;
  maximized = false;

  constructor(manager: InlineHelpWindowManager, config: InlineHelpWindowConfig) {
    this.manager = manager;
    this.id = config.id;
    this.markdownUrl = config.markdownUrl;
    this.rect = {
      x: 120,
      y: 120,
      width: 460,
      height: 360,
    };

    this.element = document.createElement('div');
    this.element.className = 'inline-help-window';
    this.element.dataset.inlineHelpId = this.id;
    this.element.style.zIndex = '2000';

    this.header = document.createElement('div');
    this.header.className = 'inline-help-header';
    this.header.addEventListener('mousedown', (event) => this.handleDragStart(event));
    this.header.addEventListener('dblclick', () => this.toggleMaximize());

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'inline-help-title';
    this.titleEl.textContent = config.title;

    const actions = document.createElement('div');
    actions.className = 'inline-help-actions';

    this.opacityControl = document.createElement('input');
    this.opacityControl.type = 'range';
    this.opacityControl.min = '20';
    this.opacityControl.max = '100';
    this.opacityControl.step = '5';
    this.opacityControl.value = String(this.opacity * 100);
    this.opacityControl.className = 'inline-help-opacity';
    this.opacityControl.title = 'Window Opacity';
    this.opacityControl.addEventListener('input', () => {
      this.setOpacity(Number(this.opacityControl.value) / 100);
    });

    const minimizeButton = this.buildHeaderButton('Minimize', '_', () => this.toggleMinimize());
    const maximizeButton = this.buildHeaderButton('Maximize', '[]', () => this.toggleMaximize());
    const closeButton = this.buildHeaderButton('Close', 'x', () => this.close());

    actions.appendChild(this.opacityControl);
    actions.appendChild(minimizeButton);
    actions.appendChild(maximizeButton);
    actions.appendChild(closeButton);

    this.header.appendChild(this.titleEl);
    this.header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'inline-help-body';

    this.contentScroll = document.createElement('div');
    this.contentScroll.className = 'inline-help-content';
    this.contentScroll.addEventListener('scroll', () => this.queueScrollSave());

    body.appendChild(this.contentScroll);

    this.element.appendChild(this.header);
    this.element.appendChild(body);
    this.addResizeHandles();

    this.element.addEventListener('mousedown', () => this.setActive());
    const resizeObserver = new ResizeObserver(() => this.handleResize());
    resizeObserver.observe(this.element);
  }

  setActive(): void {
    this.manager.setActiveWindow(this);
  }

  close(): void {
    this.manager.closeWindow(this.id);
  }

  destroy(): void {
    this.element.remove();
  }

  toggleMinimize(): void {
    if (!this.minimized) {
      this.minimized = true;
      this.element.classList.add('is-minimized');
      if (this.snapSide === 'none' && !this.maximized) {
        this.minimizedRestoreRect = { ...this.rect };
        const headerHeight = Math.max(36, this.header.offsetHeight);
        this.applyRect({
          x: this.rect.x,
          y: this.rect.y,
          width: this.rect.width,
          height: headerHeight,
        });
      }
      this.persistState();
      return;
    }
    this.minimized = false;
    this.element.classList.remove('is-minimized');
    if (this.minimizedRestoreRect) {
      this.applyRect(this.minimizedRestoreRect);
      this.minimizedRestoreRect = null;
    }
    this.persistState();
  }

  setOpacity(value: number): void {
    const clamped = Math.min(1, Math.max(0.2, value));
    this.opacity = clamped;
    this.element.style.opacity = String(clamped);
    this.persistState();
  }

  toggleMaximize(): void {
    if (!this.maximized) {
      this.restoreRect = { ...this.rect };
      this.snapSide = 'none';
      this.snapIndex = 0;
      this.minimized = false;
      this.element.classList.remove('is-minimized');
      this.maximized = true;
      this.element.classList.add('is-maximized');
      this.applyRect({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
      this.persistState();
      return;
    }
    this.maximized = false;
    this.element.classList.remove('is-maximized');
    if (this.restoreRect) {
      this.rect = { ...this.restoreRect };
      this.restoreRect = null;
      this.applyRect(this.rect);
    }
    this.persistState();
  }

  snapTo(side: Exclude<SnapSide, 'none'>): void {
    this.maximized = false;
    this.element.classList.remove('is-maximized');
    this.snapSide = side;
    this.snapIndex = this.manager.getNextSnapIndex(side);
    this.manager.layoutSnappedWindows();
    this.persistState();
  }

  applySnapRect(rect: WindowRect): void {
    if (this.maximized) return;
    this.applyRect(rect);
  }

  loadMarkdown(): void {
    const resolved = new URL(this.markdownUrl, window.location.href);
    fetch(resolved.href)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((text) => {
        renderMarkdown(text, this.contentScroll, {
          baseUrl: resolved.href,
          resolveHref: resolveRelativeHref,
          resolveImageSrc: resolveRelativeHref,
          onLinkCreated: (link, rawHref) => this.decorateLink(link, rawHref),
        });
        this.restoreScroll();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.contentScroll.textContent = `Failed to load help content: ${message}`;
      });
  }

  decorateLink(link: HTMLAnchorElement, rawHref: string): void {
    if (!rawHref || rawHref.startsWith('#')) return;
    const resolved = new URL(link.href, window.location.href);
    if (resolved.origin !== window.location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return;
    }
    if (resolved.pathname.endsWith('.md')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.markdownUrl = resolved.href;
        this.persistState();
        this.loadMarkdown();
      });
    }
  }

  restoreState(): void {
    const stored = getStoredState(this.id);
    if (!stored) {
      this.applyRect(this.rect);
      return;
    }

    this.rect = stored.rect ?? this.rect;
    this.snapSide = stored.snapSide ?? 'none';
    this.snapIndex = stored.snapIndex ?? 0;
    this.minimized = stored.minimized ?? false;
    this.maximized = stored.maximized ?? false;
    this.markdownUrl = stored.markdownUrl ?? this.markdownUrl;
    this.opacity = typeof stored.opacity === 'number' ? stored.opacity : this.opacity;
    this.element.style.opacity = String(this.opacity);
    this.opacityControl.value = String(Math.round(this.opacity * 100));
    this.element.classList.toggle('is-minimized', this.minimized);

    if (this.maximized) {
      this.element.classList.add('is-maximized');
      this.applyRect({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
      return;
    }

    if (this.snapSide === 'none') {
      this.applyRect(this.rect);
      if (this.minimized) {
        this.minimizedRestoreRect = { ...this.rect };
        const headerHeight = Math.max(36, this.header.offsetHeight);
        this.applyRect({
          x: this.rect.x,
          y: this.rect.y,
          width: this.rect.width,
          height: headerHeight,
        });
      }
      return;
    }
    this.manager.syncSnapIndex(this.snapSide, this.snapIndex);
    this.manager.layoutSnappedWindows();
  }

  restoreScroll(): void {
    const stored = getStoredState(this.id);
    if (!stored) return;
    this.contentScroll.scrollTop = stored.scrollTop ?? 0;
  }

  handleDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    if ((event.target as HTMLElement).closest('.inline-help-opacity')) return;
    if ((event.target as HTMLElement).closest('.inline-help-resize-handle')) return;
    if (this.maximized) {
      this.toggleMaximize();
    }
    this.snapSide = 'none';
    this.snapIndex = 0;
    this.manager.layoutSnappedWindows();
    this.isDragging = true;
    this.setActive();
    const rect = this.element.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
    document.body.style.userSelect = 'none';
  }

  handleDragMove = (event: MouseEvent): void => {
    if (!this.isDragging) return;
    const nextX = event.clientX - this.dragOffset.x;
    const nextY = event.clientY - this.dragOffset.y;
    this.applyRect({
      x: nextX,
      y: nextY,
      width: this.rect.width,
      height: this.rect.height,
    }, false);
  };

  handleDragEnd = (event: MouseEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.body.style.userSelect = '';

    const snapTarget = this.manager.findSnappedWindowAt(event.clientX, event.clientY, this.id);
    if (snapTarget && snapTarget.snapSide !== 'none') {
      this.snapTo(snapTarget.snapSide);
      return;
    }

    const nextSide = getSnapSideForPoint(event.clientX, event.clientY);
    if (nextSide !== 'none') {
      this.snapTo(nextSide);
      return;
    }

    this.snapSide = 'none';
    this.persistState();
  };

  handleResizeStart(event: MouseEvent, dir: ResizeDirection): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.maximized) return;
    this.isResizing = true;
    this.resizeDir = dir;
    this.resizeStart = {
      x: event.clientX,
      y: event.clientY,
      rect: { ...this.rect },
    };
    document.addEventListener('mousemove', this.handleResizeMove);
    document.addEventListener('mouseup', this.handleResizeEnd);
    document.body.style.userSelect = 'none';
  }

  handleResizeMove = (event: MouseEvent): void => {
    if (!this.isResizing || !this.resizeDir || !this.resizeStart) return;
    const dx = event.clientX - this.resizeStart.x;
    const dy = event.clientY - this.resizeStart.y;
    const start = this.resizeStart.rect;
    const nextRect = { ...start };

    if (this.resizeDir.includes('e')) {
      nextRect.width = start.width + dx;
    }
    if (this.resizeDir.includes('s')) {
      nextRect.height = start.height + dy;
    }
    if (this.resizeDir.includes('w')) {
      nextRect.width = start.width - dx;
      nextRect.x = start.x + dx;
    }
    if (this.resizeDir.includes('n')) {
      nextRect.height = start.height - dy;
      nextRect.y = start.y + dy;
    }

    this.applyRect(nextRect, false);
  };

  handleResizeEnd = (): void => {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.resizeDir = null;
    this.resizeStart = null;
    document.removeEventListener('mousemove', this.handleResizeMove);
    document.removeEventListener('mouseup', this.handleResizeEnd);
    document.body.style.userSelect = '';
    this.persistState();
  };

  handleResize(): void {
    if (this.snapSide !== 'none' || this.maximized) return;
    const rect = this.element.getBoundingClientRect();
    this.rect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
    this.persistState();
  }

  applyRect(rect: WindowRect, persist = true): void {
    const clamped = clampRect(rect);
    this.rect = clamped;
    this.element.style.left = `${clamped.x}px`;
    this.element.style.top = `${clamped.y}px`;
    this.element.style.width = `${clamped.width}px`;
    this.element.style.height = `${clamped.height}px`;
    if (persist) {
      this.persistState();
    }
  }

  queueScrollSave(): void {
    if (this.scrollSaveTimer !== null) {
      window.clearTimeout(this.scrollSaveTimer);
    }
    this.scrollSaveTimer = window.setTimeout(() => {
      this.persistState();
    }, 150);
  }

  persistState(): void {
    const rect = this.minimized && this.minimizedRestoreRect
      ? this.minimizedRestoreRect
      : toWindowRect(this.element.getBoundingClientRect());
    const stored: StoredWindowState = {
      rect,
      snapSide: this.snapSide,
      snapIndex: this.snapIndex,
      minimized: this.minimized,
      maximized: this.maximized,
      scrollTop: this.contentScroll.scrollTop,
      markdownUrl: this.markdownUrl,
      opacity: this.opacity,
    };
    saveStoredState(this.id, stored);
  }

  private addResizeHandles(): void {
    const directions: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    directions.forEach((dir) => {
      const handle = document.createElement('div');
      handle.className = `inline-help-resize-handle inline-help-resize-${dir}`;
      handle.addEventListener('mousedown', (event) => this.handleResizeStart(event, dir));
      this.element.appendChild(handle);
    });
  }

  private buildHeaderButton(title: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }
}

function ensureRoot(): HTMLElement {
  const existing = document.getElementById('inline-help-root');
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = 'inline-help-root';
  root.className = 'inline-help-root';
  document.body.appendChild(root);
  return root;
}

function ensureStyles(): void {
  if (document.getElementById('inline-help-styles')) return;
  const style = document.createElement('style');
  style.id = 'inline-help-styles';
  style.textContent = `
    .inline-help-root {
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: inherit;
    }
    .inline-help-window {
      position: absolute;
      display: flex;
      flex-direction: column;
      background: rgba(18, 18, 18, 0.96);
      color: #e6e6e6;
      border: 1px solid #3f3f3f;
      border-radius: 10px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      pointer-events: auto;
      resize: both;
      overflow: hidden;
      min-width: 260px;
      min-height: 180px;
    }
    .inline-help-window.is-minimized {
      resize: none;
      min-height: unset;
    }
    .inline-help-window.is-minimized .inline-help-body {
      display: none;
    }
    .inline-help-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: rgba(28, 28, 28, 0.95);
      border-bottom: 1px solid #3a3a3a;
      cursor: move;
      user-select: none;
    }
    .inline-help-title {
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.02em;
      color: #f1f1f1;
    }
    .inline-help-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .inline-help-opacity {
      width: 90px;
      accent-color: #79b6ff;
    }
    .inline-help-actions button {
      appearance: none;
      border: 1px solid #505050;
      background: rgba(40, 40, 40, 0.8);
      color: #e0e0e0;
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .inline-help-actions button:hover {
      background: rgba(64, 64, 64, 0.85);
    }
    .inline-help-body {
      flex: 1;
      overflow: hidden;
      background: rgba(15, 15, 15, 0.9);
    }
    .inline-help-content {
      height: 100%;
      overflow: auto;
      padding: 16px 18px 20px;
      line-height: 1.6;
      font-size: 14px;
    }
    .inline-help-content h1,
    .inline-help-content h2,
    .inline-help-content h3,
    .inline-help-content h4,
    .inline-help-content h5,
    .inline-help-content h6 {
      margin: 16px 0 8px;
      color: #ffffff;
    }
    .inline-help-content p {
      margin: 10px 0;
    }
    .inline-help-content a {
      color: #79b6ff;
      text-decoration: none;
    }
    .inline-help-content a:hover {
      text-decoration: underline;
    }
    .inline-help-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      background: #101010;
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px solid #333;
      color: #eaeaea;
    }
    .inline-help-content pre {
      background: #0d0d0d;
      border: 1px solid #333;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      margin: 14px 0;
    }
    .inline-help-content pre code {
      background: none;
      padding: 0;
      border: none;
    }
    .inline-help-content blockquote {
      border-left: 3px solid #4a9eff;
      padding-left: 12px;
      color: #cfcfcf;
      margin: 12px 0;
    }
    .inline-help-content ul,
    .inline-help-content ol {
      margin: 10px 0 10px 24px;
    }
    .inline-help-content hr {
      border: none;
      border-top: 1px solid #444;
      margin: 18px 0;
    }
    .inline-help-content img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #2f2f2f;
      margin: 8px 0;
    }
    .inline-help-resize-handle {
      position: absolute;
      width: 12px;
      height: 12px;
      z-index: 2;
    }
    .inline-help-resize-n {
      top: -6px;
      left: 12px;
      right: 12px;
      height: 12px;
      width: auto;
      cursor: ns-resize;
    }
    .inline-help-resize-s {
      bottom: -6px;
      left: 12px;
      right: 12px;
      height: 12px;
      width: auto;
      cursor: ns-resize;
    }
    .inline-help-resize-e {
      right: -6px;
      top: 12px;
      bottom: 12px;
      width: 12px;
      height: auto;
      cursor: ew-resize;
    }
    .inline-help-resize-w {
      left: -6px;
      top: 12px;
      bottom: 12px;
      width: 12px;
      height: auto;
      cursor: ew-resize;
    }
    .inline-help-resize-ne {
      top: -6px;
      right: -6px;
      cursor: nesw-resize;
    }
    .inline-help-resize-nw {
      top: -6px;
      left: -6px;
      cursor: nwse-resize;
    }
    .inline-help-resize-se {
      bottom: -6px;
      right: -6px;
      cursor: nwse-resize;
    }
    .inline-help-resize-sw {
      bottom: -6px;
      left: -6px;
      cursor: nesw-resize;
    }
  `;
  document.head.appendChild(style);
}

function getStoredState(id: string): StoredWindowState | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWindowState;
  } catch {
    return null;
  }
}

function saveStoredState(id: string, state: StoredWindowState): void {
  localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(state));
}

function clampRect(rect: WindowRect): WindowRect {
  const maxWidth = Math.max(260, window.innerWidth);
  const maxHeight = Math.max(180, window.innerHeight);
  const width = Math.min(rect.width, maxWidth);
  const height = Math.min(rect.height, maxHeight);
  const x = Math.min(Math.max(0, rect.x), window.innerWidth - width);
  const y = Math.min(Math.max(0, rect.y), window.innerHeight - height);
  return { x, y, width, height };
}

function toWindowRect(rect: DOMRect): WindowRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function getSnapSideForPoint(x: number, y: number): SnapSide {
  if (x <= SNAP_THRESHOLD) return 'left';
  if (x >= window.innerWidth - SNAP_THRESHOLD) return 'right';
  if (y <= SNAP_THRESHOLD) return 'top';
  if (y >= window.innerHeight - SNAP_THRESHOLD) return 'bottom';
  return 'none';
}

function isTextInputActive(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active instanceof HTMLInputElement) return true;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLSelectElement) return true;
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  return false;
}
