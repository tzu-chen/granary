import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './MarkdownLatex.module.css';

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
  result = result.replace(/\n/g, '<br />');

  // Phase 6: Restore placeholders
  placeholders.forEach((html, key) => {
    result = result.split(key).join(html);
  });

  return result;
}

export default function MarkdownLatex({ content, className }: Props) {
  const html = useMemo(() => processContent(content), [content]);

  return (
    <div
      className={`${styles.content} ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
