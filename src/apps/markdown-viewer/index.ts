import { renderMarkdown } from '../../core/markdown/renderer';

const statusEl = requireElement('status');
const markdownEl = requireElement('markdown');
const urlInput = requireInputElement('url-input');
const controlsForm = requireFormElement('controls');
const hideMetaCheckbox = requireInputElement('hide-meta-controls');

const params = new URLSearchParams(window.location.search);
const initialUrl = params.get('url') || '';
urlInput.value = initialUrl;
hideMetaCheckbox.checked = true;
document.body.classList.add('hide-meta');

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

hideMetaCheckbox.addEventListener('change', () => {
  document.body.classList.toggle('hide-meta', hideMetaCheckbox.checked);
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'm') return;
  event.preventDefault();
  hideMetaCheckbox.checked = !hideMetaCheckbox.checked;
  document.body.classList.toggle('hide-meta', hideMetaCheckbox.checked);
});

async function loadMarkdown(rawUrl: string): Promise<void> {
  const resolvedUrl = new URL(rawUrl, window.location.href);
  showStatus(`Loading ${resolvedUrl.href} ...`, false, resolvedUrl.href);

  const response = await fetch(resolvedUrl.href, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  renderMarkdown(text, markdownEl, resolvedUrl.href);
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
    link.textContent = '(open source)';
    statusEl.appendChild(link);
  }
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Markdown Viewer: missing #${id}.`);
  }
  return element;
}

function requireInputElement(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!element || !(element instanceof HTMLInputElement)) {
    throw new Error(`Markdown Viewer: missing input #${id}.`);
  }
  return element;
}

function requireFormElement(id: string): HTMLFormElement {
  const element = document.getElementById(id);
  if (!element || !(element instanceof HTMLFormElement)) {
    throw new Error(`Markdown Viewer: missing form #${id}.`);
  }
  return element;
}
