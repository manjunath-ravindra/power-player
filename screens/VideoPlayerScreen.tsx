import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Dimensions, StatusBar } from 'react-native';
import Slider from '@react-native-community/slider';
import Video from 'react-native-video';
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
  MediaLibrary: undefined;
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
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    // Only auto-hide if video is playing and controls weren't manually toggled
    if (!paused && !controlsManuallyToggled) {
      controlsTimeout.current = setTimeout(() => setControlsVisible(false), settings.controlTimeout * 1000);
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
      controlsTimeout.current = setTimeout(() => setControlsVisible(false), settings.controlTimeout * 1000);
    }
  }, [paused, controlsVisible, controlsManuallyToggled, settings.controlTimeout]);

  // Tap to show/hide controls - now works on entire screen except control areas
  const handleOverlayPress = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      setControlsManuallyToggled(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      setControlsVisible(true);
      setControlsManuallyToggled(false);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={isLandscape ? ['top'] : ['top', 'left', 'right']}>
      {controlsVisible && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: '#fff' }]} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
          <TouchableOpacity style={styles.speedButton} onPress={handleSpeedPress}>
            <Icon name="speed" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      

      
      <GestureOverlay
        onSeek={dx => handleSeek(dx * settings.seekSensitivity)}
        onDoubleTap={handleDoubleTap}
        onDoubleTapCenter={() => setPaused(p => !p)}
        onVerticalSwipe={settings.volumeGesture || settings.brightnessGesture ? handleVerticalSwipe : undefined}
        onTap={handleOverlayPress}
        passGestureState
        excludeAreas={getExcludedAreas()}
        onLandscapeTap={isLandscape ? handleLandscapeTap : undefined}
        // videoBounds={videoBounds}
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
          />
        </View>
        {/* Feedback overlays */}
        {seekFeedback && (
          <View
            style={[
              styles.feedbackCard,
              seekFeedback.startsWith('+')
                ? styles.seekFeedbackRight
                : styles.seekFeedbackLeft,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.feedbackText}>{seekFeedback}</Text>
          </View>
        )}
        {volumeFeedback && (
          <View style={[styles.feedbackCard, styles.volumeFeedbackLeft]} pointerEvents="none">
            <Icon name="volume-up" size={28} color="#fff" style={{ marginBottom: 4 }} />
            <Text style={styles.feedbackText}>{volumeFeedback}</Text>
          </View>
        )}
        {brightnessFeedback && (
          <View style={[styles.feedbackCard, styles.brightnessFeedbackRight]} pointerEvents="none">
            <Icon name="brightness-6" size={28} color="#fff" style={{ marginBottom: 4 }} />
            <Text style={styles.feedbackText}>{brightnessFeedback}</Text>
          </View>
        )}
      </GestureOverlay>
      
      {/* Combined controls container with shared background */}
      {controlsVisible && (
        <View style={styles.controlsContainer}>
          {/* Progress bar */}
          <View style={styles.progressBarRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.progressBar}
                value={currentTime}
                minimumValue={0}
                maximumValue={duration}
                onValueChange={handleSeekBarChange}
                minimumTrackTintColor="#fff"
                maximumTrackTintColor="#666"
                thumbTintColor="#fff"
                tapToSeek={true}
              />
            </View>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
          
          {/* Control buttons */}
          <View style={styles.controlBar}>
            <TouchableOpacity 
              onPress={handleOrientationToggle} 
              style={styles.controlBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name={isLandscape ? "screen-rotation" : "screen-lock-rotation"} size={36} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSeek(-10)} style={styles.controlBtn}>
              <Icon name="replay-10" size={36} color="#fff" />
            </TouchableOpacity>
                      <TouchableOpacity onPress={() => setPaused(p => !p)} style={styles.controlBtn}>
            <Icon name={paused ? 'play-arrow' : 'pause'} size={42} color="#fff" />
          </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSeek(10)} style={styles.controlBtn}>
              <Icon name="forward-10" size={36} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.controlBtn}>
              <Icon name="settings" size={36} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  container: { flex: 1, backgroundColor: '#000' },
  gestureContainer: { flex: 1, width: '100%', height: '100%' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.6)', width: '100%' },
  backButton: { padding: 8 },
  title: { flex: 1, color: '#fff', fontSize: 16, textAlign: 'center', marginHorizontal: 16 },
  speedButton: { padding: 8 },
  video: { flex: 1, width: '100%' },
  controlsContainer: { position: 'absolute', bottom: 16, left: 0, right: 0, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
  controlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 4, paddingBottom: 8, paddingHorizontal: 16 },
  controlBtn: { padding: 12, alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  progressBar: { flex: 1, marginHorizontal: 8 },
  sliderContainer: { flex: 1, paddingVertical: 12, justifyContent: 'center' },
  timeText: { color: '#fff', fontSize: 12, width: 40, textAlign: 'center' },
  feedbackCard: { borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', maxWidth: 220, minWidth: 120 },
  feedbackText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  seekFeedbackLeft: { position: 'absolute', top: '50%', left: '15%', alignItems: 'flex-start', zIndex: 10, justifyContent: 'center', transform: [{ translateY: -50 }] },
  seekFeedbackRight: { position: 'absolute', top: '50%', right: '15%', alignItems: 'flex-end', zIndex: 10, justifyContent: 'center', transform: [{ translateY: -50 }] },
  volumeFeedbackLeft: { position: 'absolute', top: '50%', left: '15%', alignItems: 'flex-start', zIndex: 10, justifyContent: 'center', transform: [{ translateY: -50 }] },
  brightnessFeedbackRight: { position: 'absolute', top: '50%', right: '15%', alignItems: 'flex-end', zIndex: 10, justifyContent: 'center', transform: [{ translateY: -50 }] },
  brightnessTestRow: { position: 'absolute', bottom: 32, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', zIndex: 20 },
  brightnessTestBtn: { backgroundColor: '#333', padding: 10, marginHorizontal: 8, borderRadius: 6 },
});

export default VideoPlayerScreen; 