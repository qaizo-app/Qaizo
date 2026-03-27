// src/theme/ThemeContext.js
// Контекст темы — автодетекция + ручной переключатель
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { applyTheme, getCurrentTheme } from './colors';

const THEME_KEY = 'qaizo_theme_mode'; // 'system' | 'light' | 'dark'

const ThemeContext = createContext({
  theme: 'dark',        // текущая визуальная тема: 'dark' | 'light'
  themeMode: 'system',  // что выбрал юзер: 'system' | 'light' | 'dark'
  setThemeMode: () => {},
  themeKey: 0,          // инкремент для принудительного ремаунта
});

function resolveTheme(mode) {
  if (mode === 'system') {
    return Appearance.getColorScheme() || 'dark';
  }
  return mode;
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState('system');
  const [themeKey, setThemeKey] = useState(0);
  const [ready, setReady] = useState(false);

  // Загрузить сохранённый режим
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      const mode = saved || 'system';
      setThemeModeState(mode);
      applyTheme(resolveTheme(mode));
      setReady(true);
    });
  }, []);

  // Слушать смену системной темы
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        applyTheme(colorScheme || 'dark');
        setThemeKey(k => k + 1);
      }
    });
    return () => sub.remove();
  }, [themeMode]);

  const setThemeMode = useCallback(async (mode) => {
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

export function useTheme() {
  return useContext(ThemeContext);
}
