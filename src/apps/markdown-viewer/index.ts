const statusEl = document.getElementById('status');
const markdownEl = document.getElementById('markdown');
const urlInput = document.getElementById('url-input') as HTMLInputElement | null;
const controlsForm = document.getElementById('controls') as HTMLFormElement | null;

if (!statusEl || !markdownEl || !urlInput || !controlsForm) {
  throw new Error('Markdown Viewer: missing required DOM elements.');
}

const params = new URLSearchParams(window.location.search);
const initialUrl = params.get('url') || '';
urlInput.value = initialUrl;

controlsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = urlInput.value.trim();
  if (!raw) {
    showStatus('Provide a URL to a markdown file.', true);
    markdownEl.replaceChildren();
    return;
  }
  const next = new URL(window.location.href);
  next.searchParams.set('url', raw);
  window.location.href = next.toString();
});

if (initialUrl) {
  loadMarkdown(initialUrl).catch((err) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    showStatus(`Failed to load markdown: ${message}`, true);
  });
}

async function loadMarkdown(rawUrl: string): Promise<void> {
  const resolvedUrl = new URL(rawUrl, window.location.href);
  showStatus(`Loading ${resolvedUrl.href} ...`, false, resolvedUrl.href);

  const response = await fetch(resolvedUrl.href, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  renderMarkdown(text, markdownEl);
  showStatus(`Loaded ${resolvedUrl.href}`, false, resolvedUrl.href);
}

function showStatus(message: string, isError: boolean, linkHref?: string): void {
  statusEl.textContent = '';
  statusEl.classList.toggle('notice', true);
  statusEl.classList.toggle('error', isError);

  const span = document.createElement('span');
  span.textContent = message;
  statusEl.appendChild(span);

  if (linkHref) {
    statusEl.appendChild(document.createTextNode(' '));
    const link = document.createElement('a');
    link.id = 'source-link';
    link.href = linkHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '(open source)';
    statusEl.appendChild(link);
  }
}

function renderMarkdown(markdown: string, container: HTMLElement): void {
  container.replaceChildren();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let index = 0;
  let currentParagraph: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentBlockquote: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const p = document.createElement('p');
    appendInline(p, currentParagraph.join(' '));
    container.appendChild(p);
    currentParagraph = [];
  };

  const flushList = () => {
    if (!currentList) return;
    const list = document.createElement(currentList.type);
    currentList.items.forEach((item) => {
      const li = document.createElement('li');
      appendInline(li, item);
      list.appendChild(li);
    });
    container.appendChild(list);
    currentList = null;
  };

  const flushBlockquote = () => {
    if (currentBlockquote.length === 0) return;
    const block = document.createElement('blockquote');
    appendInline(block, currentBlockquote.join(' '));
    container.appendChild(block);
    currentBlockquote = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      container.appendChild(pre);
      index += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const heading = document.createElement(`h${level}`);
        appendInline(heading, match[2].trim());
        container.appendChild(heading);
      }
      index += 1;
      continue;
    }

    if (/^\s*([-*])\s+/.test(line)) {
      flushParagraph();
      flushBlockquote();
      const item = line.replace(/^\s*[-*]\s+/, '').trim();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(item);
      index += 1;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      flushBlockquote();
      const item = line.replace(/^\s*\d+\.\s+/, '').trim();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(item);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      const text = line.replace(/^\s*>\s?/, '').trim();
      currentBlockquote.push(text);
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      container.appendChild(document.createElement('hr'));
      index += 1;
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      flushBlockquote();
      index += 1;
      continue;
    }

    currentParagraph.push(line.trim());
    index += 1;
  }

  flushParagraph();
  flushList();
  flushBlockquote();
}

function appendInline(parent: HTMLElement, text: string): void {
  const parts = text.split('`');
  parts.forEach((segment, idx) => {
    if (idx % 2 === 1) {
      const code = document.createElement('code');
      code.textContent = segment;
      parent.appendChild(code);
      return;
    }
    appendLinksAndEmphasis(parent, segment);
  });
}

function appendLinksAndEmphasis(parent: HTMLElement, text: string): void {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = linkRegex.exec(text)) !== null) {
    const prefix = text.slice(lastIndex, match.index);
    appendEmphasis(parent, prefix);

    const link = document.createElement('a');
    link.href = match[2].trim();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = match[1].trim();
    parent.appendChild(link);

    lastIndex = match.index + match[0].length;
  }

  appendEmphasis(parent, text.slice(lastIndex));
}

function appendEmphasis(parent: HTMLElement, text: string): void {
  let remaining = text;
  const strongRegex = /\*\*([^*]+)\*\*/;
  const emRegex = /\*([^*]+)\*/;

  while (remaining.length > 0) {
    const strongMatch = remaining.match(strongRegex);
    const emMatch = remaining.match(emRegex);

    if (!strongMatch && !emMatch) {
      parent.appendChild(document.createTextNode(remaining));
      return;
    }

    const strongIndex = strongMatch ? strongMatch.index ?? -1 : -1;
    const emIndex = emMatch ? emMatch.index ?? -1 : -1;
    let nextIsStrong = false;

    if (strongIndex >= 0 && (emIndex === -1 || strongIndex <= emIndex)) {
      nextIsStrong = true;
    }

    const nextMatch = nextIsStrong ? strongMatch : emMatch;
    if (!nextMatch || nextMatch.index === undefined) {
      parent.appendChild(document.createTextNode(remaining));
      return;
    }

    if (nextMatch.index > 0) {
      parent.appendChild(document.createTextNode(remaining.slice(0, nextMatch.index)));
    }

    const element = document.createElement(nextIsStrong ? 'strong' : 'em');
    element.textContent = nextMatch[1];
    parent.appendChild(element);

    remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
  }
}
