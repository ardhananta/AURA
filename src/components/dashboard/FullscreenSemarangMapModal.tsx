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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { zonesApi } from '@/services/zonesApi';
import {
  NearbyZonesData,
  NearbyZoneResult,
  ImpactLevel,
} from '@/types/zones';

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
  { name: 'Surabaya', lat: -7.2654, lon: 112.7483 },
  { name: 'Bandung', lat: -6.9025, lon: 107.6186 },
];

function getMarkerColor(level: ImpactLevel): string {
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

function getMarkerGlow(level: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return 'rgba(16, 185, 129, 0.4)';
    case 'Waspada':
      return 'rgba(245, 158, 11, 0.4)';
    case 'Berbahaya':
      return 'rgba(239, 68, 68, 0.4)';
    default:
      return 'rgba(30, 108, 239, 0.4)';
  }
}

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
  const [nearbyData, setNearbyData] = useState<NearbyZonesData | null>(null);
  const [selectedZoneResult, setSelectedZoneResult] = useState<NearbyZoneResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);

  useEffect(() => {
    if (userLocation) {
      setActiveCity({
        name: userLocation.name || 'Lokasi Saya (GPS)',
        lat: userLocation.lat,
        lon: userLocation.lon,
      });
    }
  }, [userLocation]);

  const topPadding =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 24) + 8
      : Math.max(insets.top, 14);

  const loadNearbyHotspots = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await zonesApi.getNearbyZones(
        activeCity.lat,
        activeCity.lon,
        radiusKm
      );
      setNearbyData(data);
      if (data.nearby_zones && data.nearby_zones.length > 0) {
        setSelectedZoneResult(data.nearby_zones[0]);
      } else {
        setSelectedZoneResult(null);
      }
    } catch (err: any) {
      console.warn('[MapModal] Failed fetching nearby zones:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCity, radiusKm]);

  useEffect(() => {
    if (visible) {
      loadNearbyHotspots();
    }
  }, [visible, loadNearbyHotspots]);

  // Reactive updates without full WebView reload
  useEffect(() => {
    if (isMapLoaded && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.updateRadius) { window.updateRadius(${radiusKm}); }
        true;
      `);
    }
  }, [radiusKm, isMapLoaded]);

  useEffect(() => {
    if (isMapLoaded && webViewRef.current && nearbyData) {
      const zonesJson = JSON.stringify(
        (nearbyData.nearby_zones || []).map((nz) => ({
          id: nz.zone.id,
          name: nz.zone.name,
          lat: nz.zone.latitude,
          lon: nz.zone.longitude,
          impactLevel: nz.impact_level,
          color: getMarkerColor(nz.impact_level),
          glow: getMarkerGlow(nz.impact_level),
          congestion: nz.congestion_status,
        }))
      );
      webViewRef.current.injectJavaScript(`
        if (window.updateZones) { window.updateZones(${zonesJson}); }
        true;
      `);
    }
  }, [nearbyData, isMapLoaded]);

  useEffect(() => {
    if (isMapLoaded && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.setCenter) { window.setCenter(${activeCity.lon}, ${activeCity.lat}, ${radiusKm}); }
        true;
      `);
    }
  }, [activeCity, isMapLoaded, radiusKm]);

  // MapLibre GL 3D GIS HTML Initial Template
  const mapHtml = useMemo(() => {
    const initialZones = JSON.stringify(
      (nearbyData?.nearby_zones || []).map((nz) => ({
        id: nz.zone.id,
        name: nz.zone.name,
        lat: nz.zone.latitude,
        lon: nz.zone.longitude,
        impactLevel: nz.impact_level,
        color: getMarkerColor(nz.impact_level),
        glow: getMarkerGlow(nz.impact_level),
        congestion: nz.congestion_status,
      }))
    );

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

    /* Hotspot Aura Pin */
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
      transform: scale(1.15);
    }
    .hotspot-halo {
      position: absolute;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      top: -5px;
      animation: haloPulse 2.2s infinite ease-in-out;
    }
    @keyframes haloPulse {
      0%, 100% { transform: scale(0.92); opacity: 0.6; }
      50% { transform: scale(1.3); opacity: 0.2; }
    }
    .hotspot-core {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      z-index: 2;
    }
    .hotspot-label {
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(4px);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 10.5px;
      font-weight: 800;
      color: #0F172A;
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
      white-space: nowrap;
      margin-top: 4px;
      border: 1px solid rgba(0,0,0,0.06);
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
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
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
      zoom: 13.2,
      pitch: 38,
      bearing: -8,
      maxPitch: 65,
      attributionControl: false
    });

    function addHotspotMarker(z) {
      var el = document.createElement('div');
      el.className = 'hotspot-wrapper';
      el.innerHTML = '<div class="hotspot-halo" style="background: ' + z.glow + '"></div>' +
                     '<div class="hotspot-core" style="background: ' + z.color + '"></div>' +
                     '<div class="hotspot-label">' + z.name + '</div>';

      function handleSelect(e) {
        if (e) { e.stopPropagation(); }
        map.flyTo({
          center: [z.lon, z.lat],
          zoom: 14.5,
          pitch: 42,
          duration: 700
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_ZONE', zoneId: z.id }));
        }
      }

      el.addEventListener('pointerup', handleSelect);
      el.addEventListener('click', handleSelect);

      var marker = new maplibregl.Marker({ element: el })
        .setLngLat([z.lon, z.lat])
        .addTo(map);

      currentMarkers.push(marker);
    }

    map.on('load', function() {
      // 1. Add Radius Circle GeoJSON Source and Layers
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
          'fill-opacity': 0.10
        }
      });

      map.addLayer({
        id: 'radius-circle-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#0284C7',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.85
        }
      });

      // 2. Center User / City Radar Marker
      var centerEl = document.createElement('div');
      centerEl.className = 'center-radar-container';
      centerEl.innerHTML = '<div class="center-radar-wave"></div><div class="center-radar-core"></div>';
      centerMarker = new maplibregl.Marker({ element: centerEl })
        .setLngLat([centerLon, centerLat])
        .addTo(map);

      // 3. Initial Hotspot Markers
      var initialZonesList = ${initialZones};
      initialZonesList.forEach(function(z) {
        addHotspotMarker(z);
      });

      // Signal ready to React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_LOADED' }));
      }
    });

    // Reactive Global Window Functions
    window.updateRadius = function(newRadiusKm) {
      radiusKm = newRadiusKm;
      if (map && map.getSource('radius-circle')) {
        map.getSource('radius-circle').setData(createGeoJSONCircle([centerLon, centerLat], radiusKm));
      }
    };

    window.updateZones = function(newZones) {
      currentMarkers.forEach(function(m) { m.remove(); });
      currentMarkers = [];
      newZones.forEach(function(z) {
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
        zoom: 13.2,
        pitch: is3D ? 38 : 0,
        bearing: is3D ? -8 : 0,
        duration: 900
      });
    };

    window.toggle3D = function() {
      if (is3D) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
        is3D = false;
      } else {
        map.easeTo({ pitch: 38, bearing: -8, duration: 500 });
        is3D = true;
      }
      return is3D;
    };

    window.recenterMap = function() {
      map.flyTo({
        center: [centerLon, centerLat],
        zoom: 13.2,
        pitch: is3D ? 38 : 0,
        bearing: is3D ? -8 : 0,
        duration: 800
      });
    };
  </script>
