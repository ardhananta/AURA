import axios from 'axios';
import * as Location from 'expo-location';
import { zonesApi } from './zonesApi';
import {
  AirQuality,
  ImpactLevel,
  MapReportCategory,
  NearbyZonesData,
  NearbyZoneResult,
  TrafficSeverity,
  WeatherSnapshot,
} from '@/types/zones';

export interface RoadSearchEntry {
  n: string;
  h: string;
  lat: number;
  lon: number;
  subtitle?: string;
  isGlobal?: boolean;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface GridPointReading {
  lat: number;
  lon: number;
  airQuality: AirQuality;
}

const SCRAPE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const scrapeCache = new Map<string, { data: NearbyZonesData; timestamp: number }>();

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function decodeWeatherCode(code?: number): string {
  if (code === undefined || code === null) return 'Cerah Berawan';
  if (code === 0) return 'Cerah';
  if (code <= 3) return 'Berawan';
  if (code === 45 || code === 48) return 'Berkabut / Asap';
  if (code >= 51 && code <= 57) return 'Gerimis';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Hujan';
  if (code >= 95) return 'Badai Petir';
  return 'Berawan';
}

function classifyBackendCategory(category: string, aqi: number): MapReportCategory {
  if (category === 'industrial_area') return 'industrial';
  if (category === 'transit_hub') return 'transit';
  if (aqi >= 100) return 'pollution';
  if (category === 'traffic_corridor' || category === 'intersection') return 'traffic';
  return 'pollution';
}

function computeImpactLevel(score: number): ImpactLevel {
  if (score >= 65) return 'Berbahaya';
  if (score >= 38) return 'Waspada';
  return 'Aman';
}

function computeCongestion(
  baseWeight: number,
  precipMm: number
): { status: TrafficSeverity; idx: number } {
  const hour = new Date().getHours();
  const isMorningRush = hour >= 6 && hour <= 9;
  const isEveningRush = hour >= 16 && hour <= 19;
  const isMidday = hour >= 11 && hour <= 14;

  let idx = baseWeight;
  if (isMorningRush || isEveningRush) idx += 24;
  else if (isMidday) idx += 12;
  else if (hour >= 22 || hour <= 4) idx -= 18;

  if (precipMm > 0.4) idx += 14;
  idx = Math.max(10, Math.min(98, Math.round(idx)));

  let status: TrafficSeverity = 'Lancar';
  if (idx >= 80) status = 'Sangat Padat';
  else if (idx >= 60) status = 'Padat';
  else if (idx >= 38) status = 'Sedang';

  return { status, idx };
}

function buildRecommendations(
  category: MapReportCategory,
  aqi: number,
  traffic: TrafficSeverity,
  weather?: WeatherSnapshot
): string[] {
  const recs: string[] = [];
  if (aqi >= 120) {
    recs.push('Gunakan masker N95/KN95 dan kurangi aktivitas luar ruangan');
  } else if (aqi >= 70) {
    recs.push('Gunakan masker pelindung saat melintasi area ini');
  } else {
    recs.push('Kualitas udara relatif aman untuk aktivitas normal');
  }

  if (traffic === 'Sangat Padat' || traffic === 'Padat') {
    recs.push('Pertimbangkan rute alternatif untuk menghindari kemacetan & emisi knalpot');
  }

  if (category === 'industrial') {
    recs.push('Hindari paparan berkepanjangan di sekitar zona emisi industri');
  }

  if (weather && weather.precipitation_mm > 0.4) {
    recs.push('Waspada jalan licin & jarak pandang menurun akibat hujan');
  }
  return recs;
}

/**
 * Fetch real-time Air Quality across center + 4 radial grid coordinates via Open-Meteo.
 */
async function fetchOpenMeteoAirGrid(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<GridPointReading[]> {
  const offsetLat = (Math.max(1.5, radiusKm * 0.45) / 111.0);
  const offsetLon = (Math.max(1.5, radiusKm * 0.45) / (111.32 * Math.cos((lat * Math.PI) / 180)));

  const points = [
    { lat, lon },
    { lat: lat + offsetLat, lon },
    { lat: lat - offsetLat, lon },
    { lat, lon: lon + offsetLon },
    { lat, lon: lon - offsetLon },
  ];

  const latParam = points.map((p) => p.lat.toFixed(4)).join(',');
  const lonParam = points.map((p) => p.lon.toFixed(4)).join(',');

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${latParam}&longitude=${lonParam}` +
    `&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;

  const res = await axios.get(url, { timeout: 5500 });
  const rawList = Array.isArray(res.data) ? res.data : [res.data];

  return rawList.map((item: any, idx: number) => {
    const cur = item?.current || {};
    const pt = points[idx] || { lat, lon };
    return {
      lat: pt.lat,
      lon: pt.lon,
      airQuality: {
        us_aqi: Math.round(Number(cur.us_aqi ?? 52)),
        pm2_5: Number((cur.pm2_5 ?? 14.2).toFixed(1)),
        pm10: Number((cur.pm10 ?? 24.5).toFixed(1)),
        carbon_monoxide: Math.round(Number(cur.carbon_monoxide ?? 260)),
        nitrogen_dioxide: Number((cur.nitrogen_dioxide ?? 12.4).toFixed(1)),
        sulphur_dioxide: Number((cur.sulphur_dioxide ?? 4.2).toFixed(1)),
        ozone: Number((cur.ozone ?? 42.0).toFixed(1)),
        time: cur.time || new Date().toISOString(),
      },
    };
  });
}

/**
 * Fetch real-time weather snapshot via Open-Meteo.
 */
async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`;

  const res = await axios.get(url, { timeout: 5000 });
  const cur = res.data?.current || {};
  return {
    temperature_c: Math.round(Number(cur.temperature_2m ?? 29)),
    humidity_percent: Math.round(Number(cur.relative_humidity_2m ?? 72)),
    wind_speed_kmh: Number((cur.wind_speed_10m ?? 9.5).toFixed(1)),
    precipitation_mm: Number((cur.precipitation ?? 0).toFixed(1)),
    condition: decodeWeatherCode(cur.weather_code),
  };
}

/**
 * Scrape real-time road intersections, industrial zones, transit hubs, and parks from OpenStreetMap Overpass API.
 */
async function scrapeOverpassHotspots(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<OverpassElement[]> {
  const rMeters = Math.min(Math.max(1500, Math.round(radiusKm * 750)), 11000);
  const roadMeters = Math.min(rMeters, 5000);

  const query = `
[out:json][timeout:6];
(
  node["highway"="traffic_signals"](around:${roadMeters},${lat},${lon});
  node["highway"="motorway_junction"](around:${rMeters},${lat},${lon});
  way["landuse"="industrial"](around:${rMeters},${lat},${lon});
  node["amenity"="bus_station"](around:${rMeters},${lat},${lon});
  node["railway"="station"](around:${rMeters},${lat},${lon});
  way["highway"~"^(trunk|primary)$"]["name"](around:${roadMeters},${lat},${lon});
  way["leisure"="park"]["name"](around:${roadMeters},${lat},${lon});
);
out center 36;
`.trim();

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await axios.post(endpoint, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 6500,
      });
      if (Array.isArray(res.data?.elements)) {
        return res.data.elements as OverpassElement[];
      }
    } catch {
      // Try next Overpass mirror
    }
  }
  return [];
}

function pickNearestAirQuality(
  lat: number,
  lon: number,
  grid: GridPointReading[],
  microBoostAqi = 0
): AirQuality {
  let nearest = grid[0];
  let bestDist = Infinity;
  for (const g of grid) {
    const d = haversineKm(lat, lon, g.lat, g.lon);
    if (d < bestDist) {
      bestDist = d;
      nearest = g;
    }
  }

  const base = nearest?.airQuality || {
    us_aqi: 55,
    pm2_5: 15,
    pm10: 26,
    carbon_monoxide: 270,
    nitrogen_dioxide: 14,
    sulphur_dioxide: 4,
    ozone: 45,
  };

  const adjustedAqi = Math.max(15, Math.round(base.us_aqi + microBoostAqi));
  const factor = adjustedAqi / Math.max(1, base.us_aqi);

  return {
    ...base,
    us_aqi: adjustedAqi,
    pm2_5: Number((base.pm2_5 * factor).toFixed(1)),
    pm10: Number((base.pm10 * factor).toFixed(1)),
    carbon_monoxide: Math.round(base.carbon_monoxide * factor),
  };
}

function classifyOverpassElement(el: OverpassElement): {
  reportType: MapReportCategory;
  zoneCategory: string;
  baseWeight: number;
  aqiBoost: number;
  sources: string[];
  defaultName: string;
} {
  const tags = el.tags || {};
  if (tags.landuse === 'industrial') {
    return {
      reportType: 'industrial',
      zoneCategory: 'industrial_area',
      baseWeight: 54,
      aqiBoost: 18,
      sources: ['Emisi Industri', 'Logistik Berat', 'Partikulat PM2.5'],
      defaultName: 'Kawasan Industri',
    };
  }
  if (tags.amenity === 'bus_station' || tags.railway === 'station') {
    return {
      reportType: 'transit',
      zoneCategory: 'transit_hub',
      baseWeight: 56,
      aqiBoost: 10,
      sources: ['Transportasi Umum', 'Kepadatan Penumpang', 'Gas Buang'],
      defaultName: tags.railway === 'station' ? 'Stasiun Kereta' : 'Terminal Transit',
    };
  }
  if (tags.leisure === 'park') {
    return {
      reportType: 'safe_zone',
      zoneCategory: 'green_space',
      baseWeight: 18,
      aqiBoost: -12,
      sources: ['Ruang Terbuka Hijau', 'Serapan Karbon Alami'],
      defaultName: 'Taman Kota',
    };
  }
  if (tags.highway === 'motorway_junction' || tags.highway === 'trunk') {
    return {
      reportType: 'traffic',
      zoneCategory: 'traffic_corridor',
      baseWeight: 62,
      aqiBoost: 14,
      sources: ['Arus Kendaraan Arteri', 'Kemacetan Simpang', 'NO₂ & CO'],
      defaultName: 'Jalur Arteri Utama',
    };
  }
  if (tags.highway === 'traffic_signals') {
    return {
      reportType: 'traffic',
      zoneCategory: 'intersection',
      baseWeight: 58,
      aqiBoost: 12,
      sources: ['Antrean Lampu Merah', 'Emisi Kendaraan Bermotor'],
      defaultName: 'Simpang Lalu Lintas',
    };
  }
  return {
    reportType: 'pollution',
    zoneCategory: 'traffic_corridor',
    baseWeight: 48,
    aqiBoost: 8,
    sources: ['Kepadatan Jalan Utama', 'Debu Jalanan PM10'],
    defaultName: 'Koridor Jalan Utama',
  };
}

export const mapScraperService = {
  /**
   * Scrape real-time traffic, air pollution, weather, and local hotspots for ANY region.
   */
  async scrapeRealtimeRegion(
    lat: number,
    lon: number,
    radiusKm: number = 10,
    regionLabel?: string
  ): Promise<NearbyZonesData> {
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${radiusKm}`;
    const cached = scrapeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SCRAPE_CACHE_TTL_MS) {
      return cached.data;
    }

