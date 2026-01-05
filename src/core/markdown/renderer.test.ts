/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderMarkdown, resolveMarkdownHref, resolveRelativeHref } from './renderer';

describe('renderMarkdown', () => {
  it('renders headings, paragraphs, and inline formatting', () => {
    const container = document.createElement('div');
    const markdown = [
      '# Title',
      '',
      'Paragraph with *em* and **strong** and `code`.',
    ].join('\n');

    renderMarkdown(markdown, container, 'http://example.com/docs/guide.md');

    expect(container.innerHTML).toBe(
      '<h1>Title</h1><p>Paragraph with <em>em</em> and <strong>strong</strong> and <code>code</code>.</p>'
    );
  });

  it('renders lists and blockquotes', () => {
    const container = document.createElement('div');
    const markdown = [
      '- One',
      '- Two',
      '',
      '1. First',
      '2. Second',
      '',
      '> Quote line',
      '> Next line',
    ].join('\n');

    renderMarkdown(markdown, container, 'http://example.com/docs/guide.md');

    expect(container.innerHTML).toBe(
      '<ul><li>One</li><li>Two</li></ul>' +
      '<ol><li>First</li><li>Second</li></ol>' +
      '<blockquote>Quote line Next line</blockquote>'
    );
  });

  it('renders code fences and horizontal rules', () => {
    const container = document.createElement('div');
    const markdown = [
      '```',
      'const x = 1;',
      '```',
      '',
      '---',
    ].join('\n');

    renderMarkdown(markdown, container, 'http://example.com/docs/guide.md');

    expect(container.innerHTML).toBe(
      '<pre><code>const x = 1;</code></pre><hr>'
    );
  });

  it('renders images and uses custom link resolver', () => {
    const container = document.createElement('div');
    const markdown = 'Image: ![Alt](./img.png) and [link](page.md).';

    renderMarkdown(markdown, container, {
      baseUrl: 'http://example.com/docs/guide.md',
      resolveHref: (href) => `custom:${href}`,
      resolveImageSrc: resolveRelativeHref,
    });

    expect(container.innerHTML).toBe(
      '<p>Image: <img src="http://example.com/docs/img.png" alt="Alt"> and <a href="custom:page.md">link</a>.</p>'
    );
  });
});

describe('resolveMarkdownHref', () => {
  it('keeps hash links untouched', () => {
    const resolved = resolveMarkdownHref('#section', 'http://example.com/docs/guide.md');
    expect(resolved).toBe('#section');
  });

  it('rewrites relative links to the viewer url', () => {
    const resolved = resolveMarkdownHref('other.md', 'http://example.com/docs/guide.md');
    const url = new URL(resolved);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get('url')).toBe('http://example.com/docs/other.md');
  });

  it('rewrites absolute links to the viewer url', () => {
    const resolved = resolveMarkdownHref('https://example.com/page', 'http://example.com/docs/guide.md');
    const url = new URL(resolved);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get('url')).toBe('https://example.com/page');
  });
});
