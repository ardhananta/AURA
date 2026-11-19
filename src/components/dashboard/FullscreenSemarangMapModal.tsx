import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Dimensions,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import semarangRoads from '@/data/semarang-named-roads.json';
import { mapScraperService, RoadSearchEntry } from '@/services/mapScraperService';
import {
  ImpactLevel,
  MapReportCategory,
  NearbyZonesData,
  NearbyZoneResult,
} from '@/types/zones';
import {
  getMapMarkerSvgIcon,
  getReportCategoryLabel,
  getReportIoniconName,
  getZoneMarkerColor,
  getZoneMarkerGlow,
} from '@/utils/map-marker-icons';

const ROAD_DATA = semarangRoads as RoadSearchEntry[];

interface FullscreenSemarangMapModalProps {
  visible: boolean;
  onClose: () => void;
  userLocation?: {
    lat: number;
    lon: number;
    name?: string;
  };
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_CITY_PRESETS = [
  { name: 'Semarang', lat: -6.988, lon: 110.415 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8229 },
  { name: 'Bandung', lat: -6.9175, lon: 107.6191 },
  { name: 'Surabaya', lat: -7.2575, lon: 112.7521 },
  { name: 'Yogyakarta', lat: -7.7956, lon: 110.3695 },
  { name: 'Denpasar', lat: -8.6705, lon: 115.2126 },
  { name: 'Medan', lat: 3.5952, lon: 98.6722 },
];

type CategoryFilterKey = 'all' | MapReportCategory;

const CATEGORY_FILTERS: {
  key: CategoryFilterKey;
  label: string;
  icon: 'layers' | 'car' | 'cloud' | 'business' | 'bus' | 'partly-sunny';
}[] = [
  { key: 'all', label: 'Semua', icon: 'layers' },
  { key: 'traffic', label: 'Macet', icon: 'car' },
  { key: 'pollution', label: 'Polusi', icon: 'cloud' },
  { key: 'industrial', label: 'Industri', icon: 'business' },
  { key: 'transit', label: 'Transit', icon: 'bus' },
  { key: 'weather', label: 'Cuaca', icon: 'partly-sunny' },
];

function getBadgeBg(level: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return '#ECFDF5';
    case 'Waspada':
      return '#FFFBEB';
    case 'Berbahaya':
      return '#FEF2F2';
    default:
      return '#EFF6FF';
  }
}

function serializeForMap(zones: NearbyZoneResult[]) {
  return zones.map((nz) => ({
    id: nz.zone.id,
    name: nz.zone.name,
    lat: nz.zone.latitude,
    lon: nz.zone.longitude,
    impactLevel: nz.impact_level,
    reportType: nz.report_type || 'pollution',
    color: getZoneMarkerColor(nz.impact_level, nz.report_type),
    glow: getZoneMarkerGlow(nz.impact_level, nz.report_type),
    iconSvg: getMapMarkerSvgIcon(nz.report_type),
    aqi: nz.air_quality?.us_aqi ?? null,
    congestion: nz.congestion_status,
  }));
}

