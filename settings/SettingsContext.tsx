import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'user_settings';

export type Settings = {
  volumeGesture: boolean;
  brightnessGesture: boolean;
  seekSensitivity: number;
  volumeSensitivity: number;
  brightnessSensitivity: number;
  controlTimeout: number;
};

const defaultSettings: Settings = {
  volumeGesture: true,
  brightnessGesture: true,
  seekSensitivity: 0.2,
  volumeSensitivity: 0.05,
  brightnessSensitivity: 0.05,
  controlTimeout: 3,
};

const SettingsContext = createContext({
  settings: defaultSettings,
  setSettings: (s: Settings) => {},
  updateSetting: (key: keyof Settings, value: any) => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}; 