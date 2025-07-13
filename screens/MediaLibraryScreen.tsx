import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { requestStoragePermission } from '../utils/permissions';
import { scanForVideos, FolderNode, VideoFile } from '../utils/videoScanner';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from './VideoPlayerScreen';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { useFocusEffect } from '@react-navigation/native';
import brightnessManager from '../utils/brightnessManager';

type Props = StackScreenProps<any, 'MediaLibrary'>;

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Requesting storage permission...</Text>
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Storage permission denied. Please enable it in settings to use the media library.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ color: theme.colors.text }}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>{error}</Text>
        <TouchableOpacity onPress={loadCurrentDirectory} style={{ marginTop: 16, padding: 12, backgroundColor: theme.colors.primary, borderRadius: 8 }}>
          <Text style={{ color: theme.colors.background }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: { item: FolderNode | VideoFile }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: theme.colors.background
      }}
      onPress={() => item.isFile ? handleVideoPress(item) : navigateToFolder(item.path)}
    >
      <Icon 
        name={item.isFile ? 'video-file' : 'folder'} 
        size={24} 
        color={item.isFile ? theme.colors.primary : '#FFD700'} 
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text 
          style={{ 
            color: theme.colors.text, 
            fontSize: 16,
            fontWeight: item.isFile ? 'normal' : 'bold'
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.isFile && (
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
            Video file
          </Text>
        )}
      </View>
      {!item.isFile && (
        <Icon name="chevron-right" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Path Navigation Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: theme.colors.background
      }}>
        <TouchableOpacity
          onPress={navigateToRoot}
          style={{ marginRight: 12 }}
        >
          <Icon name="home" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        
        {pathHistory.length > 0 && (
          <TouchableOpacity
            onPress={navigateBack}
            style={{ marginRight: 12 }}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: 'bold' }}>
            {getPathDisplay()}
          </Text>
        </View>
      </View>

      {/* Content */}
      {currentItems.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="folder-open" size={64} color="#666" />
          <Text style={{ color: theme.colors.text, fontSize: 16, marginTop: 16 }}>
            No videos found in this folder
          </Text>
          <Text style={{ color: '#666', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            Navigate to folders that contain video files
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.path}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default MediaLibraryScreen; 