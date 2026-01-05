type RenderTarget = HTMLElement;

export type MarkdownRenderOptions = {
  baseUrl: string;
  resolveHref?: (rawHref: string, baseUrl: string) => string;
  resolveImageSrc?: (rawSrc: string, baseUrl: string) => string;
  onLinkCreated?: (link: HTMLAnchorElement, rawHref: string) => void;
};

type NormalizedRenderOptions = Required<MarkdownRenderOptions>;

export function renderMarkdown(
  markdown: string,
  container: RenderTarget,
  baseUrlOrOptions: string | MarkdownRenderOptions
): void {
  const options = normalizeOptions(baseUrlOrOptions);
  container.replaceChildren();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let index = 0;
  let currentParagraph: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentBlockquote: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const p = document.createElement('p');
    appendInline(p, currentParagraph.join(' '), options);
    container.appendChild(p);
    currentParagraph = [];
  };

  const flushList = () => {
    if (!currentList) return;
    const list = document.createElement(currentList.type);
    currentList.items.forEach((item) => {
      const li = document.createElement('li');
      appendInline(li, item, options);
      list.appendChild(li);
    });
    container.appendChild(list);
    currentList = null;
  };

  const flushBlockquote = () => {
    if (currentBlockquote.length === 0) return;
    const block = document.createElement('blockquote');
    appendInline(block, currentBlockquote.join(' '), options);
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
        appendInline(heading, match[2].trim(), options);
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

function normalizeOptions(baseUrlOrOptions: string | MarkdownRenderOptions): NormalizedRenderOptions {
  if (typeof baseUrlOrOptions === 'string') {
    return {
      baseUrl: baseUrlOrOptions,
      resolveHref: resolveMarkdownHref,
      resolveImageSrc: resolveRelativeHref,
      onLinkCreated: () => undefined,
    };
  }
  return {
    baseUrl: baseUrlOrOptions.baseUrl,
    resolveHref: baseUrlOrOptions.resolveHref ?? resolveMarkdownHref,
    resolveImageSrc: baseUrlOrOptions.resolveImageSrc ?? resolveRelativeHref,
    onLinkCreated: baseUrlOrOptions.onLinkCreated ?? (() => undefined),
  };
}

function appendInline(parent: HTMLElement, text: string, options: NormalizedRenderOptions): void {
  const parts = text.split('`');
  parts.forEach((segment, idx) => {
    if (idx % 2 === 1) {
      const code = document.createElement('code');
      code.textContent = segment;
      parent.appendChild(code);
      return;
    }
    appendLinksAndEmphasis(parent, segment, options);
  });
}

function appendLinksAndEmphasis(parent: HTMLElement, text: string, options: NormalizedRenderOptions): void {
  const tokenRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const prefix = text.slice(lastIndex, match.index);
    appendEmphasis(parent, prefix);

    const isImage = Boolean(match[1]);
    if (isImage) {
      const img = document.createElement('img');
      const rawSrc = match[2].trim();
      img.src = options.resolveImageSrc(rawSrc, options.baseUrl);
      img.alt = match[1].trim();
      parent.appendChild(img);
    } else {
      const link = document.createElement('a');
      const rawHref = match[4].trim();
      link.href = options.resolveHref(rawHref, options.baseUrl);
      link.textContent = match[3].trim();
      options.onLinkCreated(link, rawHref);
      parent.appendChild(link);
    }

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

export function resolveRelativeHref(rawHref: string, baseUrl: string): string {
  if (!rawHref) return rawHref;
  if (rawHref.startsWith('#')) return rawHref;
  try {
    return new URL(rawHref, baseUrl).href;
  } catch {
    return rawHref;
  }
}

export function resolveMarkdownHref(rawHref: string, baseUrl: string): string {
  if (!rawHref) return rawHref;
  if (rawHref.startsWith('#')) return rawHref;
  try {
    const resolved = new URL(rawHref, baseUrl).href;
    const viewerUrl = new URL(window.location.href);
    viewerUrl.search = '';
    viewerUrl.hash = '';
    viewerUrl.searchParams.set('url', resolved);
    return viewerUrl.toString();
  } catch {
    return rawHref;
  }
}
