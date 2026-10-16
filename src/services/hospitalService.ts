import { api, BASE_URL } from './api';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  user_ratings_total: number;
  phone: string;
  open_hours: string;
  type: string;
  image_url: string;
  facilities: string[];
  distance_km?: number;
}

export interface RouteStep {
  name: string;
  distance: number; // in meters
  duration: number; // in seconds
  modifier: string; // "left", "right", "sharp left", etc.
  type: string;     // "turn", "depart", "arrive", etc.
}

export interface RouteData {
  distance_meters: number;
  duration_seconds: number;
  coordinates: [number, number][]; // [lon, lat]
  steps: RouteStep[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// In-memory cache of fetched hospitals
let cachedHospitals: Hospital[] = [];

export const hospitalService = {
  /**
   * Fetch nearby hospitals sorted by real distance from user's GPS position
   */
  async getNearbyHospitals(
    lat: number,
    lon: number,
    radiusKm: number = 15,
    limit: number = 10
  ): Promise<Hospital[]> {
    try {
      const response = await api.get<ApiResponse<Hospital[]>>(
        '/api/v1/hospitals/nearby',
        {
          params: {
            lat,
            lon,
            radius_km: radiusKm,
            limit,
          },
        }
      );

      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        cachedHospitals = response.data.data;
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.warn('[HospitalService] Failed fetching nearby hospitals:', error);
      return [];
    }
  },

  /**
   * Fetch turn-by-turn road route and polyline coordinates from backend
   */
  async getRoute(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number
  ): Promise<RouteData | null> {
    try {
      const response = await api.get<ApiResponse<RouteData>>(
        '/api/v1/routes',
        {
          params: {
            origin_lat: originLat,
            origin_lon: originLon,
            dest_lat: destLat,
            dest_lon: destLon,
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.warn('[HospitalService] Failed fetching route from backend:', error);
      return null;
    }
  },

  /**
   * Get cached hospital by ID
   */
  getCachedHospital(id: string): Hospital | undefined {
    return cachedHospitals.find((h) => h.id === id);
  },

  /**
   * Get all currently cached hospitals
   */
  getAllCachedHospitals(): Hospital[] {
    return cachedHospitals;
  },
};
