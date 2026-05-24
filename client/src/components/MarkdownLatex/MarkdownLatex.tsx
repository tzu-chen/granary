import { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './MarkdownLatex.module.css';
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

function processContent(content: string): string {
  const placeholders: Map<string, string> = new Map();
  let placeholderIndex = 0;

  function ph(html: string): string {
    const key = `\x00PH${placeholderIndex++}\x00`;
    placeholders.set(key, html);
    return key;
  }

  let result = content;

  // Phase 1: Extract fenced code blocks (with optional language tag)
  result = result.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const trimmed = code.replace(/\n$/, '');
    return ph(highlightCode(trimmed, lang || ''));
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

  // Phase 4: Extract and render inline math
  result = result.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, tex) => {
    return ph(renderLatex(tex.trim(), false));
  });

  // Phase 5: Markdown formatting (now safe — no KaTeX HTML in the string)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  result = result.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, () => ph('<hr />'));

  // Phase 5.25: Bullet lists. Consecutive `- `, `* `, or `+ ` lines collapse
  // into a single <ul> placeholder. Must run before \n → <br />.
  result = result.replace(
    /(^|\n)((?:[ \t]*[-*+] [^\n]+(?:\n|$))+)/g,
    (_match, prefix, block) => {
      const items = block
        .split('\n')
        .filter((l: string) => /^[ \t]*[-*+] /.test(l))
        .map((l: string) => l.replace(/^[ \t]*[-*+] /, '').trim());
      if (items.length === 0) return prefix + block;
      const html = `<ul>${items.map((i: string) => `<li>${i}</li>`).join('')}</ul>`;
      return prefix + ph(html);
    },
  );

  // Phase 5.5: GFM tables. Must run before \n → <br /> so newlines still mark rows.
  result = result.replace(
    /(^|\n)([^\n]*\|[^\n]*)\n([ \t]*\|?[ \t]*:?-{2,}:?(?:[ \t]*\|[ \t]*:?-{2,}:?)+[ \t]*\|?[ \t]*)\n((?:[^\n]*\|[^\n]*(?:\n|$))+)/g,
    (_match, prefix, headerLine, separatorLine, bodyBlock) => {
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
      let html = '<table><thead><tr>';
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
      return prefix + ph(html);
    },
  );

  result = result.replace(/\n/g, '<br />');

  // Phase 6: Restore placeholders. Reverse insertion order so outer placeholders
  // (e.g. tables) expand before the inner placeholders (e.g. inline code) they
  // reference get resolved.
  Array.from(placeholders.entries()).reverse().forEach(([key, html]) => {
    result = result.split(key).join(html);
  });

  return result;
}

export default function MarkdownLatex({ content, className }: Props) {
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
