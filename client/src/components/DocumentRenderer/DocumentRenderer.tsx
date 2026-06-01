import { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './DocumentRenderer.module.css';
import { highlightCode, isHighlighterReady, onHighlighterReady } from '../../services/highlighter';

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

type PlaceholderMeta = { html: string; consumed: number };

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

function processContent(content: string): string {
  const placeholders: Map<string, PlaceholderMeta> = new Map();
  let placeholderIndex = 0;

  // `consumed` = number of extra source lines this placeholder absorbed beyond
  // the line it occupies in `result`. Used in Phase 6.5 to keep `data-line`
  // aligned with the original source line numbers across multi-line collapses
  // (fenced code, display math, tables, lists).
  function ph(html: string, consumed = 0): string {
    const key = `\x00PH${placeholderIndex++}\x00`;
    placeholders.set(key, { html, consumed });
    return key;
  }

  let result = content;

  // Phase 0: Extract cross-app links FIRST so they're not mangled by markdown processing
  result = result.replace(/\[\[([\w]+):([\w]+):([^\|\]]+)(?:\|([^\]]+))?\]\]/g, (_m, app, refType, refId, label) => {
    return ph(renderCrossAppLink(app, refType, refId.trim(), label ? label.trim() : undefined));
  });

  // Phase 1: Extract fenced code blocks (with optional language tag)
  result = result.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const trimmed = code.replace(/\n$/, '');
    return ph(highlightCode(trimmed, lang || ''), countNewlines(match));
  });

  // Phase 2: Extract inline code
  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    return ph(`<code>${escapeHtml(code)}</code>`);
  });

  // Phase 3: Extract and render display math
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
    return ph(`<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`, countNewlines(match));
  });
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, tex) => {
    return ph(`<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`, countNewlines(match));
  });

  // Phase 4: Inline math
  result = result.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });

  // Phase 4.5: Dates → styled <time>. Two triggers:
  //   • Explicit braces {yyyy-mm-dd} or {mm-dd} — unambiguous; the braces are stripped.
  //   • Bare yyyy-mm-dd — safe enough to auto-detect (full ISO dates rarely collide).
  // Bare mm-dd is NOT auto-detected (it collides with ranges/subtraction like "10-20");
  // wrap it in braces to opt in. Runs after code/math extraction so it never touches
  // `$…$` content, and emits a placeholder so later phases leave it alone.
  const wrapDate = (raw: string): string => {
    const parts = raw.split('-').map(Number);
    const [mm, dd] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return raw; // not a real date
    return ph(`<time>${escapeHtml(raw)}</time>`);
  };
  // Braced form first (covers both lengths); leave literal braces if the date is invalid.
  result = result.replace(/\{(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})\}/g, (m, d) => {
    const out = wrapDate(d);
    return out === d ? m : out;
  });
  // Bare yyyy-mm-dd only. Dash/digit guards avoid matching a fragment of a longer run
  // (e.g. a date inside a URL path).
  result = result.replace(/(?<![\/\d-])\d{4}-\d{2}-\d{2}(?![\/\d-])/g, (m) => wrapDate(m));

  // Phase 5: TODO list items (render as a styled list item with disabled checkbox)
  result = result.replace(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/gm, (_m, indent, mark, text) => {
    const checked = mark === 'x' || mark === 'X';
    const cls = checked ? 'todo todo-done' : 'todo';
    return `${indent}<div class="${cls}"><input type="checkbox" disabled${checked ? ' checked' : ''}/> ${text}</div>`;
  });

  // Phase 6: Other markdown formatting
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  result = result.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '<hr />');

  // Phase 6.2: Bullet lists. Consecutive `-`/`*`/`+` lines collapse into a <ul>.
  // Runs after the TODO parser (Phase 5) so checkbox lines don't get grabbed.
  result = result.replace(
    /(^|\n)((?:[ \t]*[-*+] [^\n]+(?:\n|$))+)/g,
    (match, prefix, block) => {
      const items = block
        .split('\n')
        .filter((l: string) => /^[ \t]*[-*+] /.test(l))
        .map((l: string) => l.replace(/^[ \t]*[-*+] /, '').trim());
      if (items.length === 0) return prefix + block;
      const html = `<ul class="md-list">${items.map((i: string) => `<li>${i}</li>`).join('')}</ul>`;
      const consumed = countNewlines(match) - countNewlines(prefix);
      return prefix + ph(html, consumed);
    },
  );

  // Phase 6.25: GFM tables. Multi-line; must run before the line gutter wraps
  // each line in its own <div>. The whole table collapses into a single
  // placeholder occupying one "line" in the gutter.
  result = result.replace(
    /(^|\n)([^\n]*\|[^\n]*)\n([ \t]*\|?[ \t]*:?-{2,}:?(?:[ \t]*\|[ \t]*:?-{2,}:?)+[ \t]*\|?[ \t]*)\n((?:[^\n]*\|[^\n]*(?:\n|$))+)/g,
    (match, prefix, headerLine, separatorLine, bodyBlock) => {
      const parseCells = (line: string) =>
        line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const aligns = parseCells(separatorLine).map((c) => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return null;
      });
      const headerCells = parseCells(headerLine);
      const bodyRows: string[][] = bodyBlock
        .replace(/\n+$/, '')
        .split('\n')
        .map((line: string) => parseCells(line));
      const alignAttr = (i: number) =>
        aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
      let html = '<table class="md-table"><thead><tr>';
      headerCells.forEach((cell, i) => {
        html += `<th${alignAttr(i)}>${cell}</th>`;
      });
      html += '</tr></thead><tbody>';
      bodyRows.forEach((row) => {
        html += '<tr>';
        headerCells.forEach((_, i) => {
          html += `<td${alignAttr(i)}>${row[i] ?? ''}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      const consumed = countNewlines(match) - countNewlines(prefix);
      return prefix + ph(html, consumed);
    },
  );

  // Phase 6.5: Wrap each line in a numbered container, walking source lines.
  // For each placeholder on a line, advance the source-line counter by its
  // `consumed` extra (so a collapsed table/code block doesn't compress the
  // gutter numbering for content after it).
  const phRe = /\x00PH\d+\x00/g;
  const lines = result.split('\n');
  let srcLine = 1;
  result = lines
    .map((line) => {
      const wrapped = `<div class="md-line" data-line="${srcLine}">${line || '<br />'}</div>`;
      let extra = 0;
      const found = line.match(phRe);
      if (found) {
        for (const k of found) {
          const meta = placeholders.get(k);
          if (meta) extra += meta.consumed;
        }
      }
      srcLine += 1 + extra;
      return wrapped;
    })
    .join('');

  // Phase 7: Restore placeholders. Reverse insertion order so outer placeholders
  // (e.g. tables created in Phase 6.25) expand before the inner placeholders
  // they reference (e.g. inline code from Phase 2) get resolved.
  Array.from(placeholders.entries()).reverse().forEach(([key, { html }]) => {
    result = result.split(key).join(html);
  });

  return result;
}

export default function DocumentRenderer({ content, className }: Props) {
  const [hlReady, setHlReady] = useState(isHighlighterReady);

  useEffect(() => {
    if (hlReady) return;
    return onHighlighterReady(() => setHlReady(true));
  }, [hlReady]);

  const html = useMemo(() => processContent(content), [content, hlReady]);
  return (
    <div
      className={`${styles.content} ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
