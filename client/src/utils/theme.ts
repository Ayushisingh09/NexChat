export interface ThemeAccent {
  key: string;
  name: string;
  green: string;
  greenDeep: string;
  sent: string;
  glow: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  {
    key: 'graphite',
    name: 'Graphite',
    green: '#a1a1aa',
    greenDeep: '#c4c4cd',
    sent: '#2a2a31',
    glow: '0 1px 3px rgba(0, 0, 0, 0.4)',
  },
  {
    key: 'mint',
    name: 'Mint Green',
    green: '#10b981',
    greenDeep: '#059669',
    sent: '#0a6049',
    glow: '0 0 24px -6px rgba(16, 185, 129, 0.45)',
  },
  {
    key: 'cobalt',
    name: 'Cobalt Blue',
    green: '#3b82f6',
    greenDeep: '#2563eb',
    sent: '#1e3a8a',
    glow: '0 0 24px -6px rgba(59, 130, 246, 0.45)',
  },
  {
    key: 'violet',
    name: 'Sunset Violet',
    green: '#8b5cf6',
    greenDeep: '#7c3aed',
    sent: '#4c1d95',
    glow: '0 0 24px -6px rgba(139, 92, 246, 0.45)',
  },
  {
    key: 'amber',
    name: 'Neon Amber',
    green: '#f59e0b',
    greenDeep: '#d97706',
    sent: '#78350f',
    glow: '0 0 24px -6px rgba(245, 158, 11, 0.45)',
  },
  {
    key: 'rose',
    name: 'Rose Pink',
    green: '#ec4899',
    greenDeep: '#db2777',
    sent: '#831843',
    glow: '0 0 24px -6px rgba(236, 72, 153, 0.45)',
  },
];

export function applyTheme(key: string) {
  const theme = THEME_ACCENTS.find((t) => t.key === key) || THEME_ACCENTS[0];
  document.documentElement.style.setProperty('--color-wa-green', theme.green);
  document.documentElement.style.setProperty('--color-wa-green-deep', theme.greenDeep);
  document.documentElement.style.setProperty('--color-wa-sent', theme.sent);
  document.documentElement.style.setProperty('--shadow-glow', theme.glow);
  
  try {
    localStorage.setItem('nexchat_theme', key);
  } catch {
    // ignore local storage block
  }
}
