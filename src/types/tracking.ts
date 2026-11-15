/**
 * Active Tracking Types & Interfaces
 * Used for manual journey tracking with hybrid sync
 */

export interface TrackingSession {
  session_id: string;
  user_id?: string;
  session_name?: string;
  started_at: string; // ISO 8601
  ended_at?: string; // ISO 8601
  status: 'active' | 'completed';
  waypoints: TrackingWaypoint[];
  stats?: TrackingSessionStats;
  distance_km?: number;
  duration_minutes?: number;
}

export interface TrackingWaypoint {
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601
  accuracy_meters?: number;
  speed_mps?: number; // meters per second
  heading?: number; // 0-360 degrees
  classification?: 'indoor' | 'outdoor';
  is_stay?: boolean;
  aqi?: number;
  pm2_5?: number;
  zone_name?: string;
}

export interface TrackingSessionStats {
  total_outdoor_minutes: number;
  total_indoor_minutes: number;
  average_outdoor_aqi: number;
  average_outdoor_pm25: number;
  max_aqi: number;
  worst_area_name: string;
  worst_area_aqi: number;
  waypoints_processed: number;
}

export interface SendTrackingWaypoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy_meters?: number;
  speed_mps?: number;
  heading?: number;
}

export interface SyncWaypointsRequest {
  session_id: string;
  user_id?: string;
  waypoints: SendTrackingWaypoint[];
  is_final: boolean;
}

export interface SyncWaypointsResponse {
  success: boolean;
  synced_count: number;
  session_id: string;
  total_waypoints: number;
  last_sync_at: string;
}

export interface StartSessionRequest {
  user_id: string;
  session_name?: string;
  start_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

export interface StartSessionResponse {
  session_id: string;
  started_at: string;
  status: 'active';
}

export interface StopSessionRequest {
  session_id: string;
  end_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

export interface StopSessionResponse {
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  distance_km: number;
  stats: TrackingSessionStats;
  analysis?: {
    impact_score: number;
    risk_level: 'Rendah' | 'Sedang' | 'Tinggi' | 'Berbahaya';
    summary: string;
    recommendations: string[];
  };
}

export interface DailyHistoryResponse {
  date: string; // YYYY-MM-DD
  sessions: TrackingSession[];
  combined_waypoints: TrackingWaypoint[];
  daily_stats: TrackingSessionStats;
}
