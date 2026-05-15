import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './DocumentRenderer.module.css';

interface Props {
  content: string;
  className?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderLatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

function buildCrossAppHref(app: string, refType: string, refId: string): { href: string; external: boolean } {
  if (app === 'granary') {
    if (refType === 'document') return { href: `/library/${refId}`, external: false };
    return { href: `/entries/${refId}`, external: false };
  }
  // Sibling apps: fixed local base URLs per the four-app ecosystem.
  if (app === 'navigate') return { href: `http://localhost:3001/papers/${encodeURIComponent(refId)}`, external: true };
  if (app === 'scribe') return { href: `http://localhost:3001/notes/${encodeURIComponent(refId)}`, external: true };
  if (app === 'monolith') return { href: `http://localhost:3001/projects/${encodeURIComponent(refId)}`, external: true };
  return { href: '#', external: false };
}

function renderCrossAppLink(app: string, refType: string, refId: string, label?: string): string {
  const { href, external } = buildCrossAppHref(app, refType, refId);
  const displayLabel = label || `${app}:${refType}:${refId}`;
  const target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  const tagClass = `cross-app-link app-${escapeHtml(app)}`;
  return `<a href="${escapeHtml(href)}" class="${tagClass}"${target} data-app="${escapeHtml(app)}">${escapeHtml(displayLabel)}</a>`;
}

function processContent(content: string): string {
  const placeholders: Map<string, string> = new Map();
  let placeholderIndex = 0;

  function ph(html: string): string {
    const key = `\x00PH${placeholderIndex++}\x00`;
    placeholders.set(key, html);
    return key;
  }

  let result = content;

  // Phase 0: Extract cross-app links FIRST so they're not mangled by markdown processing
  result = result.replace(/\[\[([\w]+):([\w]+):([^\|\]]+)(?:\|([^\]]+))?\]\]/g, (_m, app, refType, refId, label) => {
    return ph(renderCrossAppLink(app, refType, refId.trim(), label ? label.trim() : undefined));
  });

  // Phase 1: Extract fenced code blocks
  result = result.replace(/```([\s\S]*?)```/g, (_match, code) => {
    return ph(`<pre><code>${escapeHtml(code)}</code></pre>`);
  });

  // Phase 2: Extract inline code
  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    return ph(`<code>${escapeHtml(code)}</code>`);
  });

  // Phase 3: Extract and render display math
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
    return ph(`<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`);
  });
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, tex) => {
    return ph(`<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`);
  });

  // Phase 4: Inline math
  result = result.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });

  // Phase 5: TODO list items (render as a styled list item with disabled checkbox)
  result = result.replace(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/gm, (_m, indent, mark, text) => {
    const checked = mark === 'x' || mark === 'X';
    const cls = checked ? 'todo todo-done' : 'todo';
    return `${indent}<div class="${cls}"><input type="checkbox" disabled${checked ? ' checked' : ''}/> ${text}</div>`;
  });

  // Phase 6: Other markdown formatting
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Phase 6.5: Wrap each line in a numbered container (line gutter)
  const lines = result.split('\n');
  result = lines
    .map((line, i) => `<div class="md-line" data-line="${i + 1}">${line || '<br />'}</div>`)
    .join('');

  // Phase 7: Restore placeholders
  placeholders.forEach((html, key) => {
    result = result.split(key).join(html);
  });

  return result;
}

export default function DocumentRenderer({ content, className }: Props) {
  const html = useMemo(() => processContent(content), [content]);
  return (
    <div
      className={`${styles.content} ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
