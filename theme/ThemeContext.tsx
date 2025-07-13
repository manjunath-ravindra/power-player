import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'user_theme_mode';

const lightTheme = {
  mode: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f8f9fa',
    card: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#6c757d',
    primary: '#007AFF',
    primaryLight: '#4da6ff',
    primaryDark: '#0056b3',
    secondary: '#5856d6',
    accent: '#ff9500',
    success: '#34c759',
    warning: '#ff9500',
    error: '#ff3b30',
    border: '#e1e5e9',
    borderLight: '#f1f3f4',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    videoControls: 'rgba(0, 0, 0, 0.7)',
    videoControlsLight: 'rgba(0, 0, 0, 0.5)',
    folderIcon: '#FFD600',
  },
};

const darkTheme = {
  mode: 'dark',
  colors: {
    background: '#000000',
    surface: '#1c1c1e',
    card: '#2c2c2e',
    text: '#ffffff',
    textSecondary: '#8e8e93',
    primary: '#0a84ff',
    primaryLight: '#5ac8fa',
    primaryDark: '#0056b3',
    secondary: '#5e5ce6',
    accent: '#ff9f0a',
    success: '#30d158',
    warning: '#ff9f0a',
    error: '#ff453a',
    border: '#38383a',
    borderLight: '#48484a',
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.3)',
    videoControls: 'rgba(0, 0, 0, 0.8)',
    videoControlsLight: 'rgba(0, 0, 0, 0.6)',
    folderIcon: '#4F8FF7',
  },
};

type Theme = typeof lightTheme;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  toggleTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(lightTheme);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'dark') {
          setTheme(darkTheme);
        } else if (saved === 'light') {
          setTheme(lightTheme);
        }
      } catch (error) {
        console.warn('Failed to load theme from storage:', error);
        // Fallback to light theme
        setTheme(lightTheme);
      }
    };

    loadTheme();
  }, []);

  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem(THEME_KEY, theme.mode);
      } catch (error) {
        console.warn('Failed to save theme to storage:', error);
      }
    };

    saveTheme();
  }, [theme.mode]);

  const toggleTheme = () => {
    setTheme((prev) => (prev.mode === 'light' ? darkTheme : lightTheme));
  };

  const contextValue: ThemeContextType = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}; 