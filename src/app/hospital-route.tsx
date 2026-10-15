import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { HOSPITALS_DATA, HospitalItem } from '@/data/medical-partners';
import { locationService } from '@/services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HospitalRouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ hospitalId?: string }>();

  // Find target hospital or fallback to RSUP Dr Kariadi
  const hospital: HospitalItem = useMemo(() => {
    const found = HOSPITALS_DATA.find((h) => h.id === params.hospitalId);
    return found || HOSPITALS_DATA[0];
  }, [params.hospitalId]);

  // Mode: 'preview' (Pratinjau Rute) or 'navigation' (Mulai Navigasi Langsung)
  const [mode, setMode] = useState<'preview' | 'navigation'>('preview');
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // User coordinates (Default: Randusari/Bergota area near RSUP Dr Kariadi)
  const [userCoord, setUserCoord] = useState({
    lat: -7.0015,
    lon: 110.4128,
    name: 'Lokasi Anda',
  });

  useEffect(() => {
    const getGps = async () => {
      const res = await locationService.getCurrentGpsLocation();
      if (res.success && res.location) {
        setUserCoord({
          lat: res.location.lat,
          lon: res.location.lon,
          name: 'Lokasi Anda',
        });
      }
    };
    getGps();
  }, []);

  const topPadding =
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 6;

  // Leaflet map HTML matching the exact visual style in references
  const mapHtml = useMemo(() => {
    const startLat = userCoord.lat;
    const startLon = userCoord.lon;
    const destLat = hospital.coordinates.lat;
    const destLon = hospital.coordinates.lon;

    // Waypoints simulating realistic city turn: Jl. Bergota -> Jl. Veteran -> Jl. DR. Sutomo
    const turn1Lat = startLat + (destLat - startLat) * 0.35;
    const turn1Lon = startLon;
    const turn2Lat = turn1Lat;
    const turn2Lon = destLon;

    const routeCoords = [
      [startLat, startLon],
      [turn1Lat, turn1Lon],
      [turn2Lat, turn2Lon],
      [destLat, destLon],
    ];

    const isNav = mode === 'navigation';
    const centerLat = isNav ? turn1Lat : (startLat + destLat) / 2;
    const centerLon = isNav ? turn1Lon : (startLon + destLon) / 2;
    const zoomLevel = isNav ? 16 : 15;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html, #map { width: 100%; height: 100%; background: #F1F5F9; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }

    /* Origin Pulse Circle */
    .user-pulse-container {
      width: 44px;
      height: 44px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-pulse-aura {
      position: absolute;
      width: 44px;
      height: 44px;
      background: rgba(30, 108, 239, 0.22);
      border-radius: 50%;
    }
    .user-core-dot {
      width: 14px;
      height: 14px;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      z-index: 2;
    }

    /* Navigation Mode Arrow Pointer */
    .nav-arrow-wrapper {
      width: 46px;
      height: 46px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-arrow-aura {
      position: absolute;
      width: 46px;
      height: 46px;
      background: rgba(30, 108, 239, 0.25);
      border-radius: 50%;
    }
    .nav-arrow-circle {
      width: 32px;
      height: 32px;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      color: #FFFFFF;
      font-size: 13px;
    }

    /* Hospital Destination Ring Pin */
    .dest-pin-ring {
      width: 22px;
      height: 22px;
      background: #FFFFFF;
      border: 5px solid #1E6CEF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    /* Callout Pill Labels */
    .callout-pill {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 6px 14px;
      font-size: 12.5px;
      font-weight: 700;
      color: #1E6CEF;
      box-shadow: 0 3px 10px rgba(0,0,0,0.14);
      white-space: nowrap;
      display: inline-block;
      border: 1px solid rgba(0,0,0,0.04);
    }
    .callout-origin {
      color: #1E293B;
      padding: 5px 12px;
      font-size: 12px;
    }
    .callout-time {
      color: #1E6CEF;
      font-size: 12px;
      padding: 5px 12px;
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
    }).setView([${centerLat}, ${centerLon}], ${zoomLevel});

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var route = ${JSON.stringify(routeCoords)};

    // Outer subtle glow
    L.polyline(route, {
      color: '#BFDBFE',
      weight: 12,
      opacity: 0.7,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Main solid blue route
    L.polyline(route, {
      color: '#1E6CEF',
      weight: 7,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    ${
      isNav
        ? `
      // Navigation vehicle cursor
      var navIcon = L.divIcon({
        className: '',
        html: '<div class="nav-arrow-wrapper"><div class="nav-arrow-aura"></div><div class="nav-arrow-circle">▲</div></div>',
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });
      L.marker([${turn1Lat}, ${turn1Lon}], { icon: navIcon }).addTo(map);
    `
        : `
      // User Origin Marker
      var originIcon = L.divIcon({
        className: '',
        html: '<div class="user-pulse-container"><div class="user-pulse-aura"></div><div class="user-core-dot"></div></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      L.marker([${startLat}, ${startLon}], { icon: originIcon }).addTo(map);

      // "Lokasi Anda" Pill below origin
      var originPill = L.divIcon({
        className: '',
        html: '<div class="callout-pill callout-origin">Lokasi Anda</div>',
        iconSize: [100, 28],
        iconAnchor: [50, -12]
      });
      L.marker([${startLat}, ${startLon}], { icon: originPill }).addTo(map);

      // "5 menit" ETA bubble along the route
      var etaPill = L.divIcon({
        className: '',
        html: '<div class="callout-pill callout-time">5 menit</div>',
        iconSize: [80, 28],
        iconAnchor: [40, 14]
      });
      L.marker([${turn1Lat}, ${turn1Lon + (turn2Lon - turn1Lon) * 0.5}], { icon: etaPill }).addTo(map);
    `
    }

    // Destination Hospital Ring Pin
    var destPin = L.divIcon({
      className: '',
      html: '<div class="dest-pin-ring"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([${destLat}, ${destLon}], { icon: destPin }).addTo(map);

    // "RSUP. Dr Kariadi" Pill label at destination
    var destPill = L.divIcon({
      className: '',
      html: '<div class="callout-pill">${hospital.name}</div>',
      iconSize: [160, 32],
      iconAnchor: [-16, 16]
    });
    L.marker([${destLat}, ${destLon}], { icon: destPill }).addTo(map);
  </script>
</body>
</html>
    `;
  }, [userCoord, hospital, mode]);

  return (
    <View style={styles.container}>
      {/* ============================================================ */}
      {/* MODE 1: ROUTE PREVIEW MODE (IMAGE 2)                         */}
      {/* ============================================================ */}
      {mode === 'preview' ? (
        <View style={styles.fullscreen}>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

          {/* TOP HEADER BAR */}
          <View style={[styles.previewHeaderBar, { paddingTop: topPadding }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.previewBackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
            >
              <Ionicons name="arrow-back" size={20} color="#1E6CEF" />
            </Pressable>
            <Text style={styles.previewHeaderTitle}>Rute ke Rumah Sakit</Text>
          </View>

          {/* ORIGIN & DESTINATION INPUT CARDS */}
          <View style={styles.routeInputSection}>
            {/* Left timeline indicator */}
            <View style={styles.timelineWrapper}>
              <View style={styles.originDot} />
              <View style={styles.timelineDottedLine} />
              <Ionicons name="location-sharp" size={18} color="#1E6CEF" />
            </View>

            {/* Right text fields */}
            <View style={styles.fieldsContainer}>
              <View style={styles.routeFieldBox}>
                <Text style={styles.originFieldText} numberOfLines={1}>
                  {userCoord.name}
                </Text>
              </View>

              <View style={[styles.routeFieldBox, { marginTop: 10 }]}>
                <Text style={styles.destFieldText} numberOfLines={1}>
                  {hospital.name}
                </Text>
              </View>
            </View>
          </View>

          {/* MAP AREA (Fills available space) */}
          <View style={styles.mapArea}>
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebView}
              scrollEnabled={true}
              overScrollMode="never"
            />

            {/* Top Right: Compass Button */}
            <View style={styles.compassButton}>
              <Ionicons name="navigate-outline" size={18} color="#1E6CEF" />
              <Text style={styles.compassLetter}>U</Text>
            </View>

            {/* Bottom Right: Recenter / Locate Button */}
            <Pressable
              style={styles.locateButton}
              onPress={() => setUserCoord((prev) => ({ ...prev }))}
            >
              <Ionicons name="locate" size={22} color="#1E6CEF" />
            </Pressable>
          </View>

          {/* GUARANTEED FIXED BOTTOM SUMMARY CARD */}
          <View
            style={[
              styles.bottomSummaryCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Mode & Fastest Tag */}
            <View style={styles.transportRow}>
              <View style={styles.mobilBadge}>
                <Ionicons name="car" size={16} color="#1E6CEF" style={{ marginRight: 6 }} />
                <Text style={styles.mobilBadgeText}>Mobil</Text>
              </View>
              <Text style={styles.fastestTagText}>Rute tercepat</Text>
            </View>

            {/* Time & Distance Details */}
            <View style={styles.durationRow}>
              <View style={styles.durationLeft}>
                <Text style={styles.durationMainText}>5 menit</Text>
                <Text style={styles.durationDistanceText}>
                  {' '}• {hospital.distance ? hospital.distance.split('–')[0].trim() : '1,2 km'}
                </Text>
              </View>
              <Text style={styles.etaText}>Tiba 09.46</Text>
            </View>

            {/* Road Details */}
            <Text style={styles.routeViaText}>
              Via Jl. Veteran dan Jl. DR. Sutomo
            </Text>

            {/* MULAI NAVIGASI BUTTON (PROMINENT, GUARANTEED VISIBLE) */}
            <Pressable
              onPress={() => setMode('navigation')}
              style={styles.mulaiNavigasiBtn}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.mulaiNavigasiText}>Mulai Navigasi</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* ============================================================ */
        /* MODE 2: ACTIVE LIVE NAVIGATION MODE (IMAGE 1)                */
        /* ============================================================ */
        <View style={styles.fullscreen}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          {/* TOP TURN-BY-TURN BLUE BANNER */}
          <View style={[styles.navHeaderBanner, { paddingTop: topPadding }]}>
            <View style={styles.maneuverRow}>
              {/* Turn Icon Box */}
              <View style={styles.turnIconBox}>
                <Ionicons name="arrow-undo" size={32} color="#FFFFFF" />
              </View>

              {/* Turn Instruction Text */}
              <View style={styles.maneuverTextWrapper}>
                <Text style={styles.distanceBig}>200 m</Text>
                <Text style={styles.turnActionText}>Belok kiri</Text>
                <Text style={styles.roadTargetText}>ke Jl. Veteran</Text>
              </View>
            </View>

            {/* Next Road Preview Row */}
            <View style={styles.nextManeuverRow}>
              <Text style={styles.laluLabel}>Lalu</Text>
              <Ionicons name="arrow-redo" size={16} color="#FFFFFF" style={{ marginHorizontal: 6 }} />
              <Text style={styles.nextRoadText}>Jl. DR. Sutomo</Text>
            </View>
          </View>

          {/* NAVIGATION MAP AREA */}
          <View style={styles.mapArea}>
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebView}
              scrollEnabled={true}
              overScrollMode="never"
            />

            {/* Top Right: Compass */}
            <View style={styles.compassButtonNav}>
              <Ionicons name="navigate-outline" size={18} color="#1E6CEF" />
              <Text style={styles.compassLetter}>U</Text>
            </View>

            {/* Left Button: Audio Mute / Unmute */}
            <Pressable
              style={styles.navSpeakerButton}
              onPress={() => setIsAudioMuted(!isAudioMuted)}
            >
              <Ionicons
                name={isAudioMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color="#1E6CEF"
              />
            </Pressable>

            {/* Center Bottom: Street Label */}
            <View style={styles.currentStreetPill}>
              <Text style={styles.currentStreetText}>Menuju Jl. Veteran</Text>
            </View>

            {/* Right Button: Locate Recenter */}
            <Pressable
              style={styles.navLocateButton}
              onPress={() => setUserCoord((prev) => ({ ...prev }))}
            >
              <Ionicons name="locate" size={22} color="#1E6CEF" />
            </Pressable>
          </View>

          {/* GUARANTEED FIXED BOTTOM NAVIGATION INFO CARD */}
          <View
            style={[
              styles.bottomNavCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Time, Distance & Close Button Row */}
            <View style={styles.navCardHeader}>
              <View>
                <Text style={styles.navCardTimeText}>4 menit</Text>
                <Text style={styles.navCardSubText}>0,9 km lagi • Tiba 09.46</Text>
              </View>

              {/* Close Button: Exit Navigation */}
              <Pressable
                style={styles.navCloseBtn}
                onPress={() => setMode('preview')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#1E293B" />
              </Pressable>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>

            {/* Hospital Destination Details */}
            <View style={styles.navHospitalRow}>
              <View style={styles.navHospitalIconBox}>
                <MaterialCommunityIcons name="hospital-building" size={22} color="#1E6CEF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.navHospitalName}>{hospital.name}</Text>
                <Text style={styles.navHospitalAddress}>{hospital.address}</Text>
              </View>
            </View>

            <Text style={styles.progressSummaryText}>
              300 m dari 1,2 km telah ditempuh
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  /* ========================================== */
  /* PREVIEW MODE STYLES                        */
  /* ========================================== */
  previewHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  previewBackButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#E8F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  routeInputSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    flexShrink: 0,
  },
  timelineWrapper: {
    alignItems: 'center',
    marginRight: 14,
    width: 20,
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E6CEF',
  },
  timelineDottedLine: {
    width: 2,
    height: 24,
    backgroundColor: '#BFDBFE',
    marginVertical: 4,
  },
  fieldsContainer: {
    flex: 1,
  },
  routeFieldBox: {
    backgroundColor: '#F0F6FE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  originFieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  destFieldText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  mapWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  compassButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  compassLetter: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E6CEF',
    marginTop: -2,
  },
  locateButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  bottomSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    flexShrink: 0,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobilBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  mobilBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  fastestTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 12,
  },
  durationLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  durationMainText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: -0.4,
  },
  durationDistanceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  etaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  routeViaText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  mulaiNavigasiBtn: {
    backgroundColor: '#1E6CEF',
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 1000,
    elevation: 6,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mulaiNavigasiText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ========================================== */
  /* LIVE NAVIGATION MODE STYLES                */
  /* ========================================== */
  navHeaderBanner: {
    backgroundColor: '#1E6CEF', // Vibrant solid blue banner
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexShrink: 0,
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  maneuverTextWrapper: {
    flex: 1,
  },
  distanceBig: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  turnActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
  roadTargetText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 1,
  },
  nextManeuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  laluLabel: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  nextRoadText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compassButtonNav: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  navSpeakerButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  currentStreetPill: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  currentStreetText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  navLocateButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  bottomNavCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    flexShrink: 0,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  navCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navCardTimeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: -0.4,
  },
  navCardSubText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  navCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    width: '28%',
    height: '100%',
    backgroundColor: '#1E6CEF',
    borderRadius: 3,
  },
  navHospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navHospitalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navHospitalName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  navHospitalAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 1,
  },
  progressSummaryText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 8,
  },
});
