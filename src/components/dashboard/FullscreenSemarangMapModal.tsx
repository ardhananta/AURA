import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { zonesApi } from '@/services/zonesApi';
import {
  NearbyZonesData,
  NearbyZoneResult,
  ImpactLevel,
  TrafficSeverity,
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
      return '#3B82F6';
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
      return '#F1F5F9';
  }
}

export const FullscreenSemarangMapModal: React.FC<FullscreenSemarangMapModalProps> = ({
  visible,
  onClose,
  userLocation,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    if (userLocation) {
      setActiveCity({
        name: userLocation.name || 'Lokasi Saya (GPS)',
        lat: userLocation.lat,
        lon: userLocation.lon,
      });
    }
  }, [userLocation]);

  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [nearbyData, setNearbyData] = useState<NearbyZonesData | null>(null);
  const [selectedZoneResult, setSelectedZoneResult] = useState<NearbyZoneResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const topPadding =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 24) + 10
      : Math.max(insets.top, 12);

  const loadNearbyHotspots = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
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
      setLoadError(err?.message || 'Gagal memuat zona terdekat');
    } finally {
      setIsLoading(false);
    }
  }, [activeCity, radiusKm]);

  useEffect(() => {
    if (visible) {
      loadNearbyHotspots();
    }
  }, [visible, loadNearbyHotspots]);

  // Generate Leaflet HTML dynamically with the real nearby hotspots and radius circle
  const mapHtml = useMemo(() => {
    const zones = nearbyData?.nearby_zones || [];
    const zonesJson = JSON.stringify(
      zones.map((nz) => ({
        id: nz.zone.id,
        name: nz.zone.name,
        lat: nz.zone.latitude,
        lng: nz.zone.longitude,
        impactLevel: nz.impact_level,
        color: getMarkerColor(nz.impact_level),
        congestion: nz.congestion_status,
      }))
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E2E8F0; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }

    .pulse-center {
      width: 18px;
      height: 18px;
      background: #0284C7;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(2, 132, 199, 0.6);
    }

    .hotspot-pin {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      cursor: pointer;
      transition: transform 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hotspot-pin:hover, .hotspot-pin:active {
      transform: scale(1.3);
    }
    .hotspot-inner {
      width: 6px;
      height: 6px;
      background: #FFFFFF;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true
    }).setView([${activeCity.lat}, ${activeCity.lon}], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Center Radius Circle
    var radiusMeters = ${radiusKm * 1000};
    L.circle([${activeCity.lat}, ${activeCity.lon}], {
      radius: radiusMeters,
      color: '#0284C7',
      fillColor: '#38BDF8',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6, 6'
    }).addTo(map);

    // Center User Marker
    var centerIcon = L.divIcon({
      className: '',
      html: '<div class="pulse-center"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker([${activeCity.lat}, ${activeCity.lon}], { icon: centerIcon }).addTo(map);

    // Hotspot Zones
    var zones = ${zonesJson};
    zones.forEach(function(z) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="hotspot-pin" style="background: ' + z.color + ';"><div class="hotspot-inner"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      var marker = L.marker([z.lat, z.lng], { icon: icon }).addTo(map);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_ZONE', zoneId: z.id }));
        }
      });
    });
  </script>
</body>
</html>
    `;
  }, [activeCity, radiusKm, nearbyData]);

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'SELECT_ZONE' && payload.zoneId && nearbyData) {
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

        {/* 1. INTERACTIVE MAP */}
        <WebView
          key={`${activeCity.lat}-${activeCity.lon}-${radiusKm}-${nearbyData?.nearby_zones?.length || 0}`}
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

        {/* 2. TOP HEADER BAR */}
        <View style={[styles.topHeaderBar, { top: topPadding }]}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#0284C7" />
          </Pressable>

          {/* City Selector Pill */}
          <View style={styles.cityPillContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {cityPresets.map((city) => {
                const isActive = activeCity.name === city.name;
                return (
                  <Pressable
                    key={city.name}
                    onPress={() => setActiveCity(city)}
                    style={[
                      styles.cityChip,
                      isActive && styles.cityChipActive,
                    ]}
                  >
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

          <Pressable onPress={loadNearbyHotspots} style={styles.backButton}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : (
              <Ionicons name="refresh" size={20} color="#0284C7" />
            )}
          </Pressable>
        </View>

        {/* 3. RADIUS FILTER CHIPS */}
        <View style={[styles.radiusFilterWrapper, { top: topPadding + 58 }]}>
          <View style={styles.radiusPill}>
            <Ionicons name="radio-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.radiusLabel}>Radius:</Text>
            {[5, 10, 20].map((r) => {
              const isSelected = radiusKm === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRadiusKm(r)}
                  style={[
                    styles.radiusOption,
                    isSelected && styles.radiusOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.radiusOptionText,
                      isSelected && styles.radiusOptionTextSelected,
                    ]}
                  >
                    {r} km
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. LOCAL ENVIRONMENT AQI BANNER */}
        {nearbyData?.local_environment?.air_quality && (
          <View style={[styles.aqiBanner, { top: topPadding + 104 }]}>
            <Ionicons name="leaf" size={16} color="#10B981" />
            <Text style={styles.aqiBannerText}>
              AQI Sekitar: {nearbyData.local_environment.air_quality.us_aqi} | PM2.5:{' '}
              {nearbyData.local_environment.air_quality.pm2_5.toFixed(1)} µg/m³
            </Text>
            <View style={styles.foundCountBadge}>
              <Text style={styles.foundCountText}>
                {nearbyData.zones_found_count} Hotspot
              </Text>
            </View>
          </View>
        )}

        {/* 5. BOTTOM-LEFT FLOATING LEGEND CARD */}
        <View style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendLabel}>Berbahaya</Text>
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

        {/* 6. INTERACTIVE HOTSPOT DETAIL CARD */}
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
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Metrics: Kemacetan & Skor Risiko */}
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
  topHeaderBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  cityPillContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  cityChipActive: {
    backgroundColor: '#0284C7',
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },
  radiusFilterWrapper: {
    position: 'absolute',
    left: 16,
    zIndex: 25,
  },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  radiusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
  },
  radiusOption: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 4,
  },
  radiusOptionSelected: {
    backgroundColor: '#0284C7',
  },
  radiusOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  radiusOptionTextSelected: {
    color: '#FFFFFF',
  },
  aqiBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  aqiBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  foundCountBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  foundCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  legendCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
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
