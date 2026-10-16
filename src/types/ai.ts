/**
 * Type Definitions for AURA AI Services:
 * 1. Cough AI (ONNX ICBHI) - Deteksi & Analisis Batuk
 * 2. Skin Multimodal (Groq AI qwen/qwen3.8-27b + Google SCIN Validation)
 */

export interface CoughEnvironmentalCorrelation {
  total_outdoor_minutes?: number;
  average_outdoor_pm25?: number;
  worst_area_name?: string;
  worst_area_aqi?: number;
  high_exposure_flag?: boolean;
  clinical_correlation_notes?: string;
}

export interface CoughPredictionResponse {
  prediction: string; // 'Wheeze' | 'Crackle' | 'Normal' | 'Crackle + Wheeze'
  confidence: number;
  status: 'healthy' | 'moderate' | 'warning' | string;
  health_score: number;
  severity: string;
  clinical_interpretation: string;
  all_probabilities: Record<string, number>;
  environmental_correlation?: CoughEnvironmentalCorrelation;
}

export interface CoughMobilityContext {
  outdoorMinutes?: number;
  pm25?: number;
  worstArea?: string;
  worstAqi?: number;
  usia?: number;
}

export interface ScanSkinContext {
  total_outdoor_minutes?: number;
  total_indoor_minutes?: number;
  average_outdoor_aqi?: number;
  average_outdoor_pm25?: number;
  max_aqi?: number;
  worst_area_name?: string;
  worst_area_aqi?: number;
  city?: string;
  temperature?: number;
  relative_humidity?: number;
  uv_index?: number;
  wind_speed?: number;
  pm10?: number;
  usia?: number;
  tinggi_badan?: number;
  berat_badan?: number;
}

export interface EnvironmentalFactor {
  score: number;
  level: string; // 'Rendah' | 'Sedang' | 'Tinggi'
  analysis: string;
}

export interface SkinEnvironmentalImpact {
  pollution: EnvironmentalFactor;
  weather: EnvironmentalFactor;
  sun_uv: EnvironmentalFactor;
}

export interface SkinMetrics {
  overall_health_score: number;
  hydration_score: number;
  redness_score: number;
  barrier_integrity_score: number;
  pollution_clog_score: number;
  uv_damage_score: number;
}

export interface ScinValidation {
  primary_condition: string;
  textures: string[];
  symptoms: string[];
  body_part: string;
  is_scin_verified: boolean;
}

export interface SkinScanData {
  condition: string;
  condition_indonesian: string;
  confidence: number;
  fitzpatrick_skin_type: string;
  fitzpatrick_description: string;
  model_used: string;
  scin_validation: ScinValidation;
  environmental_impact: SkinEnvironmentalImpact;
  skin_metrics: SkinMetrics;
  severity: 'mild' | 'moderate' | 'severe' | string;
  recommendations: string[];
  summary: string;
  medical_disclaimer: string;
}

export interface SkinScanResponse {
  success: boolean;
  data: SkinScanData;
}

export interface ScinMetadataResponse {
  fitzpatrick_types: Record<string, string>;
  scin_textures: string[];
  scin_symptoms: string[];
  environmental_conditions: Record<string, string[]>;
}