</body>
</html>
    `;
  }, []); // Static initial template, dynamic state updated via injectJavaScript

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'MAP_LOADED') {
        setIsMapLoaded(true);
      } else if (payload.type === 'SELECT_ZONE' && payload.zoneId && nearbyData) {
        const found = nearbyData.nearby_zones.find(
          (z) => z.zone.id === payload.zoneId
        );
        if (found) {
          setSelectedZoneResult(found);
        }
      }
    } catch (e) {
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

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

        {/* 2. UNIFIED COMPACT FROSTED HUD (ROW 1 + ROW 2) */}
        <View style={[styles.topUnifiedCard, { top: topPadding }]}>
          {/* Row 1: Back Button, Horizontal Cities, Refresh */}
          <View style={styles.topRow}>
            <Pressable
              onPress={onClose}
              style={styles.circleIconButton}
              accessibilityLabel="Kembali"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </Pressable>

            {/* City Selector Pills */}
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
                      onPress={() => setActiveCity(city)}
                      style={[
                        styles.cityChip,
                        isActive && styles.cityChipActive,
                      ]}
                    >
                      {isGPS && (
                        <Ionicons
                          name="navigate"
                          size={11}
                          color={isActive ? '#FFFFFF' : '#1E6CEF'}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.cityChipText,
                          isActive && styles.cityChipTextActive,
                        ]}
                      >
                        {city.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Pressable
              onPress={loadNearbyHotspots}
              style={styles.circleIconButton}
              accessibilityLabel="Refresh"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1E6CEF" />
              ) : (
                <Ionicons name="refresh" size={18} color="#0F172A" />
              )}
            </Pressable>
          </View>

          {/* Row 2: Radius Selector & Compact AQI Pill in 1 line */}
          <View style={styles.subRow}>
            {/* Radius Options */}
            <View style={styles.radiusPillBox}>
              <Text style={styles.radiusLabel}>Radius:</Text>
              {[5, 10, 20].map((r) => {
                const isSelected = radiusKm === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRadiusKm(r)}
                    style={[
                      styles.radiusChip,
                      isSelected && styles.radiusChipSelected,
                    ]}
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

            {/* Compact AQI / Sensor Summary */}
            {nearbyData?.local_environment?.air_quality ? (
              <View style={styles.aqiSummaryBadge}>
                <Ionicons name="leaf" size={13} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={styles.aqiSummaryText}>
                  AQI {nearbyData.local_environment.air_quality.us_aqi}
                </Text>
                <Text style={styles.aqiCountSubText}>
                  • {nearbyData.zones_found_count} Hotspot
                </Text>
              </View>
            ) : (
              <View style={styles.aqiSummaryBadge}>
                <View style={styles.radarLiveDot} />
                <Text style={styles.aqiSummaryText}>Radar 3D Aktif</Text>
              </View>
            )}
          </View>
        </View>

        {/* 3. NATIVE FLOATING 3D & RECENTER CONTROLS (DYNAMIC POSITION) */}
        <View
          style={[
            styles.floatingNativeControls,
            { bottom: selectedZoneResult ? 280 : insets.bottom + 28 },
          ]}
          pointerEvents="box-none"
        >
          {/* 3D / 2D Perspective Toggle */}
          <Pressable
            style={styles.nativeMapBtn}
            onPress={handleToggle3D}
            accessibilityLabel="Ganti Perspektif 3D"
          >
            <Text style={styles.nativeMapBtnText}>{is3DMode ? '3D' : '2D'}</Text>
          </Pressable>

          {/* Recenter Button */}
          <Pressable
            style={styles.nativeMapBtn}
            onPress={handleRecenter}
            accessibilityLabel="Pusat Peta"
          >
            <Ionicons name="locate" size={20} color="#1E6CEF" />
          </Pressable>
        </View>

        {/* 4. FLOATING LEGEND (ONLY WHEN BOTTOM DETAIL CARD IS CLOSED) */}
        {!selectedZoneResult && (
          <View style={[styles.legendCard, { bottom: insets.bottom + 28 }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendLabel}>Bahaya</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendLabel}>Waspada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendLabel}>Aman</Text>
            </View>
          </View>
        )}

        {/* 5. INTERACTIVE HOTSPOT DETAIL BOTTOM CARD */}
        {selectedZoneResult && (
          <View style={[styles.detailCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.detailCardHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text numberOfLines={1} style={styles.detailLocationName}>
                  {selectedZoneResult.zone.name}
                </Text>
                <Text style={styles.detailDistanceText}>
                  Jarak: {selectedZoneResult.distance_km.toFixed(1)} km dari titik pusat
                </Text>
              </View>

              {/* Impact Level Badge */}
              <View
                style={[
                  styles.impactBadge,
                  {
                    backgroundColor: getBadgeBg(selectedZoneResult.impact_level),
                    borderColor: getMarkerColor(selectedZoneResult.impact_level),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.impactBadgeText,
                    { color: getMarkerColor(selectedZoneResult.impact_level) },
                  ]}
                >
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

            {/* Metrics: Kemacetan & Skor Dampak */}
            <View style={styles.detailMetricsRow}>
              <View style={styles.detailMetricBox}>
                <Ionicons name="car-outline" size={18} color="#0284C7" />
                <View style={{ marginLeft: 6 }}>
                  <Text style={styles.detailMetricLabel}>Kemacetan</Text>
                  <Text style={styles.detailMetricValue}>
                    {selectedZoneResult.congestion_status}
                  </Text>
                </View>
              </View>

              <View style={styles.detailMetricDivider} />

              <View style={styles.detailMetricBox}>
                <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                <View style={{ marginLeft: 6 }}>
                  <Text style={styles.detailMetricLabel}>Skor Dampak</Text>
                  <Text style={styles.detailMetricValue}>
                    {selectedZoneResult.impact_score.toFixed(1)}/100
                  </Text>
                </View>
              </View>
            </View>

            {/* Peak Hours & Pollution Sources */}
            {selectedZoneResult.zone.peak_hours && (
              <View style={styles.infoRowSmall}>
                <Text style={styles.infoLabelSmall}>Jam Sibuk:</Text>
                <Text style={styles.infoValueSmall}>
                  {selectedZoneResult.zone.peak_hours.join(', ')}
                </Text>
              </View>
            )}

            {selectedZoneResult.zone.pollution_sources && (
              <View style={styles.infoRowSmall}>
                <Text style={styles.infoLabelSmall}>Sumber Polusi:</Text>
                <Text numberOfLines={1} style={styles.infoValueSmall}>
                  {selectedZoneResult.zone.pollution_sources.join(' • ')}
                </Text>
              </View>
            )}

            {/* Action Button: Prediksi 7 Hari */}
            <Pressable
              onPress={() => handleOpenAnalysis(selectedZoneResult)}
              style={styles.actionAnalysisButton}
            >
              <Text style={styles.actionAnalysisText}>
                Lihat Analisis Prediksi 7 Hari
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
  topUnifiedCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityScrollWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  cityScrollContent: {
    gap: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  cityChipActive: {
    backgroundColor: '#1E6CEF',
  },
  cityChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },

  /* SUB-ROW: RADIUS & AQI SUMMARY */
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
    padding: 18,
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
    marginBottom: 12,
  },
  detailLocationName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailDistanceText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    marginRight: 8,
  },
  impactBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  detailMetricBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailMetricLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  detailMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  infoRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    width: 95,
  },
  infoValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
    flex: 1,
  },
  actionAnalysisButton: {
    marginTop: 14,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionAnalysisText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
