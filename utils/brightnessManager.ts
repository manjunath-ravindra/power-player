import SystemSetting from 'react-native-system-setting';
import { AppState, AppStateStatus } from 'react-native';

class BrightnessManager {
  private isInVideoPlayer = false;
  private appBrightnessBeforePlayer: number | null = null;
  private appStateListener: any = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && !this.isInVideoPlayer) {
      // App became active and we're not in video player, sync with system brightness
      this.syncWithSystemBrightness();
    }
  }

  private async syncWithSystemBrightness() {
    try {
      const systemBrightness = await SystemSetting.getBrightness();
      await SystemSetting.setAppBrightness(systemBrightness);
    } catch (error) {
      console.log('Failed to sync brightness with system:', error);
    }
  }

  public enterVideoPlayer() {
    this.isInVideoPlayer = true;
    // Store current app brightness before entering player
    SystemSetting.getAppBrightness().then(brightness => {
      this.appBrightnessBeforePlayer = brightness;
    });
    
    // Stop periodic syncing when in video player
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public exitVideoPlayer() {
    this.isInVideoPlayer = false;
    // Restore app brightness to system brightness when exiting player
    this.syncWithSystemBrightness();
    
    // Start periodic syncing when not in video player
    this.startPeriodicSync();
  }

  public startPeriodicSync() {
    // Only start if not already running and not in video player
    if (!this.syncInterval && !this.isInVideoPlayer) {
      this.syncInterval = setInterval(() => {
        if (!this.isInVideoPlayer) {
          this.syncWithSystemBrightness();
        }
      }, 2000); // Check every 2 seconds
    }
  }

  public stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public cleanup() {
    this.stopPeriodicSync();
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }
}

// Create a singleton instance
const brightnessManager = new BrightnessManager();

export default brightnessManager; 