import { Pane } from 'tweakpane';

interface FileTypeStats {
  fileType: string;
  count: number;
  totalLines: number;
  totalWords: number;
  totalBytes?: number;
}

interface ProjectStatistics {
  timestamp: string;
  fileTypes: FileTypeStats[];
  totals: {
    files: number;
    lines: number;
    words: number;
    bytes?: number;
  };
}

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
      const index = await indexResponse.json();
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

      const data: ProjectStatistics = await response.json();
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

    this.statisticsPanel.innerHTML = `
      <h2>Project Statistics</h2>
      
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
            <div class="stat-item-value">${data.totals.bytes !== undefined ? data.totals.bytes.toLocaleString() : '?'}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item-label">Generated</div>
            <div class="stat-item-value" style="font-size: 14px;">${timestamp}</div>
          </div>
        </div>
      </div>

      <div class="stat-section">
        <h3>File Types Breakdown</h3>
        <table class="file-type-table">
          <thead>
            <tr>
              <th>File Type</th>
              <th>Count</th>
              <th>Lines</th>
              <th>Words</th>
              <th>Bytes</th>
            </tr>
          </thead>
          <tbody>
            ${data.fileTypes.map(ft => `
              <tr>
                <td class="file-type">${ft.fileType || '(no extension)'}</td>
                <td>${ft.count.toLocaleString()}</td>
                <td>${ft.totalLines.toLocaleString()}</td>
                <td>${ft.totalWords.toLocaleString()}</td>
                <td>${ft.totalBytes !== undefined ? ft.totalBytes.toLocaleString() : '?'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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