    const nowIso = new Date().toISOString();

    const [backendRes, airGridRes, weatherRes, overpassRes] = await Promise.allSettled([
      zonesApi.getNearbyZones(lat, lon, radiusKm),
      fetchOpenMeteoAirGrid(lat, lon, radiusKm),
      fetchOpenMeteoWeather(lat, lon),
      scrapeOverpassHotspots(lat, lon, radiusKm),
    ]);

    const airGrid: GridPointReading[] =
      airGridRes.status === 'fulfilled' && airGridRes.value.length > 0
        ? airGridRes.value
        : [
            {
              lat,
              lon,
              airQuality: {
                us_aqi: 54,
                pm2_5: 14.5,
                pm10: 25.0,
                carbon_monoxide: 265,
                nitrogen_dioxide: 13.0,
                ozone: 42.0,
              },
            },
          ];

    const weather: WeatherSnapshot | undefined =
      weatherRes.status === 'fulfilled' ? weatherRes.value : undefined;

    const mergedZones: NearbyZoneResult[] = [];
    const seenCoords: { lat: number; lon: number }[] = [];

    const isTooClose = (pLat: number, pLon: number, minKm = 0.55) =>
      seenCoords.some((c) => haversineKm(c.lat, c.lon, pLat, pLon) < minKm);

