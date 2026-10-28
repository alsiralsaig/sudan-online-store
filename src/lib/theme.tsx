import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'medium' | 'dark';
const KEY = 'sanad_theme';
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved && ['light','medium','dark'].includes(saved)) return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });
  const setTheme = (t: Theme) => {
    setThemeRaw(t);
    localStorage.setItem(KEY, t);
    document.documentElement.setAttribute('data-theme', t);
  };
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}
export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('no theme');
  return v;
}
