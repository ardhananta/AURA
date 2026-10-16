import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { NearbyZoneResult, ImpactLevel } from '@/types/zones';

export interface UserLocationProp {
  lat: number;
  lon: number;
  name?: string;
  isRealtime?: boolean;
}

interface SemarangMapCardProps {
  onSearchPress?: () => void;
  onMapPress?: () => void;
  onProfilePress?: () => void;
  userLocation?: UserLocationProp;
  nearbyZones?: NearbyZoneResult[];
  isLoading?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_CONTAINER_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = 252;

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
      return 'rgba(16, 185, 129, 0.35)';
    case 'Waspada':
      return 'rgba(245, 158, 11, 0.35)';
    case 'Berbahaya':
      return 'rgba(239, 68, 68, 0.35)';
    default:
      return 'rgba(30, 108, 239, 0.35)';
  }
}

export const SemarangMapCard: React.FC<SemarangMapCardProps> = ({
  onSearchPress,
  onMapPress,
  onProfilePress,
  userLocation,
  nearbyZones = [],
  isLoading = false,
}) => {
  const handleOpenMap = onMapPress || onSearchPress;

  const lat = userLocation?.lat ?? -6.9932;
  const lon = userLocation?.lon ?? 110.4203;

  // MapLibre GL 3D GIS HTML Template with air quality radar halos
  const mapHtml = useMemo(() => {
    const zonesData = (nearbyZones.length > 0 ? nearbyZones : []).map((nz) => ({
      lat: nz.zone.latitude,
      lon: nz.zone.longitude,
      color: getMarkerColor(nz.impact_level),
      glow: getMarkerGlow(nz.impact_level),
      name: nz.zone.name,
      level: nz.impact_level,
    }));

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

    /* User Realtime Radar Pulse */
    .user-radar-container {
      width: 48px;
      height: 48px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-radar-wave {
      position: absolute;
      width: 48px;
      height: 48px;
      background: rgba(30, 108, 239, 0.22);
      border-radius: 50%;
      animation: radarWave 2.2s infinite ease-out;
    }
    @keyframes radarWave {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    .user-radar-core {
      width: 14px;
      height: 14px;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(30, 108, 239, 0.6);
      z-index: 2;
    }

    /* Hotspot Aura Halo Pin */
    .hotspot-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }
    .hotspot-halo {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      top: -3px;
      animation: haloPulse 2s infinite ease-in-out;
    }
    @keyframes haloPulse {
      0%, 100% { transform: scale(0.95); opacity: 0.6; }
      50% { transform: scale(1.25); opacity: 0.2; }
    }
    .hotspot-core {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.28);
      z-index: 2;
    }
    .hotspot-label {
      background: #FFFFFF;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 800;
      color: #1E293B;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      white-space: nowrap;
      margin-top: 4px;
      border: 1px solid rgba(0,0,0,0.06);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${lat};
    var lon = ${lon};
    var zones = ${JSON.stringify(zonesData)};

    // Initialize MapLibre GL with 3D Perspective Pitch
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
      center: [lon, lat],
      zoom: 13.8,
      pitch: 36, // 3D Perspective Tilt for modern GIS aesthetic
      bearing: -10, // Subtle angle for natural street alignment
      interactive: false,
      attributionControl: false
    });

    map.on('load', function() {
      // 1. User Position Pulsing Radar
      var userEl = document.createElement('div');
      userEl.className = 'user-radar-container';
      userEl.innerHTML = '<div class="user-radar-wave"></div><div class="user-radar-core"></div>';
      new maplibregl.Marker({ element: userEl })
        .setLngLat([lon, lat])
        .addTo(map);

      // 2. Air Quality Hotspots with Glowing Halos
      if (zones && zones.length > 0) {
        zones.forEach(function(z) {
          var el = document.createElement('div');
          el.className = 'hotspot-wrapper';
          el.innerHTML = '<div class="hotspot-halo" style="background: ' + z.glow + '"></div>' +
                         '<div class="hotspot-core" style="background: ' + z.color + '"></div>' +
                         '<div class="hotspot-label">' + z.name + '</div>';
          new maplibregl.Marker({ element: el })
            .setLngLat([z.lon, z.lat])
            .addTo(map);
        });
      } else {
        // Fallback default Semarang zones if backend query is empty
        var defaults = [
          { name: 'Simpang Lima', lon: 110.4227, lat: -6.9904, color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.35)' },
          { name: 'Tugu Muda', lon: 110.4087, lat: -6.9842, color: '#10B981', glow: 'rgba(16, 185, 129, 0.35)' },
          { name: 'Pelabuhan Tanjung Emas', lon: 110.4182, lat: -6.9535, color: '#EF4444', glow: 'rgba(239, 68, 68, 0.35)' }
        ];
        defaults.forEach(function(d) {
          var el = document.createElement('div');
          el.className = 'hotspot-wrapper';
          el.innerHTML = '<div class="hotspot-halo" style="background: ' + d.glow + '"></div>' +
                         '<div class="hotspot-core" style="background: ' + d.color + '"></div>' +
                         '<div class="hotspot-label">' + d.name + '</div>';
          new maplibregl.Marker({ element: el })
            .setLngLat([d.lon, d.lat])
            .addTo(map);
        });
      }
    });
  </script>
</body>
</html>
    `;
  }, [lat, lon, nearbyZones]);

  return (
    <View style={styles.container}>
      {/* 3D GIS MAPLIBRE GL EMBED */}
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        pointerEvents="none"
      />

      {/* TOP FLOATING SEARCH BAR WITH LOCATION & PROFILE AVATAR */}
      <View style={styles.topSearchBarOverlay}>
        <Pressable style={styles.searchBarBox} onPress={handleOpenMap}>
          <View style={styles.searchLocationIconCircle}>
            <Ionicons name="location" size={16} color="#1E6CEF" />
          </View>
          <View style={styles.searchTextWrapper}>
            <Text numberOfLines={1} style={styles.searchLocationTitle}>
              {userLocation?.name || 'Semarang, Jawa Tengah'}
            </Text>
            <Text style={styles.searchPromptSub}>
              Ketuk untuk telusuri radar kualitas udara
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color="#1E6CEF" style={{ marginRight: 6 }} />
          ) : userLocation?.isRealtime ? (
            <View style={styles.gpsLivePill}>
              <View style={styles.gpsLiveDot} />
              <Text style={styles.gpsLiveText}>GPS</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* BOTTOM INFO CHIP & FULLSCREEN EXPAND BUTTON */}
      <View style={styles.bottomBarOverlay} pointerEvents="box-none">
        {/* 3D GIS Radar Chip */}
        <View style={styles.gisRadarChip}>
          <View style={styles.radarStatusDot} />
          <Text style={styles.gisRadarChipText}>
            3D GIS • {nearbyZones.length > 0 ? `${nearbyZones.length} Titik Sensor` : 'Radar Polusi Aktif'}
          </Text>
        </View>

        {/* Expand Fullscreen Button */}
        <Pressable
          style={styles.expandButton}
          onPress={handleOpenMap}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Buka Peta Layar Penuh"
        >
          <Ionicons name="expand" size={15} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Transparent Overlay to trigger full map modal */}
      <Pressable
        onPress={handleOpenMap}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Buka Peta Interaktif"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: MAP_CONTAINER_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },

  /* TOP SEARCH BAR OVERLAY */
  topSearchBarOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  searchBarBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30, 108, 239, 0.18)',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  searchLocationIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  searchTextWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  searchLocationTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  searchPromptSub: {
    color: '#64748B',
    fontWeight: '500',
    fontSize: 10.5,
    marginTop: 0.5,
  },
  gpsLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginRight: 4,
  },
  gpsLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E6CEF',
    marginRight: 4,
  },
  gpsLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E6CEF',
  },

  /* BOTTOM OVERLAY CONTROLS */
  bottomBarOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gisRadarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  radarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  gisRadarChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  expandButton: {
    backgroundColor: '#1E6CEF',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
});
