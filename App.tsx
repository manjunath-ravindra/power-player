/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MediaLibraryScreen from './screens/MediaLibraryScreen';
import VideoPlayerScreen from './screens/VideoPlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './components/SplashScreen';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import type { RootStackParamList } from './screens/VideoPlayerScreen';
import { SettingsProvider } from './settings/SettingsContext';
import brightnessManager from './utils/brightnessManager';

// Extend RootStackParamList to include Settings
export type AppStackParamList = RootStackParamList & {
  Settings: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();

// Enhanced header buttons component
const HeaderButtons = ({ navigation }: { navigation: any }) => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <View style={styles.headerButtons}>
      <TouchableOpacity
        style={[styles.headerButton, { backgroundColor: theme.colors.primary + '20' }]}
        onPress={toggleTheme}
        activeOpacity={0.7}
      >
        <Icon 
          name={theme.mode === 'light' ? 'dark-mode' : 'light-mode'} 
          size={20} 
          color={theme.colors.primary} 
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerButton, { backgroundColor: theme.colors.primary + '20' }]}
        onPress={() => {
          // Open filters modal
          navigation.navigate('MediaLibrary', { showFilters: true });
        }}
        activeOpacity={0.7}
      >
        <Icon name="filter-list" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerButton, { backgroundColor: theme.colors.primary + '20' }]}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.7}
      >
        <Icon name="settings" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const App = () => {
  const navigationRef = useRef<any>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize brightness manager and start periodic syncing
      brightnessManager.startPeriodicSync();
      
      // Ensure status bar is visible for non-video screens
      StatusBar.setHidden(false);
    };

    initializeApp();
    
    return () => {
      // Cleanup brightness manager
      brightnessManager.cleanup();
    };
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return (
      <SettingsProvider>
        <ThemeProvider>
          <SplashScreen onFinish={handleSplashFinish} />
        </ThemeProvider>
      </SettingsProvider>
    );
  }

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
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              },
              headerTintColor: theme.colors.text,
              headerTitleStyle: {
                color: theme.colors.text,
                fontSize: 18,
                fontWeight: '600',
              },
              headerTitleAlign: 'center' as const,
              cardStyle: {
                backgroundColor: theme.colors.background,
              },
            };
          }}
        >
          <Stack.Screen 
            name="MediaLibrary" 
            component={MediaLibraryScreen} 
            options={({ navigation }) => ({
              title: 'Power Player',
              headerRight: () => <HeaderButtons navigation={navigation} />,
              headerLeft: () => (
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: theme.colors.primary + '20' }]}
                  onPress={() => {
                    // Navigate to root directory by passing a reset parameter
                    navigation.navigate('MediaLibrary', { resetToRoot: true });
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name="home" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen 
            name="VideoPlayer" 
            component={VideoPlayerScreen} 
            options={{ 
              headerShown: false,
              gestureEnabled: false,
            }} 
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen} 
            options={{ 
              title: 'Settings',
              headerTitleStyle: {
                color: theme.colors.text,
                fontSize: 18,
                fontWeight: '600',
              },
            }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

});

export default App;
