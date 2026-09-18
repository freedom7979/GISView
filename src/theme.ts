export const THEMES = [
  { id: 'graphite', name: 'Grafitová', description: 'Odstíny černé', color: '#292929' },
  { id: 'forest', name: 'Lesní', description: 'Původní zelená', color: '#648151' },
  { id: 'ocean', name: 'Oceánská', description: 'Klidná modrá', color: '#527cbb' },
  { id: 'plum', name: 'Švestková', description: 'Jemná fialová', color: '#8a62a6' },
  { id: 'sand', name: 'Písková', description: 'Teplé odstíny', color: '#a0804d' },
] as const;
export type Theme = typeof THEMES[number]['id'];
export const THEME_STORAGE = 'gisview.theme.v1';
export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE);
    if (THEMES.some((theme) => theme.id === stored)) return stored as Theme;
  } catch { /* Optional storage. */ }
  return 'graphite';
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'graphite' ? '#111111' : '#edf2e9');
  try { localStorage.setItem(THEME_STORAGE, theme); } catch { /* Optional storage. */ }
}
