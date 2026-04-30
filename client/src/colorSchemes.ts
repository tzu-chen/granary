export interface ColorScheme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: Record<string, string>;
}

const defaultLight: ColorScheme = {
  id: 'default-light',
  name: 'Default Light',
  type: 'light',
  colors: {
    'color-bg-primary': '#ffffff',
    'color-bg-secondary': '#f8f9fa',
    'color-bg-tertiary': '#e9ecef',
    'color-text-primary': '#212529',
    'color-text-secondary': '#495057',
    'color-text-muted': '#868e96',
    'color-border': '#dee2e6',
    'color-accent': '#6366f1',
    'color-accent-hover': '#4f46e5',
    'color-accent-light': '#eef2ff',
    'color-success': '#10b981',
    'color-warning': '#f59e0b',
    'color-danger': '#ef4444',
    'color-info': '#3b82f6',
    'color-entry-note': '#6b7280',
    'color-entry-question': '#f97316',
    'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    'shadow-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
};

const defaultDark: ColorScheme = {
  id: 'default-dark',
  name: 'Default Dark',
  type: 'dark',
  colors: {
    'color-bg-primary': '#1a1a2e',
    'color-bg-secondary': '#222240',
    'color-bg-tertiary': '#2a2a4a',
    'color-text-primary': '#e2e8f0',
    'color-text-secondary': '#a0aec0',
    'color-text-muted': '#718096',
    'color-border': '#3a3a5c',
    'color-accent': '#818cf8',
    'color-accent-hover': '#6366f1',
    'color-accent-light': '#2a2a4a',
    'color-success': '#34d399',
    'color-warning': '#fbbf24',
    'color-danger': '#f87171',
    'color-info': '#60a5fa',
    'color-entry-note': '#9ca3af',
    'color-entry-question': '#fb923c',
    'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.2)',
    'shadow-md': '0 4px 6px rgba(0, 0, 0, 0.3)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
};

const solarizedLight: ColorScheme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  type: 'light',
  colors: {
    'color-bg-primary': '#fdf6e3',
    'color-bg-secondary': '#eee8d5',
    'color-bg-tertiary': '#e8e1cc',
    'color-text-primary': '#657b83',
    'color-text-secondary': '#586e75',
    'color-text-muted': '#93a1a1',
    'color-border': '#d3cbb7',
    'color-accent': '#268bd2',
    'color-accent-hover': '#1a6fb5',
    'color-accent-light': '#e8f1f8',
    'color-success': '#859900',
    'color-warning': '#b58900',
    'color-danger': '#dc322f',
    'color-info': '#268bd2',
    'color-entry-note': '#93a1a1',
    'color-entry-question': '#cb4b16',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
    'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.1)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
};

const solarizedDark: ColorScheme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  type: 'dark',
  colors: {
    'color-bg-primary': '#002b36',
    'color-bg-secondary': '#073642',
    'color-bg-tertiary': '#0d3e4a',
    'color-text-primary': '#839496',
    'color-text-secondary': '#657b83',
    'color-text-muted': '#586e75',
    'color-border': '#1a4a56',
    'color-accent': '#268bd2',
    'color-accent-hover': '#4aa3e0',
    'color-accent-light': '#0a3d50',
    'color-success': '#859900',
    'color-warning': '#b58900',
    'color-danger': '#dc322f',
    'color-info': '#268bd2',
    'color-entry-note': '#657b83',
    'color-entry-question': '#cb4b16',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
};

const nord: ColorScheme = {
  id: 'nord',
  name: 'Nord',
  type: 'dark',
  colors: {
    'color-bg-primary': '#2e3440',
    'color-bg-secondary': '#3b4252',
    'color-bg-tertiary': '#434c5e',
    'color-text-primary': '#eceff4',
    'color-text-secondary': '#d8dee9',
    'color-text-muted': '#4c566a',
    'color-border': '#4c566a',
    'color-accent': '#88c0d0',
    'color-accent-hover': '#8fbcbb',
    'color-accent-light': '#2e3a40',
    'color-success': '#a3be8c',
    'color-warning': '#ebcb8b',
    'color-danger': '#bf616a',
    'color-info': '#81a1c1',
    'color-entry-note': '#4c566a',
    'color-entry-question': '#d08770',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
};

const dracula: ColorScheme = {
  id: 'dracula',
  name: 'Dracula',
  type: 'dark',
  colors: {
    'color-bg-primary': '#282a36',
    'color-bg-secondary': '#44475a',
    'color-bg-tertiary': '#383a4a',
    'color-text-primary': '#f8f8f2',
    'color-text-secondary': '#bfbfb8',
    'color-text-muted': '#6272a4',
    'color-border': '#6272a4',
    'color-accent': '#bd93f9',
    'color-accent-hover': '#caa5ff',
    'color-accent-light': '#2e2842',
    'color-success': '#50fa7b',
    'color-warning': '#f1fa8c',
    'color-danger': '#ff5555',
    'color-info': '#8be9fd',
    'color-entry-note': '#6272a4',
    'color-entry-question': '#ffb86c',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    'shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
};

const githubLight: ColorScheme = {
  id: 'github-light',
  name: 'GitHub Light',
  type: 'light',
  colors: {
    'color-bg-primary': '#ffffff',
    'color-bg-secondary': '#f6f8fa',
    'color-bg-tertiary': '#e1e4e8',
    'color-text-primary': '#1f2328',
    'color-text-secondary': '#656d76',
    'color-text-muted': '#8b949e',
    'color-border': '#d0d7de',
    'color-accent': '#0969da',
    'color-accent-hover': '#0550ae',
    'color-accent-light': '#ddf4ff',
    'color-success': '#1a7f37',
    'color-warning': '#bf8700',
    'color-danger': '#cf222e',
    'color-info': '#0969da',
    'color-entry-note': '#656d76',
    'color-entry-question': '#bc4c00',
    'shadow-sm': '0 1px 3px rgba(31, 35, 40, 0.06)',
    'shadow-md': '0 4px 12px rgba(31, 35, 40, 0.1)',
    'shadow-lg': '0 8px 24px rgba(31, 35, 40, 0.15)',
  },
};

const catppuccinLatte: ColorScheme = {
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  type: 'light',
  colors: {
    'color-bg-primary': '#eff1f5',
    'color-bg-secondary': '#e6e9ef',
    'color-bg-tertiary': '#dce0e8',
    'color-text-primary': '#4c4f69',
    'color-text-secondary': '#6c6f85',
    'color-text-muted': '#9ca0b0',
    'color-border': '#ccd0da',
    'color-accent': '#1e66f5',
    'color-accent-hover': '#1558d8',
    'color-accent-light': '#e0eafc',
    'color-success': '#40a02b',
    'color-warning': '#df8e1d',
    'color-danger': '#d20f39',
    'color-info': '#1e66f5',
    'color-entry-note': '#6c6f85',
    'color-entry-question': '#fe640b',
    'shadow-sm': '0 1px 3px rgba(76, 79, 105, 0.06)',
    'shadow-md': '0 4px 12px rgba(76, 79, 105, 0.1)',
    'shadow-lg': '0 8px 24px rgba(76, 79, 105, 0.15)',
  },
};

export const COLOR_SCHEMES: ColorScheme[] = [
  defaultLight,
  defaultDark,
  solarizedLight,
  solarizedDark,
  nord,
  dracula,
  githubLight,
  catppuccinLatte,
];

export const DEFAULT_SCHEME_ID = 'default-light';

export function getSchemeById(id: string): ColorScheme {
  return COLOR_SCHEMES.find(s => s.id === id) ?? defaultLight;
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