export const FullscreenSemarangMapModal: React.FC<FullscreenSemarangMapModalProps> = ({
  visible,
  onClose,
  userLocation,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const cityPresets = useMemo(() => {
    if (userLocation) {
      return [
        { name: userLocation.name || 'Lokasi Saya (GPS)', lat: userLocation.lat, lon: userLocation.lon },
        ...BASE_CITY_PRESETS,
      ];
    }
    return BASE_CITY_PRESETS;
  }, [userLocation]);

  const [activeCity, setActiveCity] = useState(cityPresets[0]);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterKey>('all');
  const [nearbyData, setNearbyData] = useState<NearbyZonesData | null>(null);
  const [selectedZoneResult, setSelectedZoneResult] = useState<NearbyZoneResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInspectingPoint, setIsInspectingPoint] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [pannedCenter, setPannedCenter] = useState<{ lat: number; lon: number } | null>(null);

  // ─── Global Search & Navigation State ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<RoadSearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<RoadSearchEntry | null>(null);
  const searchInputRef = useRef<any>(null);

  // Filtered zones based on category chip
  const displayedZones = useMemo(() => {
    const list = nearbyData?.nearby_zones || [];
    if (categoryFilter === 'all') return list;
    return list.filter((z) => (z.report_type || 'pollution') === categoryFilter);
  }, [nearbyData, categoryFilter]);

  // Debounced local + global Nominatim search (works for Semarang & all other regions)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await mapScraperService.searchLocationsGlobal(q, ROAD_DATA);
        if (!cancelled) {
          setSearchResults(results);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  function highwayLabel(h: string): string {
    const map: Record<string, string> = {
      motorway: 'Tol',
      trunk: 'Arteri',
      primary: 'Jalan Utama',
      secondary: 'Sekunder',
      tertiary: 'Tersier',
      city: 'Kota',
      administrative: 'Wilayah',
      suburb: 'Kecamatan',
      village: 'Kelurahan',
    };
    return map[h] || 'Lokasi / Wilayah';
  }

  const flyToLocation = useCallback(
    (lon: number, lat: number, zoom = 14.2) => {
      if (!isMapLoaded || !webViewRef.current) return;
      webViewRef.current.injectJavaScript(`
        if (window.flyToPoint) { window.flyToPoint(${lon}, ${lat}, ${zoom}); }
        true;
      `);
    },
    [isMapLoaded]
  );

  // Selecting any road/city from search jumps there AND scrapes real-time reports for that region
  const handleSelectRoad = useCallback(
    (road: RoadSearchEntry) => {
      setSearchQuery(road.n);
      setIsSearchFocused(false);
      setSearchTarget(road);
      setSelectedZoneResult(null);
      setPannedCenter(null);
      setActiveCity({ name: road.n, lat: road.lat, lon: road.lon });
      flyToLocation(road.lon, road.lat, road.isGlobal ? 13.5 : 15.0);
      searchInputRef.current?.blur();
    },
    [flyToLocation]
  );

  const handleNavigateToTarget = useCallback(() => {
    if (!searchTarget) return;
    onClose();
    router.push({
      pathname: '/universal-navigation',
      params: {
        destLat: String(searchTarget.lat),
        destLon: String(searchTarget.lon),
        destName: searchTarget.n,
      },
    });
  }, [searchTarget, onClose, router]);

  const handleNavigateToZone = useCallback(
    (zone: NearbyZoneResult) => {
      onClose();
      router.push({
        pathname: '/universal-navigation',
        params: {
          destLat: String(zone.zone.latitude),
          destLon: String(zone.zone.longitude),
          destName: zone.zone.name,
        },
      });
    },
    [onClose, router]
  );

  const handleOpenUniversalNavigation = useCallback(() => {
    onClose();
    router.push('/universal-navigation');
  }, [onClose, router]);

  const topPadding =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 24) + 8
      : Math.max(insets.top, 14);

  const loadRealtimeScrapedData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mapScraperService.scrapeRealtimeRegion(
        activeCity.lat,
        activeCity.lon,
        radiusKm,
        activeCity.name
      );
      setNearbyData(data);
      setPannedCenter(null);
      if (data.nearby_zones && data.nearby_zones.length > 0) {
        setSelectedZoneResult((prev) => prev ?? data.nearby_zones[0]);
      }
    } catch (err: any) {
      console.warn('[MapModal] Failed scraping region data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCity, radiusKm]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    mapScraperService
      .scrapeRealtimeRegion(activeCity.lat, activeCity.lon, radiusKm, activeCity.name)
      .then((data) => {
        if (!active) return;
        setNearbyData(data);
        setPannedCenter(null);
        if (data.nearby_zones && data.nearby_zones.length > 0) {
          setSelectedZoneResult(data.nearby_zones[0]);
        }
      })
      .catch((err: any) => {
        console.warn('[MapModal] Failed scraping region data:', err);
      });
    return () => {
      active = false;
    };
  }, [visible, activeCity, radiusKm]);

  // Update map radius layer reactively
  useEffect(() => {
    if (isMapLoaded && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.updateRadius) { window.updateRadius(${radiusKm}); }
        true;
      `);
    }
  }, [radiusKm, isMapLoaded]);

  // Update plotted icon markers when scraped zones or category filter change
  useEffect(() => {
    if (isMapLoaded && webViewRef.current) {
      const zonesJson = JSON.stringify(serializeForMap(displayedZones));
      webViewRef.current.injectJavaScript(`
        if (window.updateZones) { window.updateZones(${zonesJson}); }
        true;
      `);
    }
  }, [displayedZones, isMapLoaded]);

  // Move map center when city changes
  useEffect(() => {
    if (isMapLoaded && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.setCenter) { window.setCenter(${activeCity.lon}, ${activeCity.lat}, ${radiusKm}); }
        true;
      `);
    }
  }, [activeCity, isMapLoaded, radiusKm]);

  const handleScanMovedArea = useCallback(() => {
    if (!pannedCenter) return;
    setSearchTarget(null);
    setActiveCity({
      name: `Area (${pannedCenter.lat.toFixed(2)}, ${pannedCenter.lon.toFixed(2)})`,
      lat: pannedCenter.lat,
      lon: pannedCenter.lon,
    });
    setPannedCenter(null);
  }, [pannedCenter]);

  const mapHtml = useMemo(() => {
    const initialZones = JSON.stringify(serializeForMap(displayedZones));

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body, html, #map { width: 100%; height: 100%; overflow: hidden; background: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-attrib { display: none !important; }

    /* Center Pulse Radar */
    .center-radar-container {
      width: 50px;
      height: 50px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .center-radar-wave {
      position: absolute;
      width: 50px;
      height: 50px;
      background: rgba(30, 108, 239, 0.22);
      border-radius: 50%;
      animation: radarWave 2.2s infinite ease-out;
    }
    @keyframes radarWave {
      0% { transform: scale(0.5); opacity: 0.95; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    .center-radar-core {
      width: 15px;
      height: 15px;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(30, 108, 239, 0.65);
      z-index: 2;
    }

    /* Hotspot Category Icon Pin */
    .hotspot-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .hotspot-wrapper:active {
      transform: scale(1.14);
    }
    .hotspot-halo {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      top: -6px;
      animation: haloPulse 2.2s infinite ease-in-out;
    }
    @keyframes haloPulse {
      0%, 100% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.26); opacity: 0.2; }
    }
    .hotspot-core {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 9px rgba(15, 23, 42, 0.34);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .hotspot-label {
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(4px);
      border-radius: 999px;
      padding: 2.5px 8px;
      font-size: 10px;
      font-weight: 800;
      color: #0F172A;
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
      white-space: nowrap;
      max-width: 145px;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 4px;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var centerLat = ${activeCity.lat};
    var centerLon = ${activeCity.lon};
    var radiusKm = ${radiusKm};
    var is3D = true;
    var currentMarkers = [];
    var centerMarker = null;
    var lastMarkerTapMs = 0;

    function createGeoJSONCircle(center, km, points) {
      if (!points) points = 64;
      var lat = center[1];
      var lon = center[0];
      var ret = [];
      var distanceX = km / (111.320 * Math.cos(lat * Math.PI / 180));
      var distanceY = km / 110.574;

      for (var i = 0; i < points; i++) {
        var theta = (i / points) * (2 * Math.PI);
        var x = distanceX * Math.cos(theta);
        var y = distanceY * Math.sin(theta);
        ret.push([lon + x, lat + y]);
      }
      ret.push(ret[0]);
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [ret]
        }
      };
    }

    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [centerLon, centerLat],
      zoom: 13.0,
      pitch: 36,
      bearing: -6,
      maxPitch: 65,
      attributionControl: false
    });

    function addHotspotMarker(z) {
      var el = document.createElement('div');
      el.className = 'hotspot-wrapper';
      var aqiTag = z.aqi ? (' • ' + z.aqi) : '';
      el.innerHTML =
        '<div class="hotspot-halo" style="background:' + z.glow + '"></div>' +
        '<div class="hotspot-core" style="background:' + z.color + '">' + z.iconSvg + '</div>' +
        '<div class="hotspot-label">' + z.name + aqiTag + '</div>';

      function handleSelect(e) {
        lastMarkerTapMs = Date.now();
        if (e) { e.stopPropagation(); }
        map.flyTo({
          center: [z.lon, z.lat],
          zoom: 14.5,
          pitch: 40,
          duration: 650
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_ZONE', zoneId: z.id }));
        }
      }

      el.addEventListener('pointerup', handleSelect);
      el.addEventListener('click', handleSelect);

      var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([z.lon, z.lat])
        .addTo(map);

      currentMarkers.push(marker);
    }

    map.on('load', function() {
      var circleGeoJSON = createGeoJSONCircle([centerLon, centerLat], radiusKm);
      map.addSource('radius-circle', {
        type: 'geojson',
        data: circleGeoJSON
      });

      map.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#0284C7',
          'fill-opacity': 0.08
        }
      });

      map.addLayer({
        id: 'radius-circle-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#0284C7',
          'line-width': 2.2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8
        }
      });

      var centerEl = document.createElement('div');
      centerEl.className = 'center-radar-container';
      centerEl.innerHTML = '<div class="center-radar-wave"></div><div class="center-radar-core"></div>';
      centerMarker = new maplibregl.Marker({ element: centerEl })
        .setLngLat([centerLon, centerLat])
        .addTo(map);

      var initialZonesList = ${initialZones};
      initialZonesList.forEach(function(z) {
        addHotspotMarker(z);
      });

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_LOADED' }));
      }
    });

    // Click anywhere on map to inspect real-time air quality, weather & traffic at that point
    map.on('click', function(e) {
      if (Date.now() - lastMarkerTapMs < 350) return;
      if (window.ReactNativeWebView && e && e.lngLat) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'INSPECT_POINT',
          lat: e.lngLat.lat,
          lon: e.lngLat.lng
        }));
      }
    });

    // Notify RN when user pans significantly to another region so "Pindai Area Ini" button appears
    map.on('moveend', function() {
      var c = map.getCenter();
      var dLat = Math.abs(c.lat - centerLat);
      var dLon = Math.abs(c.lng - centerLon);
      if ((dLat > 0.018 || dLon > 0.018) && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_MOVED',
          lat: c.lat,
          lon: c.lng
        }));
      }
    });

    window.updateRadius = function(newRadiusKm) {
      radiusKm = newRadiusKm;
      if (map && map.getSource('radius-circle')) {
        map.getSource('radius-circle').setData(createGeoJSONCircle([centerLon, centerLat], radiusKm));
      }
    };

    window.updateZones = function(newZones) {
      currentMarkers.forEach(function(m) { m.remove(); });
      currentMarkers = [];
      (newZones || []).forEach(function(z) {
        addHotspotMarker(z);
      });
    };

    window.setCenter = function(newLon, newLat, newRadiusKm) {
      centerLon = newLon;
      centerLat = newLat;
      radiusKm = newRadiusKm || radiusKm;
      if (centerMarker) {
        centerMarker.setLngLat([centerLon, centerLat]);
      }
      if (map && map.getSource('radius-circle')) {
        map.getSource('radius-circle').setData(createGeoJSONCircle([centerLon, centerLat], radiusKm));
      }
      map.flyTo({
        center: [centerLon, centerLat],
        zoom: 13.0,
        pitch: is3D ? 36 : 0,
        bearing: is3D ? -6 : 0,
        duration: 850
      });
    };

    window.toggle3D = function() {
      if (is3D) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
        is3D = false;
      } else {
        map.easeTo({ pitch: 36, bearing: -6, duration: 500 });
        is3D = true;
      }
      return is3D;
    };

    window.recenterMap = function() {
      map.flyTo({
        center: [centerLon, centerLat],
        zoom: 13.0,
        pitch: is3D ? 36 : 0,
        bearing: is3D ? -6 : 0,
        duration: 750
      });
    };

    window.flyToPoint = function(lon, lat, zoom) {
      map.flyTo({
        center: [lon, lat],
        zoom: zoom || 14.5,
        pitch: is3D ? 40 : 0,
        bearing: is3D ? -6 : 0,
        duration: 850,
        essential: true
      });
    };
  </script>
