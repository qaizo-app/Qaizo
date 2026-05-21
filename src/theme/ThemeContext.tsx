// src/theme/ThemeContext.tsx
// Контекст темы — автодетекция + ручной переключатель
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { applyTheme, getCurrentTheme, ResolvedTheme } from './colors';

const THEME_KEY = 'qaizo_theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';

interface ThemeContextValue {
  theme: ResolvedTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void | Promise<void>;
  themeKey: number;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  themeMode: 'system',
  setThemeMode: () => {},
  themeKey: 0,
});

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return (Appearance.getColorScheme() || 'dark') as ResolvedTheme;
  }
  return mode;
}

// Darkness check — dark + amoled both need light status bar text
export function isDarkTheme(theme: ResolvedTheme | string): boolean {
  return theme === 'dark' || theme === 'amoled';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [themeKey, setThemeKey] = useState(0);
  const [ready, setReady] = useState(false);

  // Загрузить сохранённый режим
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      const mode = (saved as ThemeMode) || 'system';
      setThemeModeState(mode);
      applyTheme(resolveTheme(mode));
      setReady(true);
    });
  }, []);

  // Слушать смену системной темы
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        applyTheme((colorScheme || 'dark') as ResolvedTheme);
        setThemeKey(k => k + 1);
      }
    });
    return () => sub.remove();
  }, [themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
    applyTheme(resolveTheme(mode));
    setThemeKey(k => k + 1);
  }, []);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{
      theme: getCurrentTheme(),
      themeMode,
      setThemeMode,
      themeKey,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
