import { ImpactLevel, TrafficSeverity } from '@/types/zones';

export function getImpactColor(level?: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return '#10B981'; // Emerald Green
    case 'Waspada':
      return '#F59E0B'; // Amber Orange
    case 'Berbahaya':
      return '#EF4444'; // Rose Red
    default:
      return '#64748B';
  }
}

export function getImpactBgColor(level?: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return '#ECFDF5';
    case 'Waspada':
      return '#FFFBEB';
    case 'Berbahaya':
      return '#FEF2F2';
    default:
      return '#F1F5F9';
  }
}

export function getTrafficSeverityColor(severity?: TrafficSeverity): string {
  switch (severity) {
    case 'Lancar':
      return '#10B981';
    case 'Sedang':
      return '#3B82F6';
    case 'Padat':
      return '#F59E0B';
    case 'Sangat Padat':
      return '#EF4444';
    default:
      return '#64748B';
  }
}