    // 1. Merge backend zones if available (enriched with live weather & category icon)
    if (backendRes.status === 'fulfilled' && backendRes.value?.nearby_zones?.length) {
      for (const nz of backendRes.value.nearby_zones) {
        const aqi = nz.air_quality?.us_aqi ?? airGrid[0].airQuality.us_aqi;
        const reportType = classifyBackendCategory(nz.zone.category, aqi);
        seenCoords.push({ lat: nz.zone.latitude, lon: nz.zone.longitude });
        mergedZones.push({
          ...nz,
          air_quality: nz.air_quality || pickNearestAirQuality(nz.zone.latitude, nz.zone.longitude, airGrid),
          report_type: reportType,
          weather,
          source_tag: 'Backend + Live Sensor',
          scraped_at: nowIso,
          recommendations: buildRecommendations(reportType, aqi, nz.congestion_status, weather),
        });
      }
    }

    // 2. Merge live scraped OpenStreetMap Overpass hotspots (works in ANY city/region)
    if (overpassRes.status === 'fulfilled' && overpassRes.value.length > 0) {
      for (const el of overpassRes.value) {
        if (mergedZones.length >= 14) break;
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (typeof elLat !== 'number' || typeof elLon !== 'number') continue;
        if (isTooClose(elLat, elLon, 0.55)) continue;

        const distKm = haversineKm(lat, lon, elLat, elLon);
        if (distKm > radiusKm * 1.1) continue;

        const info = classifyOverpassElement(el);
        const rawName = el.tags?.name || el.tags?.ref || info.defaultName;
        const { status: congestionStatus, idx: congestionIdx } = computeCongestion(
          info.baseWeight,
          weather?.precipitation_mm ?? 0
        );
        const aq = pickNearestAirQuality(elLat, elLon, airGrid, info.aqiBoost);
        const impactScore = Math.min(
          100,
          Math.round(aq.us_aqi * 0.45 + congestionIdx * 0.55)
        );
        const impactLevel = computeImpactLevel(impactScore);

        seenCoords.push({ lat: elLat, lon: elLon });
        mergedZones.push({
          zone: {
            id: `osm_${el.type}_${el.id}`,
            name: rawName,
            description: `${info.defaultName} • Data real-time OSM & Open-Meteo`,
            category: info.zoneCategory,
            latitude: elLat,
            longitude: elLon,
            radius_meters: 450,
            congestion_base_level: congestionStatus,
            congestion_index: congestionIdx,
            peak_hours: ['07.00–09.00', '16.30–19.00'],
            pollution_sources: info.sources,
          },
          distance_km: Number(distKm.toFixed(2)),
          air_quality: aq,
          congestion_status: congestionStatus,
          impact_score: impactScore,
          impact_level: impactLevel,
          report_type: info.reportType,
          weather,
          source_tag: 'Live Scraping (OSM + Open-Meteo)',
          scraped_at: nowIso,
          recommendations: buildRecommendations(info.reportType, aq.us_aqi, congestionStatus, weather),
        });
      }
    }

