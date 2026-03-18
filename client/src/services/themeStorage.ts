const THEME_KEY = 'forge_theme';

export type Theme = 'light' | 'dark';

export const themeStorage = {
  get: (): Theme => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'light';
  },
  set: (theme: Theme): void => {
    localStorage.setItem(THEME_KEY, theme);
  },
};
