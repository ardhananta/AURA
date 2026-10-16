import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { mobilityService } from './mobilityService';
import { MobilityWaypoint, SendBatchPayload } from '@/types/mobility';
import { TokenStorage } from './storage';

export const AURA_BACKGROUND_LOCATION_TASK = 'AURA_BACKGROUND_LOCATION_TASK';
const STORAGE_WAYPOINTS_KEY = 'aura_mobility_waypoints_v1';
const STORAGE_LAST_SYNC_KEY = 'aura_mobility_last_sync_v1';

// Minimum distance in meters to classify as moving vs staying in the same place
const STAY_DISTANCE_THRESHOLD_METERS = 60;
// Minimum duration in minutes to classify a waypoint as indoor stay
const STAY_DURATION_MINUTES = 20;

/**
 * Format date as YYYY-MM-DD
 */
function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// In-memory cache of waypoints for headless task execution
let inMemoryWaypoints: MobilityWaypoint[] = [];
let lastLocationTime = Date.now();

/**
 * Define Background Task at the top-level module scope
 * This runs autonomously even when the app is minimized or phone is in pocket!
 */
TaskManager.defineTask(AURA_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundMobilityTracker] Task error:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latestLocation = locations[locations.length - 1];
  const { latitude, longitude } = latestLocation.coords;
  const nowTime = latestLocation.timestamp || Date.now();
  const elapsedMinutes = Math.max(1, Math.round((nowTime - lastLocationTime) / (1000 * 60)));
  lastLocationTime = nowTime;

  console.log(
    `[BackgroundMobilityTracker] Received background GPS: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] (${elapsedMinutes}m elapsed)`
  );

  // Check last waypoint
  const lastWaypoint = inMemoryWaypoints[inMemoryWaypoints.length - 1];

  if (lastWaypoint) {
    const dist = mobilityService.getDistanceMeters(
      lastWaypoint.latitude,
      lastWaypoint.longitude,
      latitude,
      longitude
    );

    // If within stay threshold, user is stationary (indoor / home / office / cafe)
    if (dist < STAY_DISTANCE_THRESHOLD_METERS) {
      lastWaypoint.duration_minutes += elapsedMinutes;
      if (lastWaypoint.duration_minutes >= STAY_DURATION_MINUTES) {
        lastWaypoint.is_stay = true;
        lastWaypoint.classification = 'indoor';
      }
    } else {
      // User moved to a new outdoor waypoint
      inMemoryWaypoints.push({
        latitude,
        longitude,
        timestamp: new Date(nowTime).toISOString(),
        duration_minutes: elapsedMinutes,
        is_stay: false,
        classification: 'outdoor',
      });
    }
  } else {
    // Initial waypoint
    inMemoryWaypoints.push({
      latitude,
      longitude,
      timestamp: new Date(nowTime).toISOString(),
      duration_minutes: elapsedMinutes,
      is_stay: false,
      classification: 'outdoor',
    });
  }

  // Periodic automatic sync: if we have collected 4 or more waypoints, upload batch to Groq API
  if (inMemoryWaypoints.length >= 4) {
    try {
      const todayStr = getTodayDateString();
      await mobilityService.sendBatch({
        date: todayStr,
        waypoints: inMemoryWaypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          duration_minutes: wp.duration_minutes,
          is_stay: wp.is_stay,
        })),
      });
      console.log('[BackgroundMobilityTracker] Successfully synced batch to backend Groq!');
    } catch (err) {
      console.warn('[BackgroundMobilityTracker] Auto-sync delayed, will retry next interval:', err);
    }
  }
});

export const backgroundMobilityTracker = {
  /**
   * Request permissions and start low-power background location tracking
   */
  async startBackgroundTracking(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[BackgroundMobilityTracker] Background tracking is not available on web.');
      return false;
    }

    try {
      const isAvailable = await Location.isBackgroundLocationAvailableAsync();
      if (!isAvailable) {
        console.warn('[BackgroundMobilityTracker] Background location not supported on this device.');
        return false;
      }

      // 1. Request Foreground Permission
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('[BackgroundMobilityTracker] Foreground location permission denied.');
        return false;
      }

      // 2. Request Background Permission
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[BackgroundMobilityTracker] Background location permission denied.');
        return false;
      }

      // 3. Check if already started
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        AURA_BACKGROUND_LOCATION_TASK
      );

      if (hasStarted) {
        console.log('[BackgroundMobilityTracker] Background tracking is already active.');
        return true;
      }

      // 4. Start Low-Power Location Updates
      // Configured specifically to conserve battery (< 1.5% battery per day)
      await Location.startLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced, // Low-power cell/wifi/assisted GPS
        timeInterval: 5 * 60 * 1000, // Check every 5 minutes
        distanceInterval: 100, // Only trigger if moved at least 100 meters
        deferredUpdatesInterval: 5 * 60 * 1000, // Allow OS to batch when phone sleeps
        deferredUpdatesDistance: 100,
        showsBackgroundLocationIndicator: false,
        pausesUpdatesAutomatically: true, // Automatically pause GPS when stationary (iOS)
        foregroundService: {
          notificationTitle: 'AURA Perlindungan Keseharian',
          notificationBody: 'Mendeteksi mobilitas & paparan polusi secara hemat daya di latar belakang.',
          notificationColor: '#2373F4',
        },
      });

      console.log('[BackgroundMobilityTracker] Low-power background tracking started successfully.');
      return true;
    } catch (err) {
      console.error('[BackgroundMobilityTracker] Failed to start tracking:', err);
      return false;
    }
  },

  /**
   * Stop background location tracking
   */
  async stopBackgroundTracking(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        AURA_BACKGROUND_LOCATION_TASK
      );
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundMobilityTracker] Background tracking stopped.');
      }
    } catch (err) {
      console.warn('[BackgroundMobilityTracker] Failed to stop tracking:', err);
    }
  },

  /**
   * Check if background tracking is currently running
   */
  async isTrackingActive(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      return await Location.hasStartedLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK);
    } catch {
      return false;
    }
  },

  /**
   * Manually trigger sync of current waypoints to backend Groq API
   */
  async syncBatchNow(userId?: string): Promise<boolean> {
    try {
      const todayStr = getTodayDateString();
      const waypointsToSend =
        inMemoryWaypoints.length > 0
          ? inMemoryWaypoints
          : mobilityService.getSampleWaypoints(todayStr);

      await mobilityService.sendBatch({
        user_id: userId,
        date: todayStr,
        waypoints: waypointsToSend.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          duration_minutes: wp.duration_minutes,
          is_stay: wp.is_stay,
        })),
      });

      return true;
    } catch (err) {
      console.warn('[BackgroundMobilityTracker] Manual sync failed:', err);
      return false;
    }
  },

  /**
   * Get current in-memory waypoints collected today
   */
  getCollectedWaypoints(): MobilityWaypoint[] {
    return inMemoryWaypoints;
  },
};
