import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { HOSPITALS_DATA, HospitalItem } from '@/data/medical-partners';
import { getPrecomputedRoute } from '@/data/hospital-routes-precomputed';
import { locationService } from '@/services/locationService';

// Haversine formula to compute distance in meters between two lat/lon points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute compass bearing (0-360 deg) from point 1 to point 2
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// Format meters to human readable distance (e.g., "350 m" or "2,4 km")
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters))} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

// Format seconds to human readable duration (e.g., "5 menit" or "1 jam 12 mnt")
function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins <= 1) return '1 menit';
  if (mins < 60) return `${mins} menit`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} jam ${remMins} mnt` : `${hrs} jam`;
}

// Format timestamp to arrival time string "Tiba HH.mm"
function formatEtaTime(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  const hh = arrival.getHours().toString().padStart(2, '0');
  const mm = arrival.getMinutes().toString().padStart(2, '0');
  return `Tiba ${hh}.${mm}`;
}

interface ManeuverStep {
  distanceMeters: number;
  actionText: string;
  roadText: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lon, lat]
  summaryRoads: string;
  firstManeuver: ManeuverStep;
  nextManeuver: ManeuverStep;
}

// Helper to translate turn maneuvers into Indonesian instructions
function parseManeuver(step: any, defaultRoad: string): ManeuverStep {
  if (!step) {
    return {
      distanceMeters: 150,
      actionText: 'Lurus terus',
      roadText: defaultRoad,
      iconName: 'arrow-up',
    };
  }
  const type = step.type || step.maneuver?.type || 'turn';
  const mod = step.modifier || step.maneuver?.modifier || '';
  const rawName = step.name ? step.name.trim() : '';
  const roadName = rawName ? (rawName.startsWith('Jl') ? rawName : `Jl. ${rawName}`) : defaultRoad;

  let actionText = 'Lurus terus';
  let iconName: keyof typeof Ionicons.glyphMap = 'arrow-up';

  if (mod.includes('left')) {
    actionText = mod.includes('sharp')
      ? 'Belok tajam ke kiri'
      : mod.includes('slight')
      ? 'Ambil serong kiri'
      : 'Belok kiri';
    iconName = 'arrow-undo';
  } else if (mod.includes('right')) {
    actionText = mod.includes('sharp')
      ? 'Belok tajam ke kanan'
      : mod.includes('slight')
      ? 'Ambil serong kanan'
      : 'Belok kanan';
    iconName = 'arrow-redo';
  } else if (mod === 'uturn') {
    actionText = 'Putar balik';
    iconName = 'refresh';
  } else if (type === 'roundabout') {
    actionText = 'Masuk bundaran';
    iconName = 'refresh-circle';
  } else if (type === 'arrive') {
    actionText = 'Tiba di tujuan';
    iconName = 'location';
  }

  return {
    distanceMeters: Math.round(step.distance || 150),
    actionText,
    roadText: `ke ${roadName}`,
    iconName,
  };
}

export default function HospitalRouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const params = useLocalSearchParams<{ hospitalId?: string }>();

  // Find target hospital or fallback to RSUP Dr Kariadi
  const hospital: HospitalItem = useMemo(() => {
    const found = HOSPITALS_DATA.find((h) => h.id === params.hospitalId);
    return found || HOSPITALS_DATA[0];
  }, [params.hospitalId]);

  // Mode: 'preview' (Pratinjau Rute) or 'navigation' (Mulai Navigasi Langsung 3D GIS)
  const [mode, setMode] = useState<'preview' | 'navigation'>('preview');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // User coordinates (Default: Semarang Randusari area near RSUP Dr Kariadi)
  const [userCoord, setUserCoord] = useState({
    lat: -7.0015,
    lon: 110.4128,
    name: 'Lokasi Anda (Semarang)',
  });

  // Dynamic route data initialized directly with authentic street polyline
  const [routeData, setRouteData] = useState<RouteCalculationResult>(() => {
    const pre = getPrecomputedRoute(hospital.id);
    const steps = pre.steps || [];
    const firstStepDist = steps.length > 0 ? Math.round(steps[0].distance) : 200;
    const nextStepObj = steps.length > 1 ? steps[1] : steps[0];
    const subStepObj = steps.length > 2 ? steps[2] : null;

    const firstManeuver = parseManeuver(nextStepObj, hospital.name);
    firstManeuver.distanceMeters = firstStepDist > 0 ? firstStepDist : firstManeuver.distanceMeters;

    const nextManeuver = parseManeuver(subStepObj, hospital.name);
    nextManeuver.roadText = nextManeuver.roadText.replace(/^ke\s+/i, '');

    return {
      distanceMeters: pre.distanceMeters,
      durationSeconds: pre.durationSeconds,
      coordinates: pre.coordinates,
      summaryRoads: pre.summaryRoads ? `Via ${pre.summaryRoads}` : `Menuju ${hospital.name}`,
      firstManeuver,
      nextManeuver,
    };
  });

  // Navigation live telemetry state
  const [currentVehiclePos, setCurrentVehiclePos] = useState({
    lat: userCoord.lat,
    lon: userCoord.lon,
    heading: 0,
  });
  const [remainingMeters, setRemainingMeters] = useState(routeData.distanceMeters);
  const [traveledMeters, setTraveledMeters] = useState(0);

  // 1. Fetch real-time user GPS position on mount
  useEffect(() => {
    let isMounted = true;
    const loadGps = async () => {
      setIsLocating(true);
      const res = await locationService.getCurrentGpsLocation();
      if (isMounted && res.success && res.location) {
        setUserCoord({
          lat: res.location.lat,
          lon: res.location.lon,
          name: res.location.name || 'Lokasi GPS Anda',
        });
        setCurrentVehiclePos({
          lat: res.location.lat,
          lon: res.location.lon,
          heading: 0,
        });
      } else if (isMounted) {
        setUserCoord((prev) => ({
          ...prev,
          name: 'Randusari, Semarang Selatan',
        }));
      }
      if (isMounted) setIsLocating(false);
    };
    loadGps();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch real street-following routing from OpenStreetMap routing engine
  useEffect(() => {
    let isCancelled = false;

    const fetchRoute = async () => {
      const startLat = userCoord.lat;
      const startLon = userCoord.lon;
      const destLat = hospital.coordinates.lat;
      const destLon = hospital.coordinates.lon;

      // Primary: High-performance OSM routed-car server (< 1s response)
      // Secondary: OSRM router mirror
      const endpoints = [
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`,
        `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`,
      ];

      for (const url of endpoints) {
        if (isCancelled) return;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) continue;
          const data = await response.json();

          if (data.code === 'Ok' && data.routes && data.routes.length > 0 && !isCancelled) {
            const route = data.routes[0];
            const legs = route.legs?.[0];
            const steps = legs?.steps || [];
            const coords: [number, number][] = route.geometry?.coordinates || [];

            if (coords.length < 2) continue;

            // Extract unique road names
            const roadNames: string[] = Array.from(
              new Set(
                steps
                  .map((s: any) => s.name?.trim())
                  .filter((n: string) => n && n.length > 0)
              )
            );

            let summaryRoads = 'Rute tercepat';
            if (roadNames.length >= 2) {
              summaryRoads = `Via ${roadNames[0]} dan ${roadNames[1]}`;
            } else if (roadNames.length === 1) {
              summaryRoads = `Via ${roadNames[0]}`;
            } else {
              summaryRoads = `Menuju ${hospital.name}`;
            }

            const firstStepDist = steps.length > 0 ? Math.round(steps[0].distance) : 200;
            const nextStepObj = steps.length > 1 ? steps[1] : steps[0];
            const subStepObj = steps.length > 2 ? steps[2] : null;

            const firstManeuver = parseManeuver(nextStepObj, hospital.name);
            firstManeuver.distanceMeters = firstStepDist > 0 ? firstStepDist : firstManeuver.distanceMeters;

            const nextManeuver = parseManeuver(subStepObj, hospital.name);
            nextManeuver.roadText = nextManeuver.roadText.replace(/^ke\s+/i, '');

            setRouteData({
              distanceMeters: route.distance,
              durationSeconds: route.duration,
              coordinates: coords,
              summaryRoads,
              firstManeuver,
              nextManeuver,
            });
            setRemainingMeters(route.distance);
            setTraveledMeters(0);
            return; // Route successfully updated with real road path
          }
        } catch (err) {
          // Try next endpoint
        }
      }

      // Offline fallback: Use precomputed authentic road network for this hospital
      if (!isCancelled) {
        const pre = getPrecomputedRoute(hospital.id);
        const steps = pre.steps || [];
        const firstStepDist = steps.length > 0 ? Math.round(steps[0].distance) : 200;
        const nextStepObj = steps.length > 1 ? steps[1] : steps[0];
        const subStepObj = steps.length > 2 ? steps[2] : null;

        const firstManeuver = parseManeuver(nextStepObj, hospital.name);
        firstManeuver.distanceMeters = firstStepDist > 0 ? firstStepDist : firstManeuver.distanceMeters;

        const nextManeuver = parseManeuver(subStepObj, hospital.name);
        nextManeuver.roadText = nextManeuver.roadText.replace(/^ke\s+/i, '');

        setRouteData({
          distanceMeters: pre.distanceMeters,
          durationSeconds: pre.durationSeconds,
          coordinates: pre.coordinates,
          summaryRoads: pre.summaryRoads ? `Via ${pre.summaryRoads}` : `Menuju ${hospital.name}`,
          firstManeuver,
          nextManeuver,
        });
        setRemainingMeters(pre.distanceMeters);
        setTraveledMeters(0);
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [userCoord.lat, userCoord.lon, hospital]);

  // 3. Live GPS tracking watcher when in 'navigation' mode
  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;
    let isCancelled = false;

    if (mode === 'navigation') {
      const startWatcher = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;

          locationSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1500,
              distanceInterval: 4,
            },
            (loc) => {
              if (isCancelled) return;
              const curLat = loc.coords.latitude;
              const curLon = loc.coords.longitude;
              const heading =
                loc.coords.heading && loc.coords.heading > 0
                  ? loc.coords.heading
                  : calculateBearing(
                      currentVehiclePos.lat,
                      currentVehiclePos.lon,
                      curLat,
                      curLon
                    );

              setCurrentVehiclePos({
                lat: curLat,
                lon: curLon,
                heading,
              });

              // Send live position update to MapLibre GL in WebView
              webViewRef.current?.postMessage(
                JSON.stringify({
                  type: 'UPDATE_LOCATION',
                  lat: curLat,
                  lon: curLon,
                  heading,
                })
              );

              // Update dynamic remaining distance and traveled distance
              const rem = haversineDistance(
                curLat,
                curLon,
                hospital.coordinates.lat,
                hospital.coordinates.lon
              );
              setRemainingMeters(rem);
              const traveled = Math.max(0, routeData.distanceMeters - rem);
              setTraveledMeters(traveled);
            }
          );
        } catch (e) {
          console.warn('[Navigation] Watcher error:', e);
        }
      };

      startWatcher();
    }

    return () => {
      isCancelled = true;
      if (locationSub) {
        locationSub.remove();
      }
    };
  }, [mode, hospital.coordinates, routeData.distanceMeters]);

  // Top padding for safe area
  const topPadding =
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 6;

  // Initial vehicle placement in navigation mode aligned with the road direction
  const initialVehicle = useMemo(() => {
    if (routeData.coordinates.length >= 2) {
      const p1 = routeData.coordinates[0];
      const p2 = routeData.coordinates[1];
      const heading = calculateBearing(p1[1], p1[0], p2[1], p2[0]);
      return {
        lon: p1[0],
        lat: p1[1],
        heading,
      };
    }
    return {
      lon: userCoord.lon,
      lat: userCoord.lat,
      heading: 0,
    };
  }, [routeData.coordinates, userCoord]);

  // MapLibre GL 3D GIS HTML Template with road-aligned directional arrows
  const mapHtml = useMemo(() => {
    const startLat = userCoord.lat;
    const startLon = userCoord.lon;
    const destLat = hospital.coordinates.lat;
    const destLon = hospital.coordinates.lon;
    const routeCoords = routeData.coordinates;

    const isNav = mode === 'navigation';
    const vehicleLon = currentVehiclePos.lon || initialVehicle.lon;
    const vehicleLat = currentVehiclePos.lat || initialVehicle.lat;
    const vehicleBearing = currentVehiclePos.heading || initialVehicle.heading;

    // Midpoint along route coordinates for ETA pill
    const midIndex = Math.floor(routeCoords.length / 2);
    const midCoord = routeCoords[midIndex] || [(startLon + destLon) / 2, (startLat + destLat) / 2];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html, #map { width: 100%; height: 100%; overflow: hidden; background: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-attrib { display: none !important; }

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
      animation: pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.7); opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 0; }
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

    /* 3D Navigation Vehicle Arrow */
    .nav-arrow-wrapper {
      width: 52px;
      height: 52px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease-out;
    }
    .nav-arrow-aura {
      position: absolute;
      width: 52px;
      height: 52px;
      background: rgba(30, 108, 239, 0.28);
      border-radius: 50%;
    }
    .nav-arrow-circle {
      width: 38px;
      height: 38px;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(30, 108, 239, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 900;
    }

    /* Hospital Destination Ring Pin */
    .dest-pin-ring {
      width: 24px;
      height: 24px;
      background: #FFFFFF;
      border: 5px solid #1E6CEF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    /* Callout Pill Labels */
    .callout-pill {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 6px 14px;
      font-size: 12.5px;
      font-weight: 700;
      color: #1E6CEF;
      box-shadow: 0 3px 10px rgba(0,0,0,0.18);
      white-space: nowrap;
      display: inline-block;
      border: 1px solid rgba(0,0,0,0.06);
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
    var isNav = ${isNav};
    var startLon = ${startLon};
    var startLat = ${startLat};
    var destLon = ${destLon};
    var destLat = ${destLat};
    var vehicleLon = ${vehicleLon};
    var vehicleLat = ${vehicleLat};
    var vehicleBearing = ${vehicleBearing};
    var routeCoordinates = ${JSON.stringify(routeCoords)};

    // Compute route bounding box for preview mode
    var minLon = Math.min(startLon, destLon);
    var maxLon = Math.max(startLon, destLon);
    var minLat = Math.min(startLat, destLat);
    var maxLat = Math.max(startLat, destLat);

    routeCoordinates.forEach(function(pt) {
      if (pt[0] < minLon) minLon = pt[0];
      if (pt[0] > maxLon) maxLon = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[1] > maxLat) maxLat = pt[1];
    });

    // Initialize MapLibre GL 3D Map with glyphs for directional arrows
    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
      center: isNav ? [vehicleLon, vehicleLat] : [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
      zoom: isNav ? 17.5 : 14.5,
      pitch: isNav ? 60 : 0, // 3D Camera Tilt in Navigation Mode (ala Google Maps)
      bearing: isNav ? vehicleBearing : 0, // Heading in driving direction
      attributionControl: false
    });

    var vehicleMarker = null;

    map.on('load', function() {
      // Fit bounds nicely in preview mode
      if (!isNav) {
        map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
          padding: { top: 60, bottom: 90, left: 45, right: 45 },
          maxZoom: 16.5,
          duration: 0
        });
      }

      var routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      };

      map.addSource('route-source', {
        type: 'geojson',
        data: routeGeoJSON
      });

      // Layer 1: Outer glow polyline along the road
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#93C5FD',
          'line-width': isNav ? 17 : 14,
          'line-opacity': 0.7
        }
      });

      // Layer 2: Main solid blue road route
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1E6CEF',
          'line-width': isNav ? 9 : 7.5,
          'line-opacity': 1
        }
      });

      // Layer 3: Forward directional arrows along the road polyline (ala Google Maps)
      map.addLayer({
        id: 'route-arrows',
        type: 'symbol',
        source: 'route-source',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': isNav ? 60 : 75,
          'text-field': '▶',
          'text-size': isNav ? 13 : 11,
          'text-font': ['Open Sans Regular'],
          'text-keep-upright': false,
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-opacity': 0.95
        }
      });

      if (isNav) {
        // Vehicle Arrow Marker with 3D Navigation Heading
        var navEl = document.createElement('div');
        navEl.className = 'nav-arrow-wrapper';
        navEl.id = 'vehicle-marker';
        navEl.innerHTML = '<div class="nav-arrow-aura"></div><div class="nav-arrow-circle">▲</div>';
        vehicleMarker = new maplibregl.Marker({ element: navEl, rotationAlignment: 'map' })
          .setLngLat([vehicleLon, vehicleLat])
          .addTo(map);
      } else {
        // Origin User Marker
        var originEl = document.createElement('div');
        originEl.className = 'user-pulse-container';
        originEl.innerHTML = '<div class="user-pulse-aura"></div><div class="user-core-dot"></div>';
        new maplibregl.Marker({ element: originEl })
          .setLngLat([startLon, startLat])
          .addTo(map);

        // "Lokasi Anda" Pill Label
        var originPillEl = document.createElement('div');
        originPillEl.className = 'callout-pill callout-origin';
        originPillEl.innerText = 'Lokasi Anda';
        new maplibregl.Marker({ element: originPillEl, offset: [0, 24] })
          .setLngLat([startLon, startLat])
          .addTo(map);

        // ETA Bubble along route
        var etaPillEl = document.createElement('div');
        etaPillEl.className = 'callout-pill callout-time';
        etaPillEl.innerText = ${JSON.stringify(formatDuration(routeData.durationSeconds))};
        new maplibregl.Marker({ element: etaPillEl })
          .setLngLat([${midCoord[0]}, ${midCoord[1]}])
          .addTo(map);
      }

      // Hospital Destination Ring Pin
      var destPinEl = document.createElement('div');
      destPinEl.className = 'dest-pin-ring';
      new maplibregl.Marker({ element: destPinEl })
        .setLngLat([destLon, destLat])
        .addTo(map);

      // Hospital Name Pill Callout
      var destPillEl = document.createElement('div');
      destPillEl.className = 'callout-pill';
      destPillEl.innerText = ${JSON.stringify(hospital.name)};
      new maplibregl.Marker({ element: destPillEl, offset: [0, -22] })
        .setLngLat([destLon, destLat])
        .addTo(map);
    });

    // Handle React Native messages for live navigation, route update, recenter & compass reset
    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_LOCATION') {
          if (vehicleMarker) {
            vehicleMarker.setLngLat([data.lon, data.lat]);
          }
          var bearing = typeof data.heading === 'number' && data.heading !== 0 ? data.heading : map.getBearing();
          map.easeTo({
            center: [data.lon, data.lat],
            bearing: bearing,
            pitch: 60,
            zoom: 17.5,
            duration: 800
          });
        } else if (data.type === 'UPDATE_ROUTE' && data.coordinates && data.coordinates.length > 0) {
          routeCoordinates = data.coordinates;
          if (map.getSource('route-source')) {
            map.getSource('route-source').setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
              }
            });
          }
        } else if (data.type === 'RECENTER') {
          if (isNav) {
            map.easeTo({
              center: [vehicleLon, vehicleLat],
              zoom: 17.5,
              pitch: 60,
              bearing: vehicleBearing,
              duration: 800
            });
          } else {
            map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
              padding: { top: 60, bottom: 90, left: 45, right: 45 },
              duration: 800
            });
          }
        } else if (data.type === 'RESET_NORTH') {
          map.easeTo({ bearing: 0, duration: 600 });
        }
      } catch(e) {}
    }

    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);
  </script>
