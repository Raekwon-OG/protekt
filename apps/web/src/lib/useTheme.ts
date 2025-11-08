import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const LS_KEY = 'protekt_theme';

export const getPreferredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

export const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'light' : getPreferredTheme()));

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, theme); } catch {}
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggle } as const;
};

export default useTheme;
