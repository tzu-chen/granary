import { createHighlighter, type HighlighterGeneric } from 'shiki';

type Highlighter = HighlighterGeneric<string, string>;

const LANGS = [
  'bash', 'shell', 'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'go', 'rust', 'c', 'cpp', 'java',
  'json', 'yaml', 'toml', 'html', 'css', 'sql',
  'markdown', 'diff', 'plaintext',
];

const THEMES = ['github-light', 'github-dark'] as const;

let highlighter: Highlighter | null = null;
let initPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = createHighlighter({ themes: [...THEMES], langs: LANGS }).then((h) => {
      highlighter = h as unknown as Highlighter;
      listeners.forEach((l) => l());
    });
  }
  return initPromise;
}

init();

export function onHighlighterReady(cb: () => void): () => void {
  if (highlighter) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isHighlighterReady(): boolean {
  return highlighter !== null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectLabel(html: string, lang: string): string {
  if (!lang) return html;
  const label = `<span class="code-block-lang">${escapeHtml(lang)}</span>`;
  // Place the label immediately after the opening <pre …> tag so it inherits
  // the pre's background color from shiki's inline style.
  return html.replace(/(<pre\b[^>]*>)/, `$1${label}`);
}

function fallback(code: string, lang: string): string {
  return injectLabel(`<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`, lang);
}

export function highlightCode(code: string, lang: string): string {
  const cleanLang = (lang || '').trim().toLowerCase();
  if (!highlighter) return fallback(code, cleanLang);

  const loaded = highlighter.getLoadedLanguages();
  const useLang = cleanLang && loaded.includes(cleanLang) ? cleanLang : 'plaintext';
  let html: string;
  try {
    html = highlighter.codeToHtml(code, {
      lang: useLang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    });
  } catch {
    return fallback(code, cleanLang);
  }
  return injectLabel(html, cleanLang);
}
