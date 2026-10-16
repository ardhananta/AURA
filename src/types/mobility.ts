export interface MobilityWaypoint {
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601
  duration_minutes: number;
  is_stay?: boolean;
  classification?: 'indoor' | 'outdoor';
  zone_name?: string;
  aqi?: number;
  pm2_5?: number;
}

export interface ExposureStats {
  total_indoor_minutes: number;
  total_outdoor_minutes: number;
  average_outdoor_aqi: number;
  average_outdoor_pm25: number;
  max_aqi: number;
  worst_area_name: string;
  worst_area_aqi: number;
  worst_area_timestamp?: string;
  waypoints_processed: number;
}

export interface AIDiagnosis {
  impact_score: number; // 0 - 100
  risk_level: 'Rendah' | 'Sedang' | 'Tinggi' | 'Berbahaya';
  summary: string;
  doctor_diagnosis: string;
  recommendations: string[];
}

export interface DailyAnalysisResponse {
  id: string;
  user_id: string;
  date: string;
  stats: ExposureStats;
  analysis: AIDiagnosis;
  waypoints: MobilityWaypoint[];
}

export interface SendBatchPayload {
  user_id?: string;
  date: string;
  waypoints: {
    latitude: number;
    longitude: number;
    timestamp: string;
    duration_minutes: number;
    is_stay?: boolean;
  }[];
}
