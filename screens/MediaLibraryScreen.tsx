import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import { requestStoragePermission } from '../utils/permissions';
import { scanForVideos, FolderNode, VideoFile } from '../utils/videoScanner';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from './VideoPlayerScreen';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { useFocusEffect } from '@react-navigation/native';
import brightnessManager from '../utils/brightnessManager';
import EmptyState from '../components/EmptyState';

type Props = StackScreenProps<any, 'MediaLibrary'>;

const { width: screenWidth } = Dimensions.get('window');

const MediaLibraryScreen: React.FC<Props> = ({ navigation }) => {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(RNFS.ExternalStorageDirectoryPath);
  const [currentItems, setCurrentItems] = useState<Array<FolderNode | VideoFile>>([]);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    (async () => {
      const granted = await requestStoragePermission();
      setPermissionGranted(granted);
    })();
  }, []);

  useEffect(() => {
    if (permissionGranted) {
      loadCurrentDirectory();
    }
  }, [permissionGranted, currentPath]);

  // Sync brightness when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Ensure brightness is synced with system when returning to this screen
      brightnessManager.exitVideoPlayer();
    }, [])
  );

  const loadCurrentDirectory = async () => {
    setLoading(true);
    try {
      const items = await RNFS.readDir(currentPath);
      const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', '3gp', 'mpeg', 'mpg', 'm4v'];
      
      const folders: FolderNode[] = [];
      const videos: VideoFile[] = [];
      
      for (const item of items) {
        if (item.isDirectory()) {
          // Check if folder contains videos
          try {
            const subItems = await RNFS.readDir(item.path);
            const hasVideos = subItems.some(subItem => 
              subItem.isFile() && videoExtensions.includes(subItem.name.split('.').pop()?.toLowerCase() || '')
            );
            if (hasVideos) {
              folders.push({
                name: item.name,
                path: item.path,
                isFile: false,
                children: []
              });
            }
          } catch (e) {
            // Skip folders we can't access
          }
        } else if (item.isFile() && videoExtensions.includes(item.name.split('.').pop()?.toLowerCase() || '')) {
          videos.push({
            name: item.name,
            path: item.path,
            isFile: true
          });
        }
      }
      
      // Sort folders first, then videos, both alphabetically
      const sortedItems = [
        ...folders.sort((a, b) => a.name.localeCompare(b.name)),
        ...videos.sort((a, b) => a.name.localeCompare(b.name))
      ];
      
      setCurrentItems(sortedItems);
      setError(null);
    } catch (e) {
      setError('Failed to load directory contents.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(folderPath);
  };

  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const newPath = pathHistory[pathHistory.length - 1];
      setCurrentPath(newPath);
      setPathHistory(prev => prev.slice(0, -1));
    }
  };

  const navigateToRoot = () => {
    setCurrentPath(RNFS.ExternalStorageDirectoryPath);
    setPathHistory([]);
  };

  const handleVideoPress = (video: VideoFile) => {
    navigation.navigate('VideoPlayer', { path: video.path, name: video.name });
  };

  const getPathDisplay = () => {
    const pathParts = currentPath.split('/');
    const displayParts = pathParts.slice(-3); // Show last 3 parts
    if (pathParts.length > 3) {
      return `.../${displayParts.join('/')}`;
    }
    return displayParts.join('/');
  };

  if (permissionGranted === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.centerText, { color: theme.colors.text }]}>
            Requesting storage permission...
          </Text>
        </View>
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Storage Permission Required"
          subtitle="Please enable storage permission in settings to access your video files"
          icon="folder-off"
          showAnimation={false}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.centerText, { color: theme.colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <Icon name="error-outline" size={64} color={theme.colors.error} />
          <Text style={[styles.centerText, { color: theme.colors.text, marginTop: 16 }]}>{error}</Text>
          <TouchableOpacity 
            onPress={loadCurrentDirectory} 
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.background }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }: { item: FolderNode | VideoFile }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }
      ]}
      onPress={() => item.isFile ? handleVideoPress(item) : navigateToFolder(item.path)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <View style={[
          styles.iconContainer,
          { 
            backgroundColor: item.isFile 
              ? theme.colors.primary + '20' 
              : theme.colors.accent + '20' 
          }
        ]}>
          <Icon 
            name={item.isFile ? 'video-file' : 'folder'} 
            size={24} 
            color={item.isFile ? theme.colors.primary : theme.colors.accent} 
          />
        </View>
        
        <View style={styles.itemTextContainer}>
          <Text 
            style={[styles.itemTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.isFile && (
            <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
              Video file
            </Text>
          )}
        </View>
        
        {!item.isFile && (
          <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Enhanced Path Navigation Bar */}
      <View style={[
        styles.navigationBar,
        { 
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
        }
      ]}>
        <View style={styles.navigationContent}>
          <TouchableOpacity
            onPress={navigateToRoot}
            style={[styles.navButton, { backgroundColor: theme.colors.primary + '20' }]}
          >
            <Icon name="home" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          
          {pathHistory.length > 0 && (
            <TouchableOpacity
              onPress={navigateBack}
              style={[styles.navButton, { backgroundColor: theme.colors.primary + '20' }]}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          
          <View style={styles.pathContainer}>
            <Text style={[styles.pathText, { color: theme.colors.text }]} numberOfLines={1}>
              {getPathDisplay()}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {currentItems.length === 0 ? (
        <EmptyState
          title="No Videos Found"
          subtitle="Navigate to folders that contain video files to start watching"
          icon="folder-open"
        />
      ) : (
        <FlatList
          data={currentItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.path}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  centerSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navigationBar: {
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pathContainer: {
    flex: 1,
  },
  pathText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  itemSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});

export default MediaLibraryScreen; 