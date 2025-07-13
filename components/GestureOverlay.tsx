import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  PanGestureHandler,
  TapGestureHandler,
  State as GestureState,
} from 'react-native-gesture-handler';

interface GestureOverlayProps {
  onSeek: (deltaSeconds: number) => void;
  onDoubleTap: (direction: 'left' | 'right') => void;
  onDoubleTapCenter?: () => void;
  onVerticalSwipe?: (deltaY: number, side: 'left' | 'right', gestureState?: 'BEGAN' | 'ACTIVE' | 'END') => void;
  onTap?: () => void;
  onLandscapeTap?: (x: number) => void;
  children: React.ReactNode;
  passGestureState?: boolean;
  excludeAreas?: Array<{ top: number; bottom: number; left: number; right: number }>;
  videoBounds?: { x: number; y: number; width: number; height: number };
}

const DOUBLE_TAP_DELAY = 300; // ms
const SEEK_SENSITIVITY = 0.2; // seconds per pixel swiped
const VERTICAL_SWIPE_THRESHOLD = 20; // px

const GestureOverlay: React.FC<GestureOverlayProps> = ({ onSeek, onDoubleTap, onDoubleTapCenter, onVerticalSwipe, onTap, onLandscapeTap, children, passGestureState, excludeAreas = [], videoBounds }) => {
  const lastTap = useRef<number>(0);
  const lastTapX = useRef<number>(0);
  const panStartX = useRef<number | null>(null);
  const panStartY = useRef<number | null>(null);
  const panSide = useRef<'left' | 'right' | null>(null);

  // Get current screen dimensions dynamically
  const getCurrentScreenDimensions = () => {
    return Dimensions.get('window');
  };

  const handlePanGesture = (event: any) => {
    const { translationX, translationY, state, x, y } = event.nativeEvent;
    const { width } = getCurrentScreenDimensions();
    
    if (state === GestureState.BEGAN) {
      // Skip if gesture starts in excluded area
      if (isInExcludedArea(x, y)) {
        return;
      }
      // Only allow pan gestures on video area
      if (!isInVideoArea(x, y)) {
        return;
      }
      panStartX.current = x;
      panStartY.current = y;
      panSide.current = x < width / 2 ? 'left' : 'right';
      if (onVerticalSwipe && passGestureState) {
        onVerticalSwipe(0, panSide.current, 'BEGAN');
      }
    }
    if (state === GestureState.ACTIVE) {
      if (Math.abs(translationX) > Math.abs(translationY)) {
        // Horizontal swipe for seek
        if (Math.abs(translationX) > 20) {
          onSeek(translationX * SEEK_SENSITIVITY);
        }
      } else if (onVerticalSwipe && Math.abs(translationY) > VERTICAL_SWIPE_THRESHOLD && panStartX.current !== null) {
        const side = panSide.current || (panStartX.current < width / 2 ? 'left' : 'right');
        if (passGestureState) {
          onVerticalSwipe(translationY, side, 'ACTIVE');
        } else {
          onVerticalSwipe(translationY, side);
        }
      }
    }
    if (state === GestureState.END || state === GestureState.CANCELLED || state === GestureState.FAILED) {
      if (onVerticalSwipe && passGestureState && panSide.current) {
        onVerticalSwipe(0, panSide.current, 'END');
      }
      panStartX.current = null;
      panStartY.current = null;
      panSide.current = null;
    }
  };

  const isInExcludedArea = (x: number, y: number) => {
    return excludeAreas.some(area => 
      x >= area.left && x <= area.right && y >= area.top && y <= area.bottom
    );
  };

  const isInVideoArea = (x: number, y: number) => {
    // Temporarily disable video bounds check to fix gestures
    return true;
    // if (!videoBounds) return true; // If no bounds provided, assume everything is video area
    // // Add some tolerance to make it work better
    // const tolerance = 10;
    // return x >= videoBounds.x - tolerance && x <= videoBounds.x + videoBounds.width + tolerance &&
    //        y >= videoBounds.y - tolerance && y <= videoBounds.y + videoBounds.height + tolerance;
  };

  const handleTap = (event: any) => {
    if (event.nativeEvent.state === GestureState.END) {
      const now = Date.now();
      const x = event.nativeEvent.x;
      const y = event.nativeEvent.y;
      
      // Skip if tap is in excluded area
      if (isInExcludedArea(x, y)) {
        return;
      }
      
      // Check if this is a double tap
      if (now - lastTap.current < DOUBLE_TAP_DELAY && Math.abs(x - lastTapX.current) < 60) {
        // Double tap detected - handle both portrait and landscape with 1/3 divisions
        if (isInVideoArea(x, y)) {
          const { width } = getCurrentScreenDimensions();
          const leftThird = width * 0.333; // 33.3% of screen width
          const rightThird = width * 0.667; // 66.7% of screen width
          
          if (onLandscapeTap) {
            // Landscape mode: use landscape-specific handler
            onLandscapeTap(x);
          } else {
            // Portrait mode: use regular double tap handlers
            if (x < leftThird) {
              onDoubleTap('left');
            } else if (x > rightThird) {
              onDoubleTap('right');
            } else {
              if (typeof onDoubleTapCenter === 'function') {
                onDoubleTapCenter();
              }
            }
          }
        }
      } else {
        // Single tap - always trigger tap handler (for controls toggle)
        if (typeof onTap === 'function') {
          onTap();
        }
      }
      lastTap.current = now;
      lastTapX.current = x;
    }
  };

  return (
    <TapGestureHandler onHandlerStateChange={handleTap} numberOfTaps={1}>
      <PanGestureHandler onGestureEvent={handlePanGesture} onHandlerStateChange={handlePanGesture}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {children}
        </View>
      </PanGestureHandler>
    </TapGestureHandler>
  );
};

export default GestureOverlay; 