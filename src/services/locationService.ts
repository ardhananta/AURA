import * as Location from 'expo-location';
import { terrainService, LandscapeType } from './terrainService';

export interface UserGpsLocationResult {
  name: string;
  lat: number;
  lon: number;
  landscape: LandscapeType;
  elevation: number;
  terrainReason: string;
  isRealtime: boolean;
}

export const locationService = {
  /**
   * Request foreground location permission and retrieve current GPS position
   */
  async getCurrentGpsLocation(): Promise<{
    success: boolean;
    location?: UserGpsLocationResult;
    permissionDenied?: boolean;
    error?: string;
  }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, permissionDenied: true };
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let resolvedName = 'Lokasi GPS Saya';
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (rev && rev.length > 0) {
          const item = rev[0];
          const parts = [
            item.district || item.subregion || item.street,
            item.city || item.region,
          ].filter(Boolean);
          if (parts.length > 0) {
            resolvedName = parts.join(', ');
          }
        }
      } catch (revErr) {
        resolvedName = `GPS (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`;
      }

      // Detect real-time terrain from GPS & elevation
      const terrain = await terrainService.getRealtimeTerrain(
        loc.coords.latitude,
        loc.coords.longitude,
        resolvedName
      );

      return {
        success: true,
        location: {
          name: resolvedName,
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          landscape: terrain.landscape,
          elevation: terrain.elevation,
          terrainReason: terrain.reason,
          isRealtime: true,
        },
      };
    } catch (err: any) {
      console.warn('[LocationService] Failed getting device position:', err);
      return {
        success: false,
        error: err?.message || 'Gagal memperoleh posisi GPS perangkat',
      };
    }
  },
};
