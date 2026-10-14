import axios from 'axios';
import { api, BASE_URL } from './api';
import { ApiResponse } from '@/types/auth';
import {
  NearbyZonesData,
  WeeklyAnalysisResponse,
} from '@/types/zones';

const LOCAL_BASE_URL = 'http://localhost:8080';

/**
 * Helper to call endpoint with fallback between primary BASE_URL and LOCAL_BASE_URL
 */
async function fetchWithFallback<T>(
  url: string,
  params?: Record<string, any>
): Promise<T> {
  try {
    const res = await api.get<ApiResponse<T>>(url, { params });
    if (res.data.success && res.data.data) {
      return res.data.data;
    }
    throw new Error((res.data as any)?.error?.message || 'Permintaan gagal diproses');
  } catch (err: any) {
    // If staging returned 404 (route not yet deployed) or network error, attempt fallback to local server
    const is404 = err?.response?.status === 404;
    const isNetworkError = !err?.response;

    if ((is404 || isNetworkError) && BASE_URL !== LOCAL_BASE_URL) {
      try {
        const localRes = await axios.get<ApiResponse<T>>(`${LOCAL_BASE_URL}${url}`, {
          params,
          timeout: 5000,
        });
        if (localRes.data.success && localRes.data.data) {
          return localRes.data.data;
        }
      } catch (localErr) {
        // Fall back to original error
      }
    }
    throw err;
  }
}

export const zonesApi = {
  /**
   * Deteksi Hotspot Kemacetan & Polusi Terdekat
   * GET /api/zones/nearby?lat=...&lon=...&radius=...
   */
  getNearbyZones: async (
    lat: number,
    lon: number,
    radius: number = 10
  ): Promise<NearbyZonesData> => {
    return fetchWithFallback<NearbyZonesData>('/api/zones/nearby', {
      lat,
      lon,
      radius,
    });
  },

  /**
   * Prediksi Dampak Polusi & Kemacetan 7 Hari ke Depan
   * GET /api/zones/analysis?zone_id=... OR ?lat=...&lon=...&name=...
   */
  getWeeklyAnalysis: async (params: {
    zone_id?: string;
    lat?: number;
    lon?: number;
    name?: string;
  }): Promise<WeeklyAnalysisResponse> => {
    return fetchWithFallback<WeeklyAnalysisResponse>('/api/zones/analysis', params);
  },

  /**
   * Seed database hotspot default untuk testing
   * POST /api/zones/seed
   */
  seedZones: async (): Promise<{ message: string }> => {
    try {
      const res = await api.post<ApiResponse<{ message: string }>>('/api/zones/seed');
      if (res.data.success && res.data.data) {
        return res.data.data;
      }
      throw new Error((res.data as any)?.error?.message || 'Gagal melakukan seeding zona');
    } catch (err: any) {
      if (BASE_URL !== LOCAL_BASE_URL) {
        const localRes = await axios.post<ApiResponse<{ message: string }>>(
          `${LOCAL_BASE_URL}/api/zones/seed`,
          {},
          { timeout: 5000 }
        );
        if (localRes.data.success && localRes.data.data) {
          return localRes.data.data;
        }
      }
      throw err;
    }
  },
};
