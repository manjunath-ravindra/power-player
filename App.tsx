/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MediaLibraryScreen from './screens/MediaLibraryScreen';
import VideoPlayerScreen from './screens/VideoPlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import type { RootStackParamList } from './screens/VideoPlayerScreen';
import { SettingsProvider } from './settings/SettingsContext';
import brightnessManager from './utils/brightnessManager';

// Extend RootStackParamList to include Settings
export type AppStackParamList = RootStackParamList & {
  Settings: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();

// Component to render header buttons with theme context
const HeaderButtons = ({ navigation }: { navigation: any }) => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <>
      <TouchableOpacity
        style={{ marginRight: 16 }}
        onPress={toggleTheme}
      >
        <Icon 
          name={theme.mode === 'light' ? 'dark-mode' : 'light-mode'} 
          size={24} 
          color={theme.colors.primary} 
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ marginRight: 16 }}
        onPress={() => navigation.navigate('Settings')}
      >
        <Icon name="settings" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    </>
  );
};

const App = () => {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Initialize brightness manager and start periodic syncing
    brightnessManager.startPeriodicSync();
    
    // Ensure status bar is visible for non-video screens
    StatusBar.setHidden(false);
    
    return () => {
      // Cleanup brightness manager
      brightnessManager.cleanup();
    };
  }, []);

  return (
    <SettingsProvider>
      <ThemeProvider>
        <AppContent navigationRef={navigationRef} />
      </ThemeProvider>
    </SettingsProvider>
  );
};

// Separate component to access theme context
const AppContent = ({ navigationRef }: { navigationRef: any }) => {
  const { theme } = useTheme();

  return (
    <>
            <StatusBar 
        barStyle={theme.mode === 'light' ? 'dark-content' : 'light-content'} 
        backgroundColor="transparent" 
        translucent={true} 
      />
      <NavigationContainer
        ref={navigationRef}
        onStateChange={(state) => {
          // Ensure status bar is visible when not in video player
          const currentRoute = state?.routes[state.index];
          if (currentRoute?.name !== 'VideoPlayer') {
            StatusBar.setHidden(false);
          }
        }}
      >
        <Stack.Navigator 
          initialRouteName="MediaLibrary"
          screenOptions={({ route }) => {
            return {
              headerStyle: {
                backgroundColor: theme.colors.background,
              },
              headerTintColor: theme.colors.text,
              headerTitleStyle: {
                color: theme.colors.text,
              },
            };
          }}
        >
          <Stack.Screen 
            name="MediaLibrary" 
            component={MediaLibraryScreen} 
            options={({ navigation }) => ({
              title: 'Media Library',
              headerRight: () => <HeaderButtons navigation={navigation} />,
            })}
          />
          <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;
