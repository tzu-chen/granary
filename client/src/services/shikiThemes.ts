/**
 * Shiki themes for the suite palette.
 *
 * Replaces `github-light` / `github-dark`, which put a fifth unrelated palette
 * inside code blocks that sit in themed markdown. The colours are the shared
 * `--mono-syn-*` ramp, so a fenced block here highlights from the same seven
 * colours as pyramid's code editor and monolith's LaTeX editor.
 *
 * Shiki resolves themes at highlight time and writes the result into inline
 * styles, so these cannot read CSS custom properties — the values are the
 * literal Parchment and Graphite columns of `styles/monolith-theme.css`. Update
 * both together.
 */

import type { ThemeRegistration } from 'shiki';

interface Ramp {
  bg: string;
  fg: string;
  keyword: string;
  type: string;
  string: string;
  comment: string;
  number: string;
  user: string;
  invalid: string;
  muted: string;
  success: string;
  error: string;
}

const parchment: Ramp = {
  bg: '#f3f0ea',
  fg: '#2c2820',
  keyword: '#7a5a99',
  type: '#3d8080',
  string: '#3d6b8e',
  comment: '#9e9588',
  number: '#b07830',
  user: '#8b5e3c',
  invalid: '#b04a4a',
  muted: '#6b6358',
  success: '#4a8c5e',
  error: '#b04a4a',
};

const graphite: Ramp = {
  bg: '#1c1e23',
  fg: '#e4e6ea',
  keyword: '#c58fd6',
  type: '#61b3a6',
  string: '#6fa8d0',
  comment: '#8b929c',
  number: '#d99a4e',
  user: '#d99a4e',
  invalid: '#d97b6c',
  muted: '#c2c7cf',
  success: '#5cc08a',
  error: '#d97b6c',
};

function build(name: string, type: 'light' | 'dark', r: Ramp): ThemeRegistration {
  return {
    name,
    type,
    colors: {
      'editor.background': r.bg,
      'editor.foreground': r.fg,
    },
    settings: [
      { settings: { background: r.bg, foreground: r.fg } },
      { scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
        settings: { foreground: r.comment, fontStyle: 'italic' } },
      { scope: ['keyword', 'storage', 'storage.modifier', 'keyword.control', 'keyword.other',
                'keyword.operator.expression', 'keyword.operator.new', 'variable.language'],
        settings: { foreground: r.keyword } },
      { scope: ['storage.type', 'entity.name.type', 'entity.name.class', 'entity.name.namespace',
                'support.type', 'support.class', 'entity.name.tag', 'entity.other.inherited-class'],
        settings: { foreground: r.type } },
      { scope: ['string', 'string.quoted', 'string.template', 'constant.character',
                'constant.character.escape', 'entity.other.attribute-name'],
        settings: { foreground: r.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.other', 'keyword.other.unit'],
        settings: { foreground: r.number } },
      { scope: ['entity.name.function', 'support.function', 'meta.function-call.generic',
                'entity.name.function.member', 'entity.name.label'],
        settings: { foreground: r.user } },
      { scope: ['variable', 'variable.other', 'meta.definition.variable', 'support.variable',
                'variable.other.property', 'meta.object-literal.key'],
        settings: { foreground: r.fg } },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator',
                'punctuation.terminator'],
        settings: { foreground: r.muted } },
      { scope: ['invalid', 'invalid.illegal'], settings: { foreground: r.invalid } },
      { scope: ['markup.heading', 'entity.name.section'],
        settings: { foreground: r.keyword, fontStyle: 'bold' } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.underline.link', 'string.other.link'],
        settings: { foreground: r.string } },
      { scope: ['markup.inserted', 'meta.diff.header.to-file'], settings: { foreground: r.success } },
      { scope: ['markup.deleted', 'meta.diff.header.from-file'], settings: { foreground: r.error } },
      { scope: ['markup.changed'], settings: { foreground: r.number } },
    ],
  };
}

export const MONOLITH_LIGHT = build('monolith-parchment', 'light', parchment);
export const MONOLITH_DARK = build('monolith-graphite', 'dark', graphite);
