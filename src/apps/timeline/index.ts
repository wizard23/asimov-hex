import { Pane } from 'tweakpane';

interface Commit {
  hash: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
  message: string;
  addedLines: number;
  removedLines: number;
}

type DisplayMode = 'List';

class TimelineViewer {
  private pane!: Pane;
  private timelinePanel: HTMLElement;
  private commits: Commit[] = [];
  private filteredCommits: Commit[] = [];
  
  private config = {
    startDate: '',
    endDate: '',
    displayMode: 'List' as DisplayMode,
    searchTerm: '',
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
      this.commits = await response.json();
      
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
    
    this.pane.addBinding(this.config, 'startDate', {
      label: 'Start Date',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });

    this.pane.addBinding(this.config, 'endDate', {
      label: 'End Date',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });

    this.pane.addBinding(this.config, 'displayMode', {
      options: {
        'List': 'List',
      },
      label: 'Display Mode',
    }).on('change', () => {
      this.render();
    });

    this.pane.addBinding(this.config, 'searchTerm', {
      label: 'Search',
    }).on('change', () => {
      this.filterCommits();
      this.render();
    });
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
      // Date filter
      // Check if valid dates provided
      if (!isNaN(start) && commit.timestamp < start) return false;
      if (!isNaN(end) && commit.timestamp > end) return false;

      // Search filter
      if (term) {
        const content = `${commit.message} ${commit.authorName} ${commit.hash}`.toLowerCase();
        if (!content.includes(term)) return false;
      }

      return true;
    });
  }

  private render() {
    if (this.filteredCommits.length === 0) {
      this.timelinePanel.innerHTML = '<div class="no-data">No commits found matching criteria.</div>';
      return;
    }

    if (this.config.displayMode === 'List') {
      this.renderList();
    }
  }

  private renderList() {
    const html = this.filteredCommits.map(commit => {
      const date = new Date(commit.timestamp * 1000).toLocaleString();
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
          </div>
        </div>
      `;
    }).join('');

    this.timelinePanel.innerHTML = `
      <h2>Timeline (${this.filteredCommits.length} commits)</h2>
      ${html}
    `;
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
