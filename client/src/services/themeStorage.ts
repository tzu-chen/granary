import { COLOR_SCHEMES, DEFAULT_SCHEME_ID } from '../colorSchemes';

const THEME_KEY = 'forge_theme';

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
};