</body>
</html>
    `;
  }, [userCoord, hospital, mode, routeData, currentVehiclePos, initialVehicle]);

  // Recenter trigger
  const handleRecenter = async () => {
    setIsLocating(true);
    const res = await locationService.getCurrentGpsLocation();
    if (res.success && res.location) {
      setUserCoord({
        lat: res.location.lat,
        lon: res.location.lon,
        name: res.location.name || 'Lokasi GPS Anda',
      });
      setCurrentVehiclePos({
        lat: res.location.lat,
        lon: res.location.lon,
        heading: 0,
      });
    }
    setIsLocating(false);

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'RECENTER' }));
    }
  };

  // Reset compass North
  const handleResetNorth = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'RESET_NORTH' }));
    }
  };

  // Dynamic values
  const formattedTotalDist = formatDistance(routeData.distanceMeters);
  const formattedTotalDuration = formatDuration(routeData.durationSeconds);
  const formattedEta = formatEtaTime(routeData.durationSeconds);

  const formattedRemainingDist = formatDistance(remainingMeters);
  const remainingDurationSec = Math.round((remainingMeters / Math.max(1, routeData.distanceMeters)) * routeData.durationSeconds);
  const formattedRemainingDuration = formatDuration(remainingDurationSec);
  const progressPercent = Math.min(100, Math.max(5, Math.round((traveledMeters / Math.max(1, routeData.distanceMeters)) * 100)));

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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isLocating && (
                    <ActivityIndicator size="small" color="#1E6CEF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.originFieldText} numberOfLines={1}>
                    {userCoord.name}
                  </Text>
                </View>
              </View>

              <View style={[styles.routeFieldBox, { marginTop: 10 }]}>
                <Text style={styles.destFieldText} numberOfLines={1}>
                  {hospital.name}
                </Text>
              </View>
            </View>
          </View>

          {/* MAP AREA (Powered by MapLibre GL 3D with Real Road Directions) */}
          <View style={styles.mapArea}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebView}
              scrollEnabled={true}
              overScrollMode="never"
            />

            {/* Top Right: Compass Button */}
            <Pressable style={styles.compassButton} onPress={handleResetNorth}>
              <Ionicons name="navigate-outline" size={18} color="#1E6CEF" />
              <Text style={styles.compassLetter}>U</Text>
            </Pressable>

            {/* Bottom Right: Recenter / Locate Button */}
            <Pressable style={styles.locateButton} onPress={handleRecenter}>
              {isLocating ? (
                <ActivityIndicator size="small" color="#1E6CEF" />
              ) : (
                <Ionicons name="locate" size={22} color="#1E6CEF" />
              )}
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
                <Text style={styles.durationMainText}>{formattedTotalDuration}</Text>
                <Text style={styles.durationDistanceText}>
                  {' '}• {formattedTotalDist}
                </Text>
              </View>
              <Text style={styles.etaText}>{formattedEta}</Text>
            </View>

            {/* Road Details */}
            <Text style={styles.routeViaText} numberOfLines={1}>
              {routeData.summaryRoads}
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
        /* MODE 2: ACTIVE LIVE NAVIGATION MODE (3D GIS ala Google Maps)  */
        /* ============================================================ */
        <View style={styles.fullscreen}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          {/* TOP TURN-BY-TURN BLUE BANNER */}
          <View style={[styles.navHeaderBanner, { paddingTop: topPadding }]}>
            <View style={styles.maneuverRow}>
              {/* Turn Icon Box */}
              <View style={styles.turnIconBox}>
                <Ionicons
                  name={routeData.firstManeuver.iconName}
                  size={32}
                  color="#FFFFFF"
                />
              </View>

              {/* Turn Instruction Text */}
              <View style={styles.maneuverTextWrapper}>
                <Text style={styles.distanceBig}>
                  {formatDistance(routeData.firstManeuver.distanceMeters)}
                </Text>
                <Text style={styles.turnActionText}>
                  {routeData.firstManeuver.actionText}
                </Text>
                <Text style={styles.roadTargetText} numberOfLines={1}>
                  {routeData.firstManeuver.roadText}
                </Text>
              </View>
            </View>

            {/* Next Road Preview Row */}
            <View style={styles.nextManeuverRow}>
              <Text style={styles.laluLabel}>Lalu</Text>
              <Ionicons
                name={routeData.nextManeuver.iconName}
                size={16}
                color="#FFFFFF"
                style={{ marginHorizontal: 6 }}
              />
              <Text style={styles.nextRoadText} numberOfLines={1}>
                {routeData.nextManeuver.roadText}
              </Text>
            </View>
          </View>

          {/* NAVIGATION MAP AREA (3D MapLibre Navigation View) */}
          <View style={styles.mapArea}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebView}
              scrollEnabled={true}
              overScrollMode="never"
            />

            {/* Top Right: Compass */}
            <Pressable style={styles.compassButtonNav} onPress={handleResetNorth}>
              <Ionicons name="navigate-outline" size={18} color="#1E6CEF" />
              <Text style={styles.compassLetter}>U</Text>
            </Pressable>

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
              <Text style={styles.currentStreetText} numberOfLines={1}>
                Menuju {routeData.firstManeuver.roadText.replace(/^ke\s+/i, '')}
              </Text>
            </View>

            {/* Right Button: Locate Recenter */}
            <Pressable style={styles.navLocateButton} onPress={handleRecenter}>
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
                <Text style={styles.navCardTimeText}>{formattedRemainingDuration}</Text>
                <Text style={styles.navCardSubText}>
                  {formattedRemainingDist} lagi • {formattedEta}
                </Text>
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
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>

            {/* Hospital Destination Details */}
            <View style={styles.navHospitalRow}>
              <View style={styles.navHospitalIconBox}>
                <MaterialCommunityIcons name="hospital-building" size={22} color="#1E6CEF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.navHospitalName} numberOfLines={1}>
                  {hospital.name}
                </Text>
                <Text style={styles.navHospitalAddress} numberOfLines={1}>
                  {hospital.address}
                </Text>
              </View>
            </View>

            <Text style={styles.progressSummaryText}>
              {formatDistance(traveledMeters)} dari {formattedTotalDist} telah ditempuh
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
  /* LIVE NAVIGATION MODE STYLES (3D GIS)       */
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
