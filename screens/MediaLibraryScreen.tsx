import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, StyleSheet, Dimensions, Modal, BackHandler } from 'react-native';
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

type Props = StackScreenProps<RootStackParamList, 'MediaLibrary'>;

const { width: screenWidth } = Dimensions.get('window');

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const MediaLibraryScreen: React.FC<Props> = ({ navigation, route }) => {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(RNFS.ExternalStorageDirectoryPath);
  const [currentItems, setCurrentItems] = useState<Array<FolderNode | VideoFile>>([]);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('fileSize');
  const { theme, toggleTheme } = useTheme();

  // Handle navigation parameters
  useEffect(() => {
    if (route.params?.resetToRoot) {
      navigateToRoot();
      // Clear the parameter to prevent repeated resets
      navigation.setParams({ resetToRoot: undefined });
    }
    if (route.params?.showFilters) {
      setShowFiltersModal(true);
      // Clear the parameter to prevent repeated opens
      navigation.setParams({ showFilters: undefined });
    }
  }, [route.params?.resetToRoot, route.params?.showFilters]);

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

  useEffect(() => {
    const onBackPress = () => {
      if (currentPath !== RNFS.ExternalStorageDirectoryPath) {
        // Go to previous folder
        if (pathHistory.length > 0) {
          setCurrentPath(pathHistory[pathHistory.length - 1]);
          setPathHistory(pathHistory.slice(0, -1));
        } else {
          setCurrentPath(RNFS.ExternalStorageDirectoryPath);
        }
        return true; // Prevent default behavior (app exit)
      } else if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }
      return false; // Allow default behavior (app exit)
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentPath, pathHistory, navigation]);

  const loadCurrentDirectory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const items = await RNFS.readDir(currentPath);
      const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', '3gp', 'mpeg', 'mpg', 'm4v'];
      
      const folders: FolderNode[] = [];
      const videos: VideoFile[] = [];
      
      // Process items in batches to avoid blocking the UI
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        for (const item of batch) {
          try {
            if (item.isDirectory()) {
              // Check if folder contains videos (with timeout)
              try {
                const subItems = await Promise.race([
                  RNFS.readDir(item.path),
                  new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 2000)
                  )
                ]) as RNFS.ReadDirItem[];
                
                const hasVideos = subItems.some((subItem: RNFS.ReadDirItem) => 
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
                // Skip folders we can't access or that timeout
                console.warn(`Skipping folder ${item.name}:`, e);
              }
            } else if (item.isFile() && videoExtensions.includes(item.name.split('.').pop()?.toLowerCase() || '')) {
              // Get file stats for additional information
              try {
                const stats = await RNFS.stat(item.path);
                const fileSize = formatFileSize(stats.size);
                const lastModified = new Date(stats.mtime).toLocaleDateString();
                
                videos.push({
                  name: item.name,
                  path: item.path,
                  isFile: true,
                  fileSize,
                  lastModified,
                  resolution: 'Unknown', // Will be updated later if needed
                  duration: 'Unknown'    // Will be updated later if needed
                });
              } catch (e) {
                // Fallback if stats can't be read
                videos.push({
                  name: item.name,
                  path: item.path,
                  isFile: true
                });
              }
            }
          } catch (e) {
            console.warn(`Error processing item ${item.name}:`, e);
          }
        }
        
        // Allow UI to update between batches
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Sort folders first, then videos, both alphabetically
      const sortedItems = [
        ...folders.sort((a, b) => a.name.localeCompare(b.name)),
        ...videos.sort((a, b) => a.name.localeCompare(b.name))
      ];
      
      setCurrentItems(sortedItems);
    } catch (e) {
      console.error('Failed to load directory contents:', e);
      setError('Failed to load directory contents. Please check your storage permissions.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(folderPath);
  };

  const navigateToRoot = () => {
    setCurrentPath(RNFS.ExternalStorageDirectoryPath);
    setPathHistory([]);
  };

  const handleVideoPress = (video: VideoFile) => {
    navigation.navigate('VideoPlayer', { path: video.path, name: video.name });
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
        {item.isFile ? (
          <View style={[
            styles.iconContainer,
            { backgroundColor: theme.colors.accent + '20' }
          ]}>
            <Icon 
              name="play-circle" 
              size={32} 
              color={theme.colors.accent} 
            />
          </View>
        ) : (
          <View style={[
            styles.iconContainer,
            { backgroundColor: theme.colors.accent + '20' }
          ]}>
            <Icon 
              name="folder" 
              size={32} 
              color={theme.colors.accent} 
            />
          </View>
        )}
        
        <View style={styles.itemTextContainer}>
          <Text 
            style={[styles.itemTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.isFile && (
            <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
              {selectedFilter === 'fileSize' && (item.fileSize ? `${item.fileSize}` : 'Loading...')}
              {selectedFilter === 'lastModified' && (item.lastModified ? `${item.lastModified}` : 'Unknown')}
              {selectedFilter === 'resolution' && (item.resolution ? `${item.resolution}` : 'Unknown')}
              {selectedFilter === 'duration' && (item.duration ? `${item.duration}` : 'Unknown')}
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

      {/* Filters Modal */}
      <Modal
        visible={showFiltersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Display Options</Text>
              <TouchableOpacity
                onPress={() => setShowFiltersModal(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedFilter === 'fileSize' && { backgroundColor: theme.colors.primary + '20' }
                ]}
                onPress={() => {
                  setSelectedFilter('fileSize');
                  setShowFiltersModal(false);
                }}
              >
                <Icon 
                  name="storage" 
                  size={20} 
                  color={selectedFilter === 'fileSize' ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.filterOptionText,
                  { color: selectedFilter === 'fileSize' ? theme.colors.primary : theme.colors.text }
                ]}>
                  File Size
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedFilter === 'lastModified' && { backgroundColor: theme.colors.primary + '20' }
                ]}
                onPress={() => {
                  setSelectedFilter('lastModified');
                  setShowFiltersModal(false);
                }}
              >
                <Icon 
                  name="schedule" 
                  size={20} 
                  color={selectedFilter === 'lastModified' ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.filterOptionText,
                  { color: selectedFilter === 'lastModified' ? theme.colors.primary : theme.colors.text }
                ]}>
                  Last Modified
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedFilter === 'resolution' && { backgroundColor: theme.colors.primary + '20' }
                ]}
                onPress={() => {
                  setSelectedFilter('resolution');
                  setShowFiltersModal(false);
                }}
              >
                <Icon 
                  name="aspect-ratio" 
                  size={20} 
                  color={selectedFilter === 'resolution' ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.filterOptionText,
                  { color: selectedFilter === 'resolution' ? theme.colors.primary : theme.colors.text }
                ]}>
                  Resolution
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedFilter === 'duration' && { backgroundColor: theme.colors.primary + '20' }
                ]}
                onPress={() => {
                  setSelectedFilter('duration');
                  setShowFiltersModal(false);
                }}
              >
                <Icon 
                  name="timer" 
                  size={20} 
                  color={selectedFilter === 'duration' ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.filterOptionText,
                  { color: selectedFilter === 'duration' ? theme.colors.primary : theme.colors.text }
                ]}>
                  Duration
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  filterOptions: {
    gap: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MediaLibraryScreen; 