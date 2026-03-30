import { COLOR_SCHEMES, DEFAULT_SCHEME_ID } from '../colorSchemes';

const THEME_KEY = 'granary_theme';
const FONT_SIZE_KEY = 'granary_font_size';

export const DEFAULT_FONT_SIZE = 15;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 20;

const LEGACY_MAP: Record<string, string> = {
  light: 'default-light',
  dark: 'default-dark',
};

export const themeStorage = {
  get: (): string => {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return DEFAULT_SCHEME_ID;
    const mapped = LEGACY_MAP[raw] ?? raw;
    if (COLOR_SCHEMES.some(s => s.id === mapped)) return mapped;
    return DEFAULT_SCHEME_ID;
  },
  save: (schemeId: string): void => {
    localStorage.setItem(THEME_KEY, schemeId);
  },
  getFontSize: (): number => {
    const raw = localStorage.getItem(FONT_SIZE_KEY);
    if (!raw) return DEFAULT_FONT_SIZE;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < MIN_FONT_SIZE || parsed > MAX_FONT_SIZE) return DEFAULT_FONT_SIZE;
    return parsed;
  },
  saveFontSize: (size: number): void => {
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  },
};
