export interface ColorScheme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: Record<string, string>;
}

const light: ColorScheme = {
  id: 'light',
  name: 'Light',
  type: 'light',
  colors: {
    'color-bg-primary': '#ffffff',
    'color-bg-secondary': '#f8f9fa',
    'color-bg-tertiary': '#f0f1f3',
    'color-text-primary': '#212529',
    'color-text-secondary': '#6c757d',
    'color-text-muted': '#adb5bd',
    'color-border': '#dee2e6',
    'color-accent': '#4263eb',
    'color-accent-hover': '#3b5bdb',
    'color-accent-light': '#edf2ff',
    'color-success': '#2b8a3e',
    'color-warning': '#e67700',
    'color-danger': '#c92a2a',
    'color-info': '#1c7ed6',
    'color-entry-note': '#6c757d',
    'color-entry-question': '#e8590c',
    'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    'shadow-md': '0 2px 8px rgba(0, 0, 0, 0.08)',
    'shadow-lg': '0 4px 16px rgba(0, 0, 0, 0.1)',
  },
};

const dark: ColorScheme = {
  id: 'dark',
  name: 'Dark',
  type: 'dark',
  colors: {
    'color-bg-primary': '#2e3440',
    'color-bg-secondary': '#3b4252',
    'color-bg-tertiary': '#434c5e',
    'color-text-primary': '#eceff4',
    'color-text-secondary': '#d8dee9',
    'color-text-muted': '#7b88a1',
    'color-border': '#4c566a',
    'color-accent': '#88c0d0',
    'color-accent-hover': '#8fbcbb',
    'color-accent-light': '#2e3a40',
    'color-success': '#a3be8c',
    'color-warning': '#ebcb8b',
    'color-danger': '#bf616a',
    'color-info': '#81a1c1',
    'color-entry-note': '#7b88a1',
    'color-entry-question': '#d08770',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
};

export const COLOR_SCHEMES: ColorScheme[] = [light, dark];

export const DEFAULT_SCHEME_ID = 'light';
export const DEFAULT_LIGHT_SCHEME_ID = 'light';
export const DEFAULT_DARK_SCHEME_ID = 'dark';

export function getSchemeById(id: string): ColorScheme {
  return COLOR_SCHEMES.find(s => s.id === id) ?? light;
}

export function applyColorScheme(scheme: ColorScheme): void {
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries(scheme.colors)) {
    style.setProperty(`--${key}`, value);
  }
  if (scheme.type === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
