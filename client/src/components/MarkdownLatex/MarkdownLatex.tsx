import { useMemo } from 'react';
import katex from 'katex';
import styles from './MarkdownLatex.module.css';

interface Props {
  content: string;
  className?: string;
}

function renderLatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return `<code>${tex}</code>`;
  }
}

function processContent(content: string): string {
  // Replace display math $$...$$ first
  let result = content.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
    return `<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`;
  });

  // Replace \[...\] display math
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, tex) => {
    return `<div class="katex-display">${renderLatex(tex.trim(), true)}</div>`;
  });

  // Replace inline math $...$  (not preceded by \)
  result = result.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (_match, tex) => {
    return renderLatex(tex.trim(), false);
  });

  // Replace \(...\) inline math
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, tex) => {
    return renderLatex(tex.trim(), false);
  });

  // Basic markdown: bold, italic, code, headers, line breaks
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Hyperlinks [text](url)
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  result = result.replace(/\n/g, '<br />');

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
