import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface GpsResult {
  lat: number;
  lng: number;
  /** True if the OS flagged this location as coming from a mock provider
   *  (Android "Developer options → Allow mock locations", or an iOS
   *  jailbreak tweak). Fraud signal — reject or flag the entry. */
  mocked: boolean;
  /** Horizontal accuracy in meters, or null if unavailable. */
  accuracy: number | null;
}

/**
 * GPS hook with mock-location detection. Requests permission once,
 * caches grant, and exposes getLocation().
 *
 * On Android, expo-location surfaces coords.mocked. On iOS, mock detection
 * is not exposed by the OS — we return false (iOS mocking generally
 * requires jailbreak and is rare among our personas).
 */
export function useGps() {
  const permissionGranted = useRef<boolean | null>(null);

  const getLocation = useCallback(async (): Promise<GpsResult | null> => {
    try {
      if (permissionGranted.current === null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        permissionGranted.current = status === 'granted';
      }
      if (!permissionGranted.current) return null;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // expo-location exposes `mocked` on Android via LocationManager
      // isFromMockProvider(). On iOS this property is undefined.
      const mocked =
        Platform.OS === 'android' && (loc.mocked === true || (loc as any).coords?.mocked === true);
      return {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        mocked: !!mocked,
        accuracy: loc.coords.accuracy ?? null,
      };
    } catch {
      return null;
    }
  }, []);

  return { getLocation };
}