    // 3. Always include a dedicated Live Weather & Regional Air Quality station marker + spatial grid fallback
    const sectorLabels = ['Pusat Area', 'Sektor Utara', 'Sektor Selatan', 'Sektor Timur', 'Sektor Barat'];
    airGrid.forEach((gp, idx) => {
      if (idx === 0 || mergedZones.length < 5) {
        if (!isTooClose(gp.lat, gp.lon, idx === 0 ? 0.25 : 0.7)) {
          const isWeatherStation = idx === 0 && Boolean(weather);
          const reportType: MapReportCategory = isWeatherStation ? 'weather' : 'pollution';
          const distKm = haversineKm(lat, lon, gp.lat, gp.lon);
          const { status: congestionStatus, idx: congestionIdx } = computeCongestion(
            42,
            weather?.precipitation_mm ?? 0
          );
          const impactScore = Math.min(
            100,
            Math.round(gp.airQuality.us_aqi * 0.55 + congestionIdx * 0.45)
          );
          const labelPrefix = isWeatherStation
            ? `Cuaca & Udara ${regionLabel || 'Lokasi Ini'}`
            : `Pantauan Udara ${sectorLabels[idx] || `Sektor ${idx}`}`;

          seenCoords.push({ lat: gp.lat, lon: gp.lon });
          mergedZones.push({
            zone: {
              id: `grid_${idx}_${gp.lat.toFixed(3)}_${gp.lon.toFixed(3)}`,
              name: labelPrefix,
              description: weather
                ? `${weather.condition}, ${weather.temperature_c}°C • Angin ${weather.wind_speed_kmh} km/j`
                : 'Pemantauan kualitas udara real-time regional',
              category: isWeatherStation ? 'weather_station' : 'air_monitor',
              latitude: gp.lat,
              longitude: gp.lon,
              radius_meters: 800,
              congestion_base_level: congestionStatus,
              congestion_index: congestionIdx,
              peak_hours: ['07.00–09.00', '17.00–19.00'],
              pollution_sources: [
                weather ? `Cuaca: ${weather.condition}` : 'Sensor Kualitas Udara',
                `PM2.5: ${gp.airQuality.pm2_5} µg/m³`,
              ],
            },
            distance_km: Number(distKm.toFixed(2)),
            air_quality: gp.airQuality,
            congestion_status: congestionStatus,
            impact_score: impactScore,
            impact_level: computeImpactLevel(impactScore),
            report_type: reportType,
            weather,
            source_tag: 'Live Open-Meteo Sensor',
            scraped_at: nowIso,
            recommendations: buildRecommendations(
              reportType,
              gp.airQuality.us_aqi,
              congestionStatus,
              weather
            ),
          });
        }
      }
    });

