import { Pane } from 'tweakpane';
import type { ProjectStatistics, RepoSizeMetrics } from './types';

type DateTimeTimeZone = 'local' | 'utc';

class StatisticsViewer {
  private pane!: Pane;
  private selectedFile: string = '';
  private availableFiles: string[] = [];
  private statisticsPanel: HTMLElement;
  private config = {
    selectedFile: '',
    dateTimeTimeZone: 'local' as DateTimeTimeZone,
  };
  private currentStatistics: ProjectStatistics | null = null;
  private allFilesSortKey: AllFilesSortKey = 'path';

  constructor() {
    this.statisticsPanel = document.getElementById('statistics-panel')!;
    this.init();
  }

  private async init() {
    await this.loadAvailableFiles();
    this.initTweakpane();
  }

  private async loadAvailableFiles() {
    try {
      const indexResponse = await fetch('/project-statistics/generated/index.json');
      if (!indexResponse.ok) {
        throw new Error(`Failed to fetch index.json (status: ${indexResponse.status})`);
      }
      const index = (await indexResponse.json()) as { files?: string[] };
      this.availableFiles = index.files || [];

      if (this.availableFiles.length > 0) {
        this.selectedFile = this.availableFiles[0];
      } else {
        // Handle case where index.json is empty
        this.statisticsPanel.innerHTML = `
          <div class="no-data">
            <p>No statistics files found.</p>
            <p>Please run the generation script to create statistics.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading available statistics files:', error);
      this.availableFiles = [];
      this.statisticsPanel.innerHTML = `
        <div class="no-data">
          <p>Could not load statistics index file (index.json).</p>
          <p>Please ensure you have run the project statistics generation script.</p>
          <p style="font-family: monospace; font-size: 12px; color: #888; margin-top: 10px;">
            ${error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      `;
    }
  }

  private initTweakpane() {
    const container = document.getElementById('tweakpane-container');
    if (!container) return;

    this.pane = new Pane({ 
      title: 'Statistics Controls',
      container: container
    });

    this.config.selectedFile = this.selectedFile;

    // Create options object for dropdown
    const options: Record<string, string> = {};
    this.availableFiles.forEach(file => {
      // Use filename as both key and value, but display a nicer format
      const displayName = formatTimestampFilename(file);
      options[displayName] = file;
    });

    this.pane.addBinding(this.config, 'selectedFile', {
      options: options,
      label: 'Statistics File',
    }).on('change', (ev) => {
      this.selectedFile = ev.value;
      this.loadStatistics(this.selectedFile);
    });

    this.pane.addBinding(this.config, 'dateTimeTimeZone', {
      options: {
        'Local Time': 'local',
        'UTC': 'utc',
      },
      label: 'Timestamp Format',
    }).on('change', () => {
      if (this.currentStatistics) {
        this.displayStatistics(this.currentStatistics);
        return;
      }

      if (this.selectedFile) {
        this.loadStatistics(this.selectedFile);
      }
    });

    // Load initial file
    if (this.selectedFile) {
      this.loadStatistics(this.selectedFile);
    }
  }

  private async loadStatistics(filename: string) {
    try {
      const response = await fetch(`/project-statistics/generated/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
      }

      const data = (await response.json()) as ProjectStatistics;
      this.currentStatistics = data;
      this.displayStatistics(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
      this.statisticsPanel.innerHTML = `
        <div class="no-data">
          <p>Error loading statistics file: ${filename}</p>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  private displayStatistics(data: ProjectStatistics) {
    const timestamp = this.config.dateTimeTimeZone === 'utc'
      ? formatIsoTimestampUtc(data.timestamp)
      : formatIsoTimestampLocal(data.timestamp);

    const groupedFiles = groupFilesByType(data.includedFiles);
    const allFilesRows = sortAllFiles(data.includedFiles, this.allFilesSortKey);

    this.statisticsPanel.innerHTML = `
      <h2>Project Statistics — ${timestamp}</h2>
      
      <div class="stat-section">
        <h3>Overview</h3>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-item-label">Total Files</div>
            <div class="stat-item-value">${data.totals.files.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Total Lines</div>
            <div class="stat-item-value">${data.totals.lines.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Total Words</div>
            <div class="stat-item-value">${data.totals.words.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Total Bytes</div>
            <div class="stat-item-value">${data.totals.bytes !== undefined ? data.totals.bytes.toLocaleString() : 'unknown'}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Total Commit Count</div>
            <div class="stat-item-value">${formatOptionalNumber(data.repoSizeMetrics?.intrinsic.totalCommitCount)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Tracked File Count</div>
            <div class="stat-item-value">${formatOptionalNumber(data.repoSizeMetrics?.intrinsic.trackedFileCount)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Tracked Dir Count</div>
            <div class="stat-item-value">${formatOptionalNumber(data.repoSizeMetrics?.intrinsic.trackedDirCount)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Tracked Content Bytes</div>
            <div class="stat-item-value">${formatOptionalNumber(data.repoSizeMetrics?.intrinsic.trackedContentBytes)}</div>
          </div>
        </div>
      </div>

      <div class="stat-section">
        <h3>File Types Breakdown</h3>
        <table class="file-type-table">
          <thead>
            <tr>
              <th>File Type</th>
              <th class="num">Count</th>
              <th class="num">Lines</th>
              <th class="num">Words</th>
              <th class="num">Bytes</th>
            </tr>
          </thead>
          <tbody>
            ${data.fileTypes.map(ft => `
              <tr>
                <td class="file-type">${ft.fileType || '(no extension)'}</td>
                <td class="num">${ft.count.toLocaleString()}</td>
                <td class="num">${ft.totalLines.toLocaleString()}</td>
                <td class="num">${ft.totalWords.toLocaleString()}</td>
                <td class="num">${ft.totalBytes !== undefined ? ft.totalBytes.toLocaleString() : 'unknown'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="stats-subtitle">Included Files by Type</div>
        ${renderIncludedFilesByType(groupedFiles)}
      </div>

      <div class="stat-section">
        <h3>All Files</h3>
        ${renderAllFilesTable(allFilesRows, this.allFilesSortKey)}
      </div>

      <div class="stat-section">
        <h3>Excluded Paths</h3>
        <div>
          <div class="stat-item-label">Excluded Folders</div>
          ${renderExcludedList(data.excludedFolders)}
        </div>
        <div style="margin-top: 16px;">
          <div class="stat-item-label">Excluded Files</div>
          ${renderExcludedList(data.excludedFiles)}
        </div>
      </div>

      <div class="stat-section">
        <h3>Repo Statistics</h3>
        ${renderRepoSizeMetrics(data.repoSizeMetrics)}
      </div>
    `;

    const allFilesTable = this.statisticsPanel.querySelector('[data-all-files-table="true"]');
    if (allFilesTable) {
      allFilesTable.querySelectorAll('[data-sort-key]').forEach(header => {
        header.addEventListener('click', () => {
          const key = header.getAttribute('data-sort-key') as AllFilesSortKey | null;
          if (!key) {
            return;
          }
          this.allFilesSortKey = key;
          if (this.currentStatistics) {
            this.displayStatistics(this.currentStatistics);
          }
        });
      });
    }
  }
}

// Initialize the statistics viewer when the page loads
new StatisticsViewer();

function formatTimestampFilename(filename: string): string {
  // Expected: YYYY-MM-DD_HH-MM(.ext)
  const match = filename.match(
    /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(?:\.\w+)?$/
  );

  if (!match) {
    throw new Error(`Invalid timestamp filename: ${filename}`);
  }

  const [, year, month, day, hour, minute] = match;

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function formatIsoTimestampUtc(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO timestamp: ${iso}`);
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("/") + " " +
    [
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
    ].join(":");
}

export function formatIsoTimestampLocal(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO timestamp: ${iso}`);
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("/") + " " +
    [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(":");
}

function renderExcludedList(items?: string[]): string {
  if (!items) {
    return `<div class="excluded-empty">unknown</div>`;
  }

  if (items.length === 0) {
    return `<div class="excluded-empty">(none)</div>`;
  }

  return `
    <ul class="excluded-list">
      ${items.map(item => `<li>${item}</li>`).join('')}
    </ul>
  `;
}

function renderIncludedFilesByType(items?: Map<string, IncludedFileStats[]>): string {
  if (!items) {
    return `<div class="excluded-empty">unknown</div>`;
  }

  if (items.size === 0) {
    return `<div class="excluded-empty">(none)</div>`;
  }

  const sections = Array.from(items.entries()).sort(([a], [b]) => a.localeCompare(b));

  return `
    ${sections.map(([fileType, files]) => `
      <details class="included-files-group">
        <summary>${escapeHtml(fileType || '(no extension)')} (${files.length.toLocaleString()})</summary>
        <ul class="excluded-list">
          ${files.map(item => `<li>${escapeHtml(item.path)} (${item.lines.toLocaleString()} lines, ${item.words.toLocaleString()} words, ${item.bytes.toLocaleString()} bytes)</li>`).join('')}
        </ul>
      </details>
    `).join('')}
  `;
}

function renderRepoSizeMetrics(metrics?: RepoSizeMetrics): string {
  if (!metrics) {
    return `<div class="excluded-empty">unknown</div>`;
  }

  return `
    <div class="stats-subtitle">Metadata</div>
    ${renderStatsTable([
      ['Format Version', metrics.version],
      ['Timestamp (UTC)', metrics.timestamp],
      ['Head Commit', metrics.repo.headCommit],
      ['Head Branch', metrics.repo.headBranch],
    ])}

    <div class="stats-subtitle">Intrinsic</div>
    ${renderStatsTable([
      ['Commit Count', metrics.intrinsic.commitCount],
      ['Total Commit Count', metrics.intrinsic.totalCommitCount],
      ['Tracked File Count', metrics.intrinsic.trackedFileCount],
      ['Tracked Dir Count', metrics.intrinsic.trackedDirCount],
      ['Tracked Content Bytes', metrics.intrinsic.trackedContentBytes],
    ])}

    <div class="stats-subtitle">Git Objects</div>
    ${renderStatsTable([
      ['Loose Object Count', metrics.gitObjects.looseObjectCount],
      ['Loose Object Size (KiB)', metrics.gitObjects.looseObjectSizeKiB],
      ['Packed Object Count', metrics.gitObjects.packedObjectCount],
      ['Packfile Count', metrics.gitObjects.packfileCount],
      ['Packfile Size (KiB)', metrics.gitObjects.packfileSizeKiB],
      ['Prune Packable Size (KiB)', metrics.gitObjects.prunePackableSizeKiB],
      ['Garbage Object Count', metrics.gitObjects.garbageObjectCount],
      ['Garbage Size (KiB)', metrics.gitObjects.garbageSizeKiB],
    ])}

    <div class="stats-subtitle">Disk Usage</div>
    ${renderStatsTable([
      ['Worktree Bytes', metrics.diskUsage.worktreeBytes],
      ['Worktree Excluding Git Bytes', metrics.diskUsage.worktreeExcludingGitBytes],
      ['Git Dir Bytes', metrics.diskUsage.gitDirBytes],
    ])}

    <div class="stats-subtitle">Largest Blobs</div>
    ${renderStatsTable(
      [...metrics.largestBlobs]
        .sort((a, b) => b.sizeBytes - a.sizeBytes)
        .map(blob => [blob.path, blob.sizeBytes]),
      { leftLabel: 'Path', rightLabel: 'Size (Bytes)' }
    )}

    <div class="stats-subtitle">Top Level Directories</div>
    ${renderStatsTable(
      [...metrics.diskUsage.topLevelDirs]
        .sort((a, b) => b.sizeBytes - a.sizeBytes)
        .map(dir => [dir.path, dir.sizeBytes]),
      { leftLabel: 'Path', rightLabel: 'Size (Bytes)' }
    )}
  `;
}

function renderStatsTable(
  rows: Array<[string, string | number]>,
  headers: { leftLabel: string; rightLabel: string } = { leftLabel: 'Metric', rightLabel: 'Value' }
): string {
  if (rows.length === 0) {
    return `<div class="excluded-empty">(none)</div>`;
  }

  return `
    <table class="stats-table">
      <thead>
        <tr>
          <th>${escapeHtml(headers.leftLabel)}</th>
          <th class="num">${escapeHtml(headers.rightLabel)}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([label, value]) => `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="num">${formatValue(value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

type AllFilesSortKey = 'path' | 'fileType' | 'lines' | 'words' | 'bytes';

type IncludedFileStats = ProjectStatistics['includedFiles'][number];

function renderAllFilesTable(
  rows: IncludedFileStats[],
  sortKey: AllFilesSortKey
): string {
  if (rows.length === 0) {
    return `<div class="excluded-empty">(none)</div>`;
  }

  return `
    <table class="stats-table" data-all-files-table="true">
      <thead>
        <tr>
          ${renderSortableHeader('File', 'path', sortKey)}
          ${renderSortableHeader('Type', 'fileType', sortKey)}
          ${renderSortableHeader('Lines', 'lines', sortKey, true)}
          ${renderSortableHeader('Words', 'words', sortKey, true)}
          ${renderSortableHeader('Bytes', 'bytes', sortKey, true)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.path)}</td>
            <td>${escapeHtml(row.fileType || '(no extension)')}</td>
            <td class="num">${row.lines.toLocaleString()}</td>
            <td class="num">${row.words.toLocaleString()}</td>
            <td class="num">${row.bytes.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSortableHeader(
  label: string,
  key: AllFilesSortKey,
  activeKey: AllFilesSortKey,
  numeric: boolean = false
): string {
  const activeClass = key === activeKey ? 'is-active' : '';
  const numericClass = numeric ? 'num' : '';
  return `
    <th class="${numericClass} ${activeClass}" data-sort-key="${key}">
      ${escapeHtml(label)}
    </th>
  `;
}

function groupFilesByType(items?: IncludedFileStats[]): Map<string, IncludedFileStats[]> {
  const grouped = new Map<string, IncludedFileStats[]>();
  if (!items) {
    return grouped;
  }

  for (const item of items) {
    const existing = grouped.get(item.fileType) ?? [];
    existing.push(item);
    grouped.set(item.fileType, existing);
  }

  for (const [key, files] of grouped.entries()) {
    files.sort((a, b) => a.path.localeCompare(b.path));
    grouped.set(key, files);
  }

  return grouped;
}

function sortAllFiles(
  items: IncludedFileStats[],
  key: AllFilesSortKey
): IncludedFileStats[] {
  const rows = [...items];
  rows.sort((a, b) => {
    if (key === 'path' || key === 'fileType') {
      return a[key].localeCompare(b[key]);
    }
    return a[key] - b[key];
  });
  return rows;
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return escapeHtml(value);
}

function formatOptionalNumber(value?: number): string {
  if (value === undefined) {
    return 'unknown';
  }
  return value.toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
