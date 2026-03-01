import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const settings = await invoke<Record<string, string>>('get_settings');
        const saved = settings?.theme as ThemeMode | undefined;
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        }
      } catch {
        // use default
      }
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-theme', theme);
    const save = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_settings', {
          settings: { theme },
        });
      } catch {
        // ignore
      }
    };
    save();
  }, [theme, loaded]);

  const setTheme = (t: ThemeMode) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
