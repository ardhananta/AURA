/**
 * Navigation Types & Interfaces
 * Used for universal navigation feature with health warnings
 */

export interface NavigationRoute {
  route_id: string;
  distance_meters: number;
  duration_seconds: number;
  polyline: string; // Google polyline encoded format
  coordinates: [number, number][]; // [lon, lat] format
  steps: RouteStep[];
  traffic_segments: TrafficSegment[];
  health_warnings: HealthWarning[];
  map_markers: MapMarker[];
}

export interface RouteStep {
  instruction: string; // e.g., "Belok kanan ke Jl. Pemuda"
  distance_meters: number;
  duration_seconds: number;
  maneuver: 'turn-left' | 'turn-right' | 'straight' | 'uturn' | 'roundabout' | 'arrive';
  start_location: {
    latitude: number;
    longitude: number;
  };
  end_location: {
    latitude: number;
    longitude: number;
  };
}

export interface TrafficSegment {
  segment_index: number;
  severity: 'light' | 'moderate' | 'heavy';
  delay_seconds: number;
  affected_coordinates: [number, number][]; // [lon, lat]
}

export interface HealthWarning {
  warning_id: string;
  type: 'heavy_traffic' | 'moderate_traffic' | 'high_pollution' | 'disease_hotspot';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  location: {
    latitude: number;
    longitude: number;
  };
  aqi: number;
  pm2_5: number;
  health_risks: string[];
  recommendations: string[];
  icon: string; // Ionicons name
  color: string; // Hex color code
}

export interface MapMarker {
  marker_id: string;
  category: 'heavy_traffic' | 'moderate_traffic' | 'high_pollution' | 'disease_hotspot' | 'safe_zone';
  location: {
    latitude: number;
    longitude: number;
  };
  title: string;
  icon: string; // Ionicons name
  color: string; // Hex color code
}

export interface RouteOptions {
  avoid_tolls?: boolean;
  avoid_highways?: boolean;
  mode?: 'driving' | 'walking';
}

export interface CalculateRouteRequest {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  waypoints?: {
    latitude: number;
    longitude: number;
  }[];
  mode?: 'driving' | 'walking';
  avoid_tolls?: boolean;
  avoid_highways?: boolean;
}

export interface UserLocationDuringNavigation {
  latitude: number;
  longitude: number;
  heading: number; // 0-360 degrees
  accuracy_meters: number;
  timestamp: number;
}
