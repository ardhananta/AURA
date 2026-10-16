import axios from 'axios';
import { api, BASE_URL } from './api';
import {
  DailyAnalysisResponse,
  SendBatchPayload,
  MobilityWaypoint,
} from '@/types/mobility';

const LOCAL_BASE_URL = 'http://localhost:8080';

// Fallback in case of local server or staging divergence
async function postWithFallback<T>(url: string, data: any): Promise<T> {
  try {
    const res = await api.post(url, data);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    if (res.data?.data) {
      return res.data.data;
    }
    return res.data;
  } catch (err: any) {
    const is404 = err?.response?.status === 404;
    const isNetworkError = !err?.response;

    if ((is404 || isNetworkError) && BASE_URL !== LOCAL_BASE_URL) {
      try {
        const localRes = await axios.post(`${LOCAL_BASE_URL}${url}`, data, { timeout: 5000 });
        if (localRes.data?.success && localRes.data?.data) {
          return localRes.data.data;
        }
        if (localRes.data?.data) {
          return localRes.data.data;
        }
      } catch (localErr) {
        // Fall back to original error
      }
    }
    throw err;
  }
}

async function getWithFallback<T>(url: string, params?: Record<string, any>): Promise<T> {
  try {
    const res = await api.get(url, { params });
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    if (res.data?.data) {
      return res.data.data;
    }
    return res.data;
  } catch (err: any) {
    const is404 = err?.response?.status === 404;
    const isNetworkError = !err?.response;

    if ((is404 || isNetworkError) && BASE_URL !== LOCAL_BASE_URL) {
      try {
        const localRes = await axios.get(`${LOCAL_BASE_URL}${url}`, { params, timeout: 5000 });
        if (localRes.data?.success && localRes.data?.data) {
          return localRes.data.data;
        }
        if (localRes.data?.data) {
          return localRes.data.data;
        }
      } catch (localErr) {
        // Fall back to original error
      }
    }
    throw err;
  }
}

export const mobilityService = {
  /**
   * Kirim kumpulan (batch) waypoint pergerakan harian ke backend
   * Backend akan mencocokkan dengan zona polusi Semarang dan memprosesnya dengan Groq Llama-3.3-70b
   */
  async sendBatch(payload: SendBatchPayload): Promise<DailyAnalysisResponse> {
    return await postWithFallback<DailyAnalysisResponse>('/api/v1/mobility/batch', payload);
  },

  /**
   * Ambil hasil analisis mobilitas & paparan polusi harian dari backend
   */
  async getDailyAnalysis(date?: string, userId?: string): Promise<DailyAnalysisResponse> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    if (userId) params.user_id = userId;

    return await getWithFallback<DailyAnalysisResponse>('/api/v1/mobility/daily-analysis', params);
  },

  /**
   * Helper untuk menghitung jarak Haversine (meter) antara 2 titik koordinat
   */
  getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  /**
   * Contoh data waypoint harian realistis Kota Semarang
   * (Kombinasi Indoor Stay dan Outdoor Transit di rute padat lalu lintas)
   */
  getSampleWaypoints(todayStr: string): SendBatchPayload['waypoints'] {
    return [
      {
        latitude: -6.9934,
        longitude: 110.4087,
        timestamp: `${todayStr}T08:00:00Z`,
        duration_minutes: 180, // >= 20 min -> Indoor stay (Rumah / Kost)
        is_stay: true,
      },
      {
        latitude: -6.9893,
        longitude: 110.4229,
        timestamp: `${todayStr}T11:15:00Z`,
        duration_minutes: 15, // < 20 min -> Outdoor transit (Simpang Lima / Pandanaran)
        is_stay: false,
      },
      {
        latitude: -6.9587,
        longitude: 110.4578,
        timestamp: `${todayStr}T11:35:00Z`,
        duration_minutes: 12, // Outdoor transit (Kawasan Industri Kaligawe - AQI tinggi)
        is_stay: false,
      },
      {
        latitude: -6.9825,
        longitude: 110.4092,
        timestamp: `${todayStr}T12:00:00Z`,
        duration_minutes: 240, // >= 20 min -> Indoor stay (Kantor / Kampus)
        is_stay: true,
      },
      {
        latitude: -6.9932,
        longitude: 110.4203,
        timestamp: `${todayStr}T16:30:00Z`,
        duration_minutes: 25, // Outdoor transit sore hari
        is_stay: false,
      },
    ];
  },
};