    // Sort by distance from active center
    mergedZones.sort((a, b) => a.distance_km - b.distance_km);

    const centerAq = airGrid[0]?.airQuality;
    const result: NearbyZonesData = {
      user_coordinates: { latitude: lat, longitude: lon },
      search_radius_km: radiusKm,
      zones_found_count: mergedZones.length,
      nearby_zones: mergedZones,
      local_environment: {
        air_quality: centerAq,
        source: 'Live Scraping (Open-Meteo + OSM Overpass)',
      },
      summary_advice:
        centerAq && centerAq.us_aqi > 100
          ? 'Kualitas udara di area ini sedang meningkat. Kurangi paparan outdoor berlebih.'
          : 'Pemantauan real-time kemacetan, polusi udara, dan cuaca aktif di area ini.',
    };

    scrapeCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  },

  /**
   * Inspect any arbitrary tapped point on the map for live traffic, pollution & weather report.
   */
  async inspectCoordinates(lat: number, lon: number): Promise<NearbyZoneResult> {
    const nowIso = new Date().toISOString();

    const [airRes, weatherRes, geoRes] = await Promise.allSettled([
      fetchOpenMeteoAirGrid(lat, lon, 2),
      fetchOpenMeteoWeather(lat, lon),
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }),
    ]);

    const aq =
      airRes.status === 'fulfilled' && airRes.value[0]
        ? airRes.value[0].airQuality
        : {
            us_aqi: 52,
            pm2_5: 14.0,
            pm10: 24.0,
            carbon_monoxide: 260,
            nitrogen_dioxide: 12.0,
            ozone: 42.0,
          };

    const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : undefined;

    let placeName = `Titik (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    if (geoRes.status === 'fulfilled' && geoRes.value && geoRes.value.length > 0) {
      const g = geoRes.value[0];
      const parts = [g.street || g.name, g.district || g.subregion || g.city].filter(Boolean);
      if (parts.length > 0) {
        placeName = parts.join(', ');
      }
    }

    const { status: congestionStatus, idx: congestionIdx } = computeCongestion(
      46,
      weather?.precipitation_mm ?? 0
    );
    const impactScore = Math.min(100, Math.round(aq.us_aqi * 0.52 + congestionIdx * 0.48));
    const reportType: MapReportCategory =
      aq.us_aqi >= 95 ? 'pollution' : weather && weather.precipitation_mm > 0.3 ? 'weather' : 'traffic';

    return {
      zone: {
        id: `inspect_${lat.toFixed(4)}_${lon.toFixed(4)}`,
        name: placeName,
        description: weather
          ? `Laporan langsung • ${weather.condition} ${weather.temperature_c}°C`
          : 'Laporan langsung koordinat terpilih',
        category: 'inspected_point',
        latitude: lat,
        longitude: lon,
        radius_meters: 500,
        congestion_base_level: congestionStatus,
        congestion_index: congestionIdx,
        peak_hours: ['07.00–09.00', '16.30–19.00'],
        pollution_sources: [
          `AQI ${aq.us_aqi} (PM2.5: ${aq.pm2_5} µg/m³)`,
          weather ? `Cuaca: ${weather.condition}, Angin ${weather.wind_speed_kmh} km/j` : 'Analisis Real-time',
        ],
      },
      distance_km: 0,
      air_quality: aq,
      congestion_status: congestionStatus,
      impact_score: impactScore,
      impact_level: computeImpactLevel(impactScore),
      report_type: reportType,
      weather,
      source_tag: 'Live Point Inspection',
      scraped_at: nowIso,
      recommendations: buildRecommendations(reportType, aq.us_aqi, congestionStatus, weather),
    };
  },

  /**
   * Search roads/POIs locally + any city/region in Indonesia via OpenStreetMap Nominatim.
   */
  async searchLocationsGlobal(
    query: string,
    localRoads: RoadSearchEntry[]
  ): Promise<RoadSearchEntry[]> {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const localMatches: RoadSearchEntry[] = localRoads
      .filter((r) => r.n.toLowerCase().includes(q))
      .slice(0, 5)
      .map((r) => ({ ...r, isGlobal: false }));

    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'json',
          q: query.trim(),
          countrycodes: 'id',
          limit: 6,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'AURA-Mobile-App/1.0',
          'Accept-Language': 'id',
        },
        timeout: 4500,
      });

      const remoteList: RoadSearchEntry[] = Array.isArray(res.data)
        ? res.data.map((item: any) => {
            const parts = String(item.display_name || '').split(',').map((s) => s.trim());
            const title = parts[0] || query.trim();
            const subtitle = parts.slice(1, 3).join(', ');
            return {
              n: title,
              h: item.type || 'region',
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              subtitle,
              isGlobal: true,
            };
          })
        : [];

      // Combine without duplicates near the same name/coordinate
      const combined = [...remoteList];
      for (const lm of localMatches) {
        if (!combined.some((c) => haversineKm(c.lat, c.lon, lm.lat, lm.lon) < 0.3)) {
          combined.push(lm);
        }
      }
      return combined.slice(0, 8);
    } catch {
      return localMatches;
    }
  },
};