</body>
</html>
    `;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'MAP_LOADED') {
        setIsMapLoaded(true);
      } else if (payload.type === 'SELECT_ZONE' && payload.zoneId && nearbyData) {
        const found = nearbyData.nearby_zones.find((z) => z.zone.id === payload.zoneId);
        if (found) {
          setSearchTarget(null);
          setSelectedZoneResult(found);
        }
      } else if (payload.type === 'MAP_MOVED' && typeof payload.lat === 'number') {
        setPannedCenter({ lat: payload.lat, lon: payload.lon });
      } else if (payload.type === 'INSPECT_POINT' && typeof payload.lat === 'number') {
        setIsInspectingPoint(true);
        setSearchTarget(null);
        try {
          const pointReport = await mapScraperService.inspectCoordinates(payload.lat, payload.lon);
          setSelectedZoneResult(pointReport);
        } finally {
          setIsInspectingPoint(false);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  };

  const handleToggle3D = () => {
    setIs3DMode(!is3DMode);
    webViewRef.current?.injectJavaScript(`
      if (window.toggle3D) { window.toggle3D(); }
      true;
    `);
  };

  const handleRecenter = () => {
    setPannedCenter(null);
    webViewRef.current?.injectJavaScript(`
      if (window.recenterMap) { window.recenterMap(); }
      true;
    `);
  };

  const handleOpenAnalysis = (zoneResult: NearbyZoneResult) => {
    onClose();
    router.push({
      pathname: '/pollution-impact',
      params: {
        zone_id: zoneResult.zone.id,
        lat: zoneResult.zone.latitude.toString(),
        lon: zoneResult.zone.longitude.toString(),
        name: zoneResult.zone.name,
      },
    });
  };

  const selectedColor = selectedZoneResult
    ? getZoneMarkerColor(selectedZoneResult.impact_level, selectedZoneResult.report_type)
    : '#1E6CEF';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* 1. INTERACTIVE 3D GIS MAP */}
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webView}
          onMessage={handleMessage}
          scrollEnabled={true}
          overScrollMode="never"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent="AURA-Mobile-App/1.0"
        />

        {/* 2. TOP FROSTED HUD: Search, Cities, Category Filter & Radius */}
        <View style={[styles.topHudContainer, { top: topPadding }]}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => {
                if (isSearchFocused) {
                  setIsSearchFocused(false);
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                } else {
                  onClose();
                }
              }}
              style={styles.circleIconButton}
              accessibilityLabel="Kembali"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </Pressable>

            <View style={styles.searchBarWrapper}>
              <Ionicons name="search" size={15} color="#64748B" style={{ marginRight: 7 }} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBarInput}
                placeholder="Cari jalan, kota, atau daerah di Indonesia..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setSearchTarget(null);
                  if (t.trim().length < 2) {
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 180);
                }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#1E6CEF" />
              ) : searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery('');
                    setSearchTarget(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={loadRealtimeScrapedData}
              style={styles.circleIconButton}
              accessibilityLabel="Refresh Data Real-time"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isLoading || isInspectingPoint ? (
                <ActivityIndicator size="small" color="#1E6CEF" />
              ) : (
                <Ionicons name="refresh" size={18} color="#0F172A" />
              )}
            </Pressable>
          </View>

          {!isSearchFocused && (
            <>
              {/* City Presets */}
              <View style={styles.cityScrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cityScrollContent}
                >
                  {cityPresets.map((city) => {
                    const isActive = activeCity.name === city.name;
                    const isGPS = city.name.includes('GPS') || city.name.includes('Saya');
                    return (
                      <Pressable
                        key={city.name}
                        onPress={() => {
                          setSearchTarget(null);
                          setActiveCity(city);
                        }}
                        style={[styles.cityChip, isActive && styles.cityChipActive]}
                      >
                        {isGPS && (
                          <Ionicons
                            name="navigate"
                            size={11}
                            color={isActive ? '#FFFFFF' : '#1E6CEF'}
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text style={[styles.cityChipText, isActive && styles.cityChipTextActive]}>
                          {city.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Category Icon Filter Strip */}
              <View style={styles.categoryScrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cityScrollContent}
                >
                  {CATEGORY_FILTERS.map((cat) => {
                    const isActive = categoryFilter === cat.key;
                    return (
                      <Pressable
                        key={cat.key}
                        onPress={() => setCategoryFilter(cat.key)}
                        style={[styles.catChip, isActive && styles.catChipActive]}
                      >
                        <Ionicons
                          name={cat.icon}
                          size={12}
                          color={isActive ? '#FFFFFF' : '#475569'}
                        />
                        <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Radius Selector & Live Sensor Summary */}
              <View style={styles.subRow}>
                <View style={styles.radiusPillBox}>
                  <Text style={styles.radiusLabel}>Radius:</Text>
                  {[5, 10, 20].map((r) => {
                    const isSelected = radiusKm === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setRadiusKm(r)}
                        style={[styles.radiusChip, isSelected && styles.radiusChipSelected]}
                      >
                        <Text
                          style={[
                            styles.radiusChipText,
                            isSelected && styles.radiusChipTextSelected,
                          ]}
                        >
                          {r} km
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {nearbyData?.local_environment?.air_quality ? (
                  <View style={styles.aqiSummaryBadge}>
                    <View style={styles.radarLiveDot} />
                    <Text style={styles.aqiSummaryText}>
                      AQI {nearbyData.local_environment.air_quality.us_aqi}
                    </Text>
                    <Text style={styles.aqiCountSubText}>• {displayedZones.length} Titik</Text>
                  </View>
                ) : (
                  <View style={styles.aqiSummaryBadge}>
                    <View style={styles.radarLiveDot} />
                    <Text style={styles.aqiSummaryText}>Live Scraper</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Search Results Dropdown */}
          {isSearchFocused && searchQuery.length >= 2 && searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map((road, idx) => (
                <Pressable
                  key={`${road.n}-${idx}`}
                  style={[
                    styles.searchResultItem,
                    idx < searchResults.length - 1 && styles.searchResultDivider,
                  ]}
                  onPress={() => handleSelectRoad(road)}
                >
                  <Ionicons
                    name={road.isGlobal ? 'earth' : 'navigate-circle-outline'}
                    size={16}
                    color="#1E6CEF"
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {road.n}
                    </Text>
                    <Text style={styles.searchResultType} numberOfLines={1}>
                      {road.subtitle || highwayLabel(road.h)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Panned Region Rescrape Pill */}
        {pannedCenter && !isSearchFocused && (
          <View style={[styles.scanAreaBannerWrapper, { top: topPadding + 162 }]}>
            <Pressable onPress={handleScanMovedArea} style={styles.scanAreaButton}>
              <Ionicons name="scan" size={14} color="#FFFFFF" />
              <Text style={styles.scanAreaText}>Pindai Area Ini (Real-Time)</Text>
            </Pressable>
          </View>
        )}

        {/* 3. FLOATING 3D & RECENTER CONTROLS */}
        <View
          style={[
            styles.floatingNativeControls,
            { bottom: selectedZoneResult || searchTarget ? 318 : insets.bottom + 28 },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.nativeMapBtn}
            onPress={handleToggle3D}
            accessibilityLabel="Ganti Perspektif 3D"
          >
            <Text style={styles.nativeMapBtnText}>{is3DMode ? '3D' : '2D'}</Text>
          </Pressable>

          <Pressable
            style={styles.nativeMapBtn}
            onPress={handleRecenter}
            accessibilityLabel="Pusat Peta"
          >
            <Ionicons name="locate" size={20} color="#1E6CEF" />
          </Pressable>
        </View>

        {/* 4. FLOATING LEGEND & DIRECT NAVIGATION TRIGGER */}
        {!selectedZoneResult && !searchTarget && (
          <>
            <View style={[styles.legendCard, { bottom: insets.bottom + 84 }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendLabel}>Bahaya / Padat</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendLabel}>Waspada / Sedang</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendLabel}>Aman / Lancar</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                <Text style={styles.legendLabel}>Cuaca & Udara</Text>
              </View>
            </View>

            <Pressable
              onPress={handleOpenUniversalNavigation}
              style={[styles.floatingNavPill, { bottom: insets.bottom + 28 }]}
              accessibilityRole="button"
              accessibilityLabel="Buka Navigasi Rute"
            >
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
              <Text style={styles.floatingNavPillText}>Mulai Navigasi</Text>
            </Pressable>
          </>
        )}

        {/* 5. REAL-TIME SCRAPED REPORT DETAIL SHEET */}
        {selectedZoneResult && (
          <View style={[styles.detailCard, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.detailCardHeader}>
              <View style={[styles.categoryIconCircle, { backgroundColor: selectedColor }]}>
                <Ionicons
                  name={getReportIoniconName(selectedZoneResult.report_type)}
                  size={18}
                  color="#FFFFFF"
                />
              </View>

              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text numberOfLines={1} style={styles.detailLocationName}>
                  {selectedZoneResult.zone.name}
                </Text>
                <Text numberOfLines={1} style={styles.detailDistanceText}>
                  {getReportCategoryLabel(selectedZoneResult.report_type)} •{' '}
                  {selectedZoneResult.distance_km > 0
                    ? `${selectedZoneResult.distance_km.toFixed(1)} km`
                    : 'Titik Terpilih'}
                  {selectedZoneResult.source_tag ? ` • ${selectedZoneResult.source_tag}` : ''}
                </Text>
              </View>

              <View
                style={[
                  styles.impactBadge,
                  {
                    backgroundColor: getBadgeBg(selectedZoneResult.impact_level),
                    borderColor: selectedColor,
                  },
                ]}
              >
                <Text style={[styles.impactBadgeText, { color: selectedColor }]}>
                  {selectedZoneResult.impact_level}
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedZoneResult(null)}
                style={styles.detailCloseButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Primary Live Report Metrics: Kemacetan, Polusi AQI, Cuaca, Skor */}
            <View style={styles.reportGrid}>
              <View style={styles.reportMetricTile}>
                <View style={styles.reportTileHead}>
                  <Ionicons name="car-outline" size={14} color="#1E6CEF" />
                  <Text style={styles.reportTileLabel}>Kemacetan</Text>
                </View>
                <Text numberOfLines={1} style={styles.reportTileValue}>
                  {selectedZoneResult.congestion_status}
                </Text>
              </View>

              <View style={styles.reportMetricTile}>
                <View style={styles.reportTileHead}>
                  <Ionicons name="cloud-outline" size={14} color="#F59E0B" />
                  <Text style={styles.reportTileLabel}>Polusi AQI</Text>
                </View>
                <Text numberOfLines={1} style={styles.reportTileValue}>
                  {selectedZoneResult.air_quality?.us_aqi ?? '-'} US AQI
                </Text>
              </View>

              <View style={styles.reportMetricTile}>
                <View style={styles.reportTileHead}>
                  <Ionicons name="partly-sunny-outline" size={14} color="#0284C7" />
                  <Text style={styles.reportTileLabel}>Cuaca</Text>
                </View>
                <Text numberOfLines={1} style={styles.reportTileValue}>
                  {selectedZoneResult.weather
                    ? `${selectedZoneResult.weather.temperature_c}°C • ${selectedZoneResult.weather.condition}`
                    : `${selectedZoneResult.impact_score.toFixed(0)}/100`}
                </Text>
              </View>
            </View>

            {/* Pollutant Details Chip Strip */}
            {selectedZoneResult.air_quality && (
              <View style={styles.pollutantStrip}>
                <View style={styles.pollutantChip}>
                  <Text style={styles.pollutantChipText}>
                    PM2.5: {selectedZoneResult.air_quality.pm2_5} µg/m³
                  </Text>
                </View>
                <View style={styles.pollutantChip}>
                  <Text style={styles.pollutantChipText}>
                    PM10: {selectedZoneResult.air_quality.pm10} µg/m³
                  </Text>
                </View>
                <View style={styles.pollutantChip}>
                  <Text style={styles.pollutantChipText}>
                    CO: {selectedZoneResult.air_quality.carbon_monoxide}
                  </Text>
                </View>
                {selectedZoneResult.weather && (
                  <View style={styles.pollutantChip}>
                    <Text style={styles.pollutantChipText}>
                      Angin: {selectedZoneResult.weather.wind_speed_kmh} km/j
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Additional Info & Recommendations */}
            {selectedZoneResult.zone.pollution_sources?.length > 0 && (
              <View style={styles.infoRowSmall}>
                <Text style={styles.infoLabelSmall}>Sumber:</Text>
                <Text numberOfLines={1} style={styles.infoValueSmall}>
                  {selectedZoneResult.zone.pollution_sources.join(' • ')}
                </Text>
              </View>
            )}

            {selectedZoneResult.recommendations && selectedZoneResult.recommendations.length > 0 && (
              <View style={styles.infoRowSmall}>
                <Text style={styles.infoLabelSmall}>Saran:</Text>
                <Text numberOfLines={1} style={styles.infoValueSmall}>
                  {selectedZoneResult.recommendations[0]}
                </Text>
              </View>
            )}

            {/* Action Buttons: Navigasi + Analisis Penyakit */}
            <View style={styles.actionButtonsRow}>
              <Pressable
                onPress={() => handleNavigateToZone(selectedZoneResult)}
                style={styles.actionNavButton}
              >
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
                <Text style={styles.actionNavText}>Navigasi</Text>
              </Pressable>

              <Pressable
                onPress={() => handleOpenAnalysis(selectedZoneResult)}
                style={styles.actionAnalysisButton}
              >
                <Text style={styles.actionAnalysisText}>Analisis Penyakit &amp; Polusi</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* 6. SEARCH TARGET CARD */}
        {searchTarget && !selectedZoneResult && (
          <View style={[styles.detailCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.detailCardHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text numberOfLines={1} style={styles.detailLocationName}>
                  {searchTarget.n}
                </Text>
                <Text style={styles.detailDistanceText}>
                  {searchTarget.subtitle || highwayLabel(searchTarget.h)} •{' '}
                  {searchTarget.lat.toFixed(4)}, {searchTarget.lon.toFixed(4)}
                </Text>
              </View>
              <View
                style={[styles.impactBadge, { backgroundColor: '#EFF6FF', borderColor: '#1E6CEF' }]}
              >
                <Text style={[styles.impactBadgeText, { color: '#1E6CEF' }]}>
                  {highwayLabel(searchTarget.h)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSearchTarget(null);
                  setSearchQuery('');
                }}
                style={styles.detailCloseButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <Pressable onPress={handleNavigateToTarget} style={styles.actionNavButtonFull}>
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.actionNavFullText}>Mulai Navigasi ke Sini</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  webView: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  /* UNIFIED COMPACT FROSTED HUD */
  topHudContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityScrollWrapper: {
    height: 30,
  },
  categoryScrollWrapper: {
    height: 28,
  },
  cityScrollContent: {
    gap: 6,
    alignItems: 'center',
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
  },
  cityChipActive: {
    backgroundColor: '#1E6CEF',
  },
  cityChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
  },
  catChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  radiusPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radiusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },
  radiusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  radiusChipSelected: {
    backgroundColor: '#0284C7',
  },
  radiusChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  radiusChipTextSelected: {
    color: '#FFFFFF',
  },
  aqiSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  aqiSummaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  aqiCountSubText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#166534',
    marginLeft: 3,
  },
  radarLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },

  scanAreaBannerWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 25,
  },
  scanAreaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  scanAreaText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* NATIVE FLOATING MAP CONTROLS */
  floatingNativeControls: {
    position: 'absolute',
    right: 14,
    zIndex: 25,
    gap: 10,
  },
  nativeMapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nativeMapBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E6CEF',
  },

  /* FLOATING LEGEND */
  legendCard: {
    position: 'absolute',
    left: 14,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  floatingNavPill: {
    position: 'absolute',
    left: 14,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E6CEF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingNavPillText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },

  /* DETAIL CARD */
  detailCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLocationName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailDistanceText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  impactBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 6,
  },
  impactBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  reportMetricTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportTileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  reportTileLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  reportTileValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  pollutantStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pollutantChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pollutantChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  infoRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabelSmall: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    width: 56,
  },
  infoValueSmall: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  actionAnalysisButton: {
    flex: 1,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionAnalysisText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* SEARCH BAR */
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
    margin: 0,
  },

  /* SEARCH DROPDOWN */
  searchDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchResultDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchResultType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* ACTION BUTTONS ROW */
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#10B981',
  },
  actionNavText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* SEARCH TARGET NAVIGATE FULL BUTTON */
  actionNavButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E6CEF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  actionNavFullText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
