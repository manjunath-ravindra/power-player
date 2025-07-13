import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Dimensions, StatusBar, Animated, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import Video, { SelectedTrack, SelectedTrackType } from 'react-native-video';
import { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../App';
import GestureOverlay from '../components/GestureOverlay';
import SystemSetting from 'react-native-system-setting';
import { useSettings } from '../settings/SettingsContext';
import Orientation from 'react-native-orientation-locker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import brightnessManager from '../utils/brightnessManager';

export type RootStackParamList = {
  MediaLibrary: { resetToRoot?: boolean; showFilters?: boolean } | undefined;
  VideoPlayer: { path: string; name: string };
};

type Props = StackScreenProps<AppStackParamList, 'VideoPlayer'>;

const SEEK_STEP = 10; // seconds for double-tap
const SPEEDS = [0.5, 1, 1.5, 2];
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const { path, name } = route.params;
  const videoRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [volumeFeedback, setVolumeFeedback] = useState<string | null>(null);
  const [brightnessFeedback, setBrightnessFeedback] = useState<string | null>(null);
  const [speedIndex, setSpeedIndex] = useState(1); // 1x by default
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null);
  const volumeTimeout = useRef<NodeJS.Timeout | null>(null);
  const brightnessTimeout = useRef<NodeJS.Timeout | null>(null);
  const { settings } = useSettings();
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number} | null>(null);
  const { theme } = useTheme();
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const [paused, setPaused] = useState(false);
  const [controlsManuallyToggled, setControlsManuallyToggled] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [videoBounds, setVideoBounds] = useState<{x: number, y: number, width: number, height: number} | undefined>(undefined);
  const [subtitlesModalVisible, setSubtitlesModalVisible] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState<string[]>(['None']); // Placeholder, will be populated from video metadata
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('None');
  const [textTracks, setTextTracks] = useState<any[]>([]); // Store full textTracks from video
  const [subtitleLabels, setSubtitleLabels] = useState<string[]>(['None']); // Unique labels for modal

  // Animation values for smooth transitions
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const feedbackScale = useRef(new Animated.Value(0)).current;

  // Track start values for gestures
  const gestureStartVolume = useRef<number>(0);
  const gestureStartBrightness = useRef<number>(0);
  const gestureActiveSide = useRef<'left' | 'right' | null>(null);
  const gestureStartTranslationY = useRef<number>(0);
  // Track last set volume for correct gesture behavior
  const lastSetVolume = useRef<number>(0);

  React.useEffect(() => {
    // Initialize lastSetVolume on mount
    SystemSetting.getVolume('music').then(v => { lastSetVolume.current = v; });
    
    // Notify brightness manager that we're entering video player
    brightnessManager.enterVideoPlayer();
    
    return () => {
      // Notify brightness manager that we're exiting video player
      brightnessManager.exitVideoPlayer();
    };
  }, []);

  // Auto-hide controls after user-defined timeout (only when playing and not manually toggled)
  const showControls = () => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    // Only auto-hide if video is playing and controls weren't manually toggled
    if (!paused && !controlsManuallyToggled) {
      controlsTimeout.current = setTimeout(() => {
        setControlsVisible(false);
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, settings.controlTimeout * 1000);
    }
  };

  // Show controls on mount
  React.useEffect(() => {
    showControls();
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, []);

  // Handle auto-hide when video state changes from paused to playing
  React.useEffect(() => {
    if (!paused && controlsVisible && !controlsManuallyToggled) {
      // Video just started playing, start auto-hide timer
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => {
        setControlsVisible(false);
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, settings.controlTimeout * 1000);
    }
  }, [paused, controlsVisible, controlsManuallyToggled, settings.controlTimeout]);

  // Tap to show/hide controls - now works on entire screen except control areas
  const handleOverlayPress = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      setControlsManuallyToggled(true);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      setControlsVisible(true);
      setControlsManuallyToggled(false);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    }
  };

  // Seek bar drag
  const handleSeekBarChange = (value: number) => {
    videoRef.current?.seek(value);
    setCurrentTime(value);
  };

  const handleSeek = (deltaSeconds: number) => {
    let newTime = Math.max(0, Math.min(currentTime + deltaSeconds, duration));
    videoRef.current?.seek(newTime);
    setSeekFeedback(`${deltaSeconds > 0 ? '+' : ''}${Math.round(deltaSeconds)}s`);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setSeekFeedback(null), 800);
    showControls(); // Show controls when seeking
  };

  const handleDoubleTap = (direction: 'left' | 'right') => {
    const delta = direction === 'left' ? -SEEK_STEP : SEEK_STEP;
    handleSeek(delta);
    setSeekFeedback(`${direction === 'left' ? '-' : '+'}${SEEK_STEP}s`);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setSeekFeedback(null), 800);
    showControls(); // Show controls when seeking
  };

  // Handle landscape-specific tap gestures for rewind, play/pause, fast forward
  const handleLandscapeTap = (x: number) => {
    if (!isLandscape) return;
    
    // The GestureOverlay already handles 1/3 divisions, so we just need to determine which third
    const { width } = Dimensions.get('window');
    const leftThird = width * 0.333; // 33.3% of screen width
    const rightThird = width * 0.667; // 66.7% of screen width
    
    if (x < leftThird) {
      // Left third - rewind
      handleSeek(-10);
      setSeekFeedback('-10s');
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setSeekFeedback(null), 800);
    } else if (x > rightThird) {
      // Right third - fast forward
      handleSeek(10);
      setSeekFeedback('+10s');
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setSeekFeedback(null), 800);
    } else {
      // Middle third - play/pause
      setPaused(p => !p);
    }
  };

  // Modified handler to receive gesture state
  const handleVerticalSwipe = async (translationY: number, side: 'left' | 'right', gestureState?: 'BEGAN' | 'ACTIVE' | 'END') => {
    const { volumeGesture, brightnessGesture } = settings;
    // Both disabled: do nothing
    if (!volumeGesture && !brightnessGesture) return;

    // Only brightness enabled: both sides control brightness
    if (!volumeGesture && brightnessGesture) side = 'left';
    // Only volume enabled: both sides control volume
    if (volumeGesture && !brightnessGesture) side = 'right';
    // If both enabled: left=brightness, right=volume (default)

    if (side === 'right' && volumeGesture) {
      if (gestureState === 'BEGAN') {
        gestureStartVolume.current = lastSetVolume.current;
        gestureActiveSide.current = 'right';
        gestureStartTranslationY.current = translationY;
      } else if (gestureState === 'ACTIVE' && gestureActiveSide.current === 'right') {
        const deltaY = translationY - gestureStartTranslationY.current;
        let newVolume = Math.max(0, Math.min(1, gestureStartVolume.current - deltaY * settings.volumeSensitivity / 100));
        await SystemSetting.setVolume(newVolume, { type: 'music', playSound: false, showUI: false });
        lastSetVolume.current = newVolume; // Track last set value
        setVolumeFeedback(`${Math.round(newVolume * 100)}%`);
        if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
        volumeTimeout.current = setTimeout(() => setVolumeFeedback(null), 800);
      } else if (gestureState === 'END') {
        gestureActiveSide.current = null;
        gestureStartTranslationY.current = 0;
      }
    } else if (side === 'left' && brightnessGesture) {
      if (gestureState === 'BEGAN') {
        gestureStartBrightness.current = await SystemSetting.getAppBrightness();
        gestureActiveSide.current = 'left';
        gestureStartTranslationY.current = translationY;
      } else if (gestureState === 'ACTIVE' && gestureActiveSide.current === 'left') {
        const deltaY = translationY - gestureStartTranslationY.current;
        let newBrightness = Math.max(0, Math.min(1, gestureStartBrightness.current - deltaY * settings.brightnessSensitivity / 100));
        await SystemSetting.setAppBrightness(newBrightness);
        setBrightnessFeedback(`${Math.round(newBrightness * 100)}%`);
        if (brightnessTimeout.current) clearTimeout(brightnessTimeout.current);
        brightnessTimeout.current = setTimeout(() => setBrightnessFeedback(null), 800);
      } else if (gestureState === 'END') {
        gestureActiveSide.current = null;
        gestureStartTranslationY.current = 0;
      }
    }
  };

  const handleSpeedPress = () => {
    setSpeedIndex((prev) => (prev + 1) % SPEEDS.length);
    showControls(); // Show controls when changing speed
  };

  const handleOrientationToggle = () => {
    if (isLandscape) {
      Orientation.lockToPortrait();
      setIsLandscape(false);
      StatusBar.setHidden(false);
    } else {
      Orientation.lockToLandscape();
      setIsLandscape(true);
      StatusBar.setHidden(true);
    }
    showControls(); // Show controls when changing orientation
  };

  // Lock orientation based on aspect ratio when video loads
  const handleVideoLoad = (data: any) => {
    setDuration(data.duration);
    if (data.naturalSize && data.naturalSize.width && data.naturalSize.height) {
      setVideoDimensions({ width: data.naturalSize.width, height: data.naturalSize.height });
      // Only auto-orient if user hasn't manually toggled
      if (!isLandscape && data.naturalSize.width > data.naturalSize.height) {
        Orientation.lockToLandscape();
        setIsLandscape(true);
        StatusBar.setHidden(true);
      } else if (!isLandscape && data.naturalSize.width <= data.naturalSize.height) {
        Orientation.lockToPortrait();
        setIsLandscape(false);
        StatusBar.setHidden(false);
      }
    }
    // Store textTracks for subtitle support
    if (data.textTracks && data.textTracks.length > 0) {
      setTextTracks(data.textTracks);
      // Generate unique, user-friendly labels
      const labels = data.textTracks.map((t: any, i: number) => {
        if (t.title && t.title.trim()) return t.title;
        if (t.language && t.language.trim()) return t.language;
        return `Embedded ${i + 1}`;
      });
      setSubtitleLabels(['None', ...labels]);
      // Always pre-select the first available subtitle if present
      if (labels.length > 0) {
        setSelectedSubtitle(labels[0]);
      } else {
        setSelectedSubtitle('None');
      }
    } else {
      setTextTracks([]);
      setSubtitleLabels(['None']);
      setSelectedSubtitle('None');
    }
  };

  // Calculate video bounds when video dimensions change
  React.useEffect(() => {
    if (videoDimensions) {
      const videoAspectRatio = videoDimensions.width / videoDimensions.height;
      const screenAspectRatio = screenWidth / screenHeight;
      
      let videoWidth, videoHeight, videoX, videoY;
      
      if (videoAspectRatio > screenAspectRatio) {
        // Video is wider than screen - letterboxing on top/bottom
        videoWidth = screenWidth;
        videoHeight = screenWidth / videoAspectRatio;
        videoX = 0;
        videoY = (screenHeight - videoHeight) / 2;
      } else {
        // Video is taller than screen - letterboxing on left/right
        videoHeight = screenHeight;
        videoWidth = screenHeight * videoAspectRatio;
        videoX = (screenWidth - videoWidth) / 2;
        videoY = 0;
      }
      
      const bounds = { x: videoX, y: videoY, width: videoWidth, height: videoHeight };
      console.log('Video bounds:', bounds);
      setVideoBounds(bounds);
    }
  }, [videoDimensions, screenWidth, screenHeight]);

  React.useEffect(() => {
    // On unmount: if auto-rotate is enabled, unlock orientation; else, force portrait
    return () => {
      StatusBar.setHidden(false);
      Orientation.getAutoRotateState((autoRotateEnabled: boolean) => {
        if (autoRotateEnabled) {
          Orientation.unlockAllOrientations();
        } else {
          Orientation.lockToPortrait();
        }
      });
    };
  }, []);

  // Get excluded areas for gesture overlay
  const getExcludedAreas = () => {
    const areas = [];
    
    // Control bar area (bottom area)
    areas.push({ top: screenHeight - 120, bottom: screenHeight, left: 0, right: screenWidth });
    
    // Progress bar area (bottom area)
    areas.push({ top: screenHeight - 60, bottom: screenHeight, left: 0, right: screenWidth });
    
    // Top buttons area (top area)
    areas.push({ top: 0, bottom: 80, left: 0, right: screenWidth });
    
    return areas;
  };

  // Map selectedSubtitle to selectedTextTrack prop using index
  let selectedTextTrack: SelectedTrack = { type: SelectedTrackType.DISABLED };
  if (selectedSubtitle !== 'None' && textTracks.length > 0) {
    const idx = subtitleLabels.findIndex(s => s === selectedSubtitle) - 1; // -1 because 'None' is first
    if (idx >= 0) {
      selectedTextTrack = { type: SelectedTrackType.INDEX, value: idx };
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={isLandscape ? ['top'] : ['top', 'left', 'right']}>
      {/* Header Controls */}
      <Animated.View style={[styles.headerContainer, { opacity: controlsOpacity, top: isLandscape ? 0 : 32 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
          <TouchableOpacity style={styles.speedButton} onPress={handleSpeedPress}>
            <View style={styles.speedBadge}>
              <Text style={styles.speedText}>{SPEEDS[speedIndex]}x</Text>
            </View>
          </TouchableOpacity>
          {/* Subtitles Button */}
          <TouchableOpacity style={styles.subtitlesButton} onPress={() => setSubtitlesModalVisible(true)}>
            <Icon name="subtitles" size={28} color={selectedSubtitle !== 'None' ? theme.colors.primary : '#fff'} />
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      <GestureOverlay
        onSeek={dx => handleSeek(dx * settings.seekSensitivity)}
        onDoubleTap={handleDoubleTap}
        onDoubleTapCenter={() => setPaused(p => !p)}
        onVerticalSwipe={settings.volumeGesture || settings.brightnessGesture ? handleVerticalSwipe : undefined}
        onTap={handleOverlayPress}
        passGestureState
        excludeAreas={getExcludedAreas()}
        onLandscapeTap={isLandscape ? handleLandscapeTap : undefined}
      >
        <View style={styles.gestureContainer}>
          <Video
            ref={videoRef}
            source={{ uri: 'file://' + path }}
            style={styles.video}
            controls={false}
            paused={paused}
            resizeMode="contain"
            onProgress={e => setCurrentTime(e.currentTime)}
            onLoad={handleVideoLoad}
            rate={SPEEDS[speedIndex]}
            textTracks={textTracks}
            selectedTextTrack={selectedTextTrack}
          />
        </View>
        
        {/* Enhanced Feedback Overlays */}
        {seekFeedback && (
          <View
            style={[
              seekFeedback.startsWith('+')
                ? styles.seekFeedbackRight
                : styles.seekFeedbackLeft,
            ]}
            pointerEvents="none"
          >
            <Icon 
              name={seekFeedback.startsWith('+') ? 'fast-forward' : 'fast-rewind'} 
              size={32} 
              color="#fff" 
              style={styles.feedbackIcon}
            />
            <Text style={styles.feedbackText}>{seekFeedback}</Text>
          </View>
        )}
        
        {volumeFeedback && (
          <Animated.View 
            style={[styles.feedbackCard, styles.volumeFeedbackCard, styles.volumeFeedbackLeft]} 
            pointerEvents="none"
          >
            <Icon name="volume-up" size={32} color="#fff" style={styles.feedbackIcon} />
            <Text style={styles.feedbackText}>{volumeFeedback}</Text>
          </Animated.View>
        )}
        
        {brightnessFeedback && (
          <Animated.View 
            style={[styles.feedbackCard, styles.brightnessFeedbackCard, styles.brightnessFeedbackRight]} 
            pointerEvents="none"
          >
            <Icon name="brightness-6" size={32} color="#fff" style={styles.feedbackIcon} />
            <Text style={styles.feedbackText}>{brightnessFeedback}</Text>
          </Animated.View>
        )}
      </GestureOverlay>
      
      {/* Enhanced Controls Container */}
      <Animated.View style={[styles.controlsContainer, { opacity: controlsOpacity }]}>
        {/* Progress Bar */}
        <View style={styles.progressBarRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.progressBar}
              value={currentTime}
              minimumValue={0}
              maximumValue={duration}
              onValueChange={handleSeekBarChange}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={theme.colors.primary}
              tapToSeek={true}
            />
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        
        {/* Control Buttons */}
        <View style={styles.controlBar}>
          <TouchableOpacity 
            onPress={handleOrientationToggle} 
            style={styles.controlBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.controlBtnBackground}>
              <Icon name={isLandscape ? "screen-rotation" : "screen-lock-rotation"} size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => handleSeek(-10)} style={styles.controlBtn}>
            <View style={styles.controlBtnBackground}>
              <Icon name="replay-10" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setPaused(p => !p)} style={styles.playPauseBtn}>
            <View style={styles.playPauseBackground}>
              <Icon name={paused ? 'play-arrow' : 'pause'} size={36} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => handleSeek(10)} style={styles.controlBtn}>
            <View style={styles.controlBtnBackground}>
              <Icon name="forward-10" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.controlBtn}>
            <View style={styles.controlBtnBackground}>
              <Icon name="settings" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
      {/* Subtitles Modal */}
      <Modal
        visible={subtitlesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubtitlesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* TouchableOpacity to close modal when clicking outside content */}
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSubtitlesModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Subtitles</Text>
            {subtitleLabels.map((label, idx) => (
              <TouchableOpacity
                key={label + idx}
                style={[styles.subtitleOption, selectedSubtitle === label && styles.selectedSubtitleOption]}
                onPress={() => {
                  setSelectedSubtitle(label);
                  setSubtitlesModalVisible(false);
                }}
              >
                <Text style={{ color: selectedSubtitle === label ? theme.colors.primary : theme.colors.text }}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeModalButton} onPress={() => setSubtitlesModalVisible(false)}>
              <Text style={{ color: theme.colors.text }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Add helper for formatting time
function formatTime(sec: number) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  gestureContainer: { 
    flex: 1, 
    width: '100%', 
    height: '100%' 
  },
  headerContainer: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: { 
    flex: 1, 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
    textAlign: 'center', 
    marginHorizontal: 16 
  },
  speedButton: { 
    padding: 4 
  },
  speedBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  video: { 
    flex: 1, 
    width: '100%' 
  },
  controlsContainer: { 
    position: 'absolute', 
    bottom: 16, 
    left: 16, 
    right: 16, 
    zIndex: 20, 
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    padding: 16,
  },
  controlBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: 16,
  },
  controlBtn: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    minWidth: 48, 
    minHeight: 48 
  },
  controlBtnBackground: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    alignItems: 'center', 
    justifyContent: 'center', 
    minWidth: 64, 
    minHeight: 64 
  },
  playPauseBackground: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 32,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingBottom: 8,
  },
  progressBar: { 
    flex: 1, 
    marginHorizontal: 12,
    height: 4,
  },
  sliderContainer: { 
    flex: 1, 
    paddingVertical: 8, 
    justifyContent: 'center' 
  },
  timeText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '500',
    width: 40, 
    textAlign: 'center' 
  },
  feedbackCard: { 
    borderRadius: 20, 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    alignSelf: 'center', 
    maxWidth: 160, 
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  seekFeedbackCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  volumeFeedbackCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  brightnessFeedbackCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  feedbackText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold',
    marginTop: 4,
  },
  feedbackIcon: {
    marginBottom: 4,
  },
  seekFeedbackLeft: { 
    position: 'absolute', 
    top: '50%', 
    left: '15%', 
    alignItems: 'flex-start', 
    zIndex: 10, 
    justifyContent: 'center', 
    transform: [{ translateY: -50 }] 
  },
  seekFeedbackRight: { 
    position: 'absolute', 
    top: '50%', 
    right: '15%', 
    alignItems: 'flex-end', 
    zIndex: 10, 
    justifyContent: 'center', 
    transform: [{ translateY: -50 }] 
  },
  volumeFeedbackLeft: { 
    position: 'absolute', 
    top: '50%', 
    left: '15%', 
    alignItems: 'flex-start', 
    zIndex: 10, 
    justifyContent: 'center', 
    transform: [{ translateY: -50 }] 
  },
  brightnessFeedbackRight: { 
    position: 'absolute', 
    top: '50%', 
    right: '15%', 
    alignItems: 'flex-end', 
    zIndex: 10, 
    justifyContent: 'center', 
    transform: [{ translateY: -50 }] 
  },
  subtitlesButton: {
    padding: 4,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  modalContent: {
    width: '65%',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    zIndex: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitleOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  selectedSubtitleOption: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  closeModalButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

export default VideoPlayerScreen; 