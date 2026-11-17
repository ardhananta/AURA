import { ImpactLevel, MapReportCategory, TrafficSeverity } from '@/types/zones';

/**
 * Resolve marker hex color from report category & impact level.
 */
export function getZoneMarkerColor(
  level: ImpactLevel,
  category?: MapReportCategory
): string {
  if (category === 'weather') return '#0284C7';
  if (category === 'safe_zone' && level === 'Aman') return '#10B981';
  switch (level) {
    case 'Aman':
      return '#10B981';
    case 'Waspada':
      return '#F59E0B';
    case 'Berbahaya':
      return '#EF4444';
    default:
      return '#1E6CEF';
  }
}

export function getZoneMarkerGlow(
  level: ImpactLevel,
  category?: MapReportCategory
): string {
  if (category === 'weather') return 'rgba(2, 132, 199, 0.35)';
  switch (level) {
    case 'Aman':
      return 'rgba(16, 185, 129, 0.38)';
    case 'Waspada':
      return 'rgba(245, 158, 11, 0.38)';
    case 'Berbahaya':
      return 'rgba(239, 68, 68, 0.42)';
    default:
      return 'rgba(30, 108, 239, 0.35)';
  }
}

export function getReportCategoryLabel(category?: MapReportCategory): string {
  switch (category) {
    case 'traffic':
      return 'Laporan Kemacetan';
    case 'industrial':
      return 'Kawasan Industri';
    case 'transit':
      return 'Hub Transportasi';
    case 'weather':
      return 'Cuaca & Udara';
    case 'safe_zone':
      return 'Zona Hijau';
    case 'pollution':
    default:
      return 'Laporan Polusi';
  }
}

export function getReportIoniconName(
  category?: MapReportCategory
): 'car' | 'cloud' | 'business' | 'bus' | 'partly-sunny' | 'leaf' {
  switch (category) {
    case 'traffic':
      return 'car';
    case 'industrial':
      return 'business';
    case 'transit':
      return 'bus';
    case 'weather':
      return 'partly-sunny';
    case 'safe_zone':
      return 'leaf';
    case 'pollution':
    default:
      return 'cloud';
  }
}

/**
 * Crisp inline SVG strings for MapLibre WebView icon markers.
 */
export function getMapMarkerSvgIcon(category?: MapReportCategory): string {
  switch (category) {
    case 'traffic':
      // Car / traffic icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2-5H7l-2 5v5Z"/><circle cx="7.5" cy="17.5" r="1.5" fill="#FFFFFF"/><circle cx="16.5" cy="17.5" r="1.5" fill="#FFFFFF"/><path d="M5 12h14"/></svg>';
    case 'industrial':
      // Factory / smoke stack icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l5 4V9l5 4h4v8"/><path d="M16 5c1-1.5 3-1.5 3-3"/></svg>';
    case 'transit':
      // Bus / station icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="15" r="1" fill="#FFFFFF"/><circle cx="16" cy="15" r="1" fill="#FFFFFF"/><path d="M6 18v2M18 18v2"/></svg>';
    case 'weather':
      // Cloud + droplet / wind weather icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 16a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 16.8 9.2 3.5 3.5 0 0 1 17.5 16h-11Z"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/></svg>';
    case 'safe_zone':
      // Leaf / park icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
    case 'pollution':
    default:
      // Air pollution / cloud-alert icon
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 17a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 16.8 10.2 3.5 3.5 0 0 1 17.5 17h-11Z"/><path d="M12 11v3M12 16.5h.01"/></svg>';
  }
}

export function inferTrafficColor(status: TrafficSeverity): string {
  switch (status) {
    case 'Sangat Padat':
      return '#EF4444';
    case 'Padat':
      return '#F97316';
    case 'Sedang':
      return '#F59E0B';
    case 'Lancar':
    default:
      return '#10B981';
  }
}
