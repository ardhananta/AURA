import axios from 'axios';
import { Platform } from 'react-native';
import {
  CoughMobilityContext,
  CoughPredictionResponse,
  ScanSkinContext,
  SkinScanResponse,
  ScinMetadataResponse,
} from '@/types/ai';

const DEFAULT_AI_URL =
  process.env.EXPO_PUBLIC_AI_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export const AI_API_URL = DEFAULT_AI_URL;

export const aiService = {
  /**
   * Scan kulit menggunakan foto Base64 + data mobilitas (Groq AI qwen/qwen3.8-27b + SCIN Validation)
   * Endpoint: POST /api/skin/scan-json
   */
  scanSkin: async (
    imageBase64: string,
    context?: ScanSkinContext
  ): Promise<SkinScanResponse> => {
    // Pastikan prefix data:image tersedia jika format murni base64
    const formattedBase64 = imageBase64.startsWith('data:image')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    try {
      const res = await axios.post<SkinScanResponse>(
        `${AI_API_URL}/api/skin/scan-json`,
        {
          image_base64: formattedBase64,
          context,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
        }
      );

      if (!res.data || !res.data.success) {
        throw new Error(
          (res.data as any)?.error || 'Gagal memproses analisis kulit dari server AI'
        );
      }

      return res.data;
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Tidak dapat terhubung ke server AI kulit (Groq/SCIN).';
      console.error('[aiService.scanSkin] Error:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  /**
   * Prediksi audio suara batuk (.wav) via ONNX ICBHI model
   * Endpoint: POST /api/predict/cough
   */
  predictCough: async (
    audioUri: string,
    mobilityData?: CoughMobilityContext
  ): Promise<CoughPredictionResponse> => {
    if (!audioUri) {
      throw new Error('File rekaman suara batuk tidak ditemukan.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      name: 'cough.wav',
      type: 'audio/wav',
    } as any);

    if (mobilityData?.outdoorMinutes !== undefined) {
      formData.append('total_outdoor_minutes', String(mobilityData.outdoorMinutes));
    }
    if (mobilityData?.pm25 !== undefined) {
      formData.append('average_outdoor_pm25', String(mobilityData.pm25));
    }
    if (mobilityData?.worstArea) {
      formData.append('worst_area_name', mobilityData.worstArea);
    }
    if (mobilityData?.worstAqi !== undefined) {
      formData.append('worst_area_aqi', String(mobilityData.worstAqi));
    }
    if (mobilityData?.usia !== undefined) {
      formData.append('usia', String(mobilityData.usia));
    }

    try {
      const res = await axios.post<CoughPredictionResponse>(
        `${AI_API_URL}/api/predict/cough`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 25000,
        }
      );

      if (!res.data || !res.data.prediction) {
        throw new Error('Format respon analisis batuk tidak valid.');
      }

      return res.data;
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Tidak dapat terhubung ke server ONNX ICBHI batuk.';
      console.error('[aiService.predictCough] Error:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  /**
   * Ambil kamus taksonomi Google SCIN
   * Endpoint: GET /api/scin/metadata
   */
  getScinMetadata: async (): Promise<ScinMetadataResponse> => {
    const res = await axios.get<ScinMetadataResponse>(`${AI_API_URL}/api/scin/metadata`, {
      timeout: 8000,
    });
    return res.data;
  },
};
