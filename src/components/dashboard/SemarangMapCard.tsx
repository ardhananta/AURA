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
const MAP_HEIGHT = 240;

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

  const mapHtml = useMemo(() => {
    const zonesData = (nearbyZones.length > 0 ? nearbyZones : []).map((nz) => ({
      lat: nz.zone.latitude,
      lon: nz.zone.longitude,
      color: getMarkerColor(nz.impact_level),
      name: nz.zone.name,
    }));

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
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E2E8F0; overflow: hidden; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
    
    .user-pulse {
      width: 22px;
      height: 22px;
      background: rgba(2, 132, 199, 0.35);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulseAnim 2s infinite;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.9); opacity: 0.9; }
      50% { transform: scale(1.4); opacity: 0.3; }
      100% { transform: scale(0.9); opacity: 0.9; }
    }
    .user-core {
      width: 12px;
      height: 12px;
      background: #0284C7;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(2, 132, 199, 0.8);
    }

    .pin-container {
      width: 26px;
      height: 32px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .pin-head {
      width: 22px;
      height: 22px;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-core {
      width: 8px;
      height: 8px;
      background: #FFFFFF;
      border-radius: 50%;
    }
    .pin-point {
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      margin-top: -2px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false
    }).setView([${lat}, ${lon}], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // 1. User Position Pulsing Marker
    var userIcon = L.divIcon({
      className: '',
      html: '<div class="user-pulse"><div class="user-core"></div></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([${lat}, ${lon}], { icon: userIcon }).addTo(map);

    // 2. Dynamic Nearby Hotspots
    var zones = ${JSON.stringify(zonesData)};
    if (zones && zones.length > 0) {
      zones.forEach(function(z) {
        var pinHtml = '<div class="pin-container">' +
          '<div class="pin-head" style="background: ' + z.color + '"><div class="pin-core"></div></div>' +
          '<div class="pin-point" style="border-top: 6px solid ' + z.color + '"></div>' +
          '</div>';
        var pinIcon = L.divIcon({
          className: '',
          html: pinHtml,
          iconSize: [26, 32],
          iconAnchor: [13, 30]
        });
        L.marker([z.lat, z.lon], { icon: pinIcon }).addTo(map);
      });
    } else {
      // Fallback pins around center if backend has no nearby records yet
      var fallbackColors = ['#EF4444', '#F59E0B', '#10B981'];
      var offsets = [[0.008, -0.012], [-0.011, 0.007], [0.005, 0.015]];
      offsets.forEach(function(off, idx) {
        var c = fallbackColors[idx % fallbackColors.length];
        var pinHtml = '<div class="pin-container">' +
          '<div class="pin-head" style="background: ' + c + '"><div class="pin-core"></div></div>' +
          '<div class="pin-point" style="border-top: 6px solid ' + c + '"></div>' +
          '</div>';
        var pinIcon = L.divIcon({
          className: '',
          html: pinHtml,
          iconSize: [26, 32],
          iconAnchor: [13, 30]
        });
        L.marker([${lat} + off[0], ${lon} + off[1]], { icon: pinIcon }).addTo(map);
      });
    }
  </script>
</body>
</html>
`;
  }, [lat, lon, nearbyZones]);

  return (
    <View style={styles.container}>
      {/* REAL LEAFLET OPENSTREETMAP DYNAMIC TILE & HOTSPOTS */}
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        userAgent="AURA-Mobile-App/1.0"
        mixedContentMode="always"
      />

      {/* FLOATING SEARCH BAR OVERLAY WITH DYNAMIC LOCATION NAME */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="location" size={18} color="#0284C7" />
          <Text numberOfLines={1} style={styles.searchText}>
            {userLocation?.name || 'Temukan lokasi anda...'}
          </Text>
          {isLoading ? (
            <ActivityIndicator size="small" color="#0284C7" style={{ marginLeft: 6 }} />
          ) : userLocation?.isRealtime ? (
            <View style={styles.gpsBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.gpsBadgeText}>GPS</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Expand Icon Badge in Bottom-Right */}
      <View style={styles.expandBadge}>
        <Ionicons name="expand" size={14} color="#FFFFFF" />
      </View>

      {/* Full Map Tap Overlay to open Fullscreen Map */}
      <Pressable
        onPress={handleOpenMap}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: MAP_CONTAINER_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  searchBarWrapper: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: '#60A5FA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  searchText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  expandBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#2563EB',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
    marginRight: 4,
  },
  gpsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
});
