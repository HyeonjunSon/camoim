import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, setActiveColors } from '../constants/colors';

const STORAGE_KEY = 'theme.mode';

const ThemeContext = createContext({
  mode: 'light',
  resolved: 'light',
  colors: lightColors,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'light');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub.remove();
  }, []);

  const setMode = async (next) => {
    setModeState(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  const resolved = mode === 'system' ? systemScheme : mode;
  const themeColors = resolved === 'dark' ? darkColors : lightColors;

  // Keep the module-scope colors Proxy in sync too
  useEffect(() => {
    setActiveColors(themeColors);
  }, [resolved]);

  // Sync on initialization as well
  setActiveColors(themeColors);

  const value = useMemo(
    () => ({ mode, resolved, colors: themeColors, setMode }),
    [mode, resolved, themeColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
