import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ThemeProvider as ElementsThemeProvider } from 'react-native-elements';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'user_theme_mode';

const lightTheme = {
  mode: 'light',
  colors: {
    background: '#fff',
    text: '#222',
    primary: '#2a4d8f',
    card: '#f5f5f5',
  },
  elements: {
    Button: { raised: true, buttonStyle: { backgroundColor: '#2a4d8f' } },
    Text: { style: { color: '#222' } },
  },
};

const darkTheme = {
  mode: 'dark',
  colors: {
    background: '#181818',
    text: '#fff',
    primary: '#90caf9',
    card: '#222',
  },
  elements: {
    Button: { raised: true, buttonStyle: { backgroundColor: '#90caf9' } },
    Text: { style: { color: '#fff' } },
  },
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState(lightTheme);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'dark') setTheme(darkTheme);
      else if (saved === 'light') setTheme(lightTheme);
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(THEME_KEY, theme.mode);
  }, [theme.mode]);

  const toggleTheme = () => {
    setTheme((prev) => (prev.mode === 'light' ? darkTheme : lightTheme));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ElementsThemeProvider theme={theme.elements}>{children}</ElementsThemeProvider>
    </ThemeContext.Provider>
  );
}; 