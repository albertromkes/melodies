import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Check if running as a native app (Android/iOS)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Initialize Capacitor plugins for native platforms
 * This is safe to call on web - it will simply do nothing
 */
export async function initCapacitor(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Running as web app, no native initialization needed
    return;
  }

  try {
    // Configure status bar for native platforms
    await StatusBar.setStyle({ style: Style.Light });
    
    if (Capacitor.getPlatform() === 'android') {
      // Make status bar transparent on Android
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }

    // Hide splash screen after app is ready
    await SplashScreen.hide();
  } catch (error) {
    console.warn('Capacitor initialization error:', error);
  }
}

/**
 * Set status bar style based on theme
 */
export async function setStatusBarTheme(isDark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ 
        color: isDark ? '#1a1a1a' : '#ffffff' 
      });
    }
  } catch (error) {
    console.warn('Status bar update error:', error);
  }
}
