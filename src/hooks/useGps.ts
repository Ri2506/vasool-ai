import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

interface GpsResult {
  lat: number;
  lng: number;
}

/**
 * Lightweight GPS hook. Requests permission once, then provides a
 * getLocation() that returns lat/lng or null (never blocks the UI).
 * Used to stamp every collection with GPS coordinates.
 */
export function useGps() {
  const permissionGranted = useRef<boolean | null>(null);

  const getLocation = useCallback(async (): Promise<GpsResult | null> => {
    try {
      // Request permission on first call; cached thereafter.
      if (permissionGranted.current === null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        permissionGranted.current = status === 'granted';
      }
      if (!permissionGranted.current) return null;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  return { getLocation };
}
