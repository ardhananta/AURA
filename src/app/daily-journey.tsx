/**
 * Daily Journey History Screen
 * View and replay daily journey with animated movement along path.
 * Free mapping: OpenStreetMap / native MapKit without Google Maps API key.
 */

import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OsmCircleItem,
  OsmMapView,
  OsmMapViewHandle,
  OsmMarkerItem,
  OsmPolylineItem,
} from '@/components/map/OsmMapView';
import { useAuth } from '@/context/auth-context';
import { navigationService } from '@/services/navigationService';
import { findNearestSemarangRoad } from '@/services/semarangRoadService';
import { DailyHistoryResponse } from '@/types/tracking';

/**
 * Format local date YYYY-MM-DD (WIB / local timezone, not UTC)
 */
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DailyJourneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const mapViewRef = useRef<OsmMapViewHandle>(null);

  // State
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [history, setHistory] = useState<DailyHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Load history for selected date
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await navigationService.getDailyHistory(user.uid, selectedDate);
        if (isMounted) {
          setHistory(response);
          setCurrentWaypointIndex(0);
          setIsPlaying(false);
        }
      } catch (err) {
        console.warn('[DailyJourney] Failed to load history:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, user?.uid]);

  const waypoints = useMemo(
    () => history?.combined_waypoints || [],
    [history?.combined_waypoints]
  );
  const currentWaypoint = waypoints[currentWaypointIndex];

  // Map bounding box
  const mapBounds = useMemo(() => {
    if (waypoints.length === 0) return null;

    const lats = waypoints.map((w) => w.latitude);
    const lons = waypoints.map((w) => w.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [waypoints]);

  // Replay animation interval
  useEffect(() => {
    if (!isPlaying || waypoints.length === 0) return;

    const stepMs = Math.max(100, Math.round(500 / playbackSpeed));
    const interval = setInterval(() => {
      setCurrentWaypointIndex((prev) => {
        if (prev >= waypoints.length - 1) {
          setIsPlaying(false);
          return waypoints.length - 1;
        }
        return prev + 1;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, waypoints.length]);

  // Animate map camera to current waypoint during playback
  useEffect(() => {
    if (currentWaypoint && isPlaying && mapViewRef.current) {
      mapViewRef.current.flyTo(currentWaypoint.latitude, currentWaypoint.longitude, 15);
    }
  }, [currentWaypoint, isPlaying]);

  const journeyPolylines = useMemo<OsmPolylineItem[]>(() => {
    if (waypoints.length < 2) return [];
    return [
      {
        id: 'journey-path',
        color: '#2563EB',
        width: 4,
        coordinates: waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
        })),
      },
    ];
  }, [waypoints]);

  const journeyCircles = useMemo<OsmCircleItem[]>(() => {
    return waypoints.map((wp, idx) => ({
      id: `wp-${idx}`,
      latitude: wp.latitude,
      longitude: wp.longitude,
      color: wp.classification === 'indoor' ? '#F59E0B' : '#10B981',
      strokeColor: '#FFFFFF',
    }));
  }, [waypoints]);

  const replayMarkers = useMemo<OsmMarkerItem[]>(() => {
    if (!currentWaypoint) return [];
    const date = currentWaypoint.timestamp ? new Date(currentWaypoint.timestamp) : null;
    const badgeText = date
      ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '';
    return [
      {
        id: 'replay-cursor',
        latitude: currentWaypoint.latitude,
        longitude: currentWaypoint.longitude,
        color: '#EF4444',
        badgeText,
        variant: 'replay',
      },
    ];
  }, [currentWaypoint]);

  const topPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 8;

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}j ${mins}m`;
  };

  // Date navigation handlers
  const handlePrevDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalDateString(d));
  };

  const handleNextDay = () => {
    const today = getLocalDateString();
    if (selectedDate >= today) return; // Cannot navigate to future
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalDateString(d));
  };

  const isToday = selectedDate === getLocalDateString();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          paddingTop: topPadding,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </Pressable>

        {/* Date Selector with Prev / Next */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={handlePrevDay}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-back-circle-outline" size={22} color="#64748B" />
          </Pressable>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: '#F8FAFC',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
              {isToday ? 'Hari Ini' : selectedDate}
            </Text>
          </View>

          <Pressable
            onPress={handleNextDay}
            disabled={isToday}
            hitSlop={8}
            style={{ padding: 4, opacity: isToday ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward-circle-outline" size={22} color="#64748B" />
          </Pressable>
        </View>

        {/* Quick button to Start New Tracking */}
        <Pressable
          onPress={() => router.push('/active-tracking')}
          hitSlop={8}
          style={{
            backgroundColor: '#1E6CEF',
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Lacak</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#1E6CEF" />
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 12 }}>Memuat riwayat perjalanan...</Text>
        </View>
      ) : waypoints.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="map-outline" size={56} color="#CBD5E1" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 16, textAlign: 'center' }}>
            Belum Ada Data Perjalanan
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
            Tidak ada riwayat GPS yang tercatat untuk tanggal {selectedDate}. Mulai tracking aktif untuk memantau paparan polusi Anda!
          </Text>
          <Pressable
            onPress={() => router.push('/active-tracking')}
            style={{
              marginTop: 24,
              backgroundColor: '#1E6CEF',
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="radio-button-on" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Mulai Tracking Baru</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Map Section (OpenStreetMap WebView - No Google Maps SDK / Never Black) */}
          {mapBounds && (
            <View style={{ height: 280, width: '100%', backgroundColor: '#E2E8F0' }}>
              <OsmMapView
                ref={mapViewRef}
                style={{ flex: 1 }}
                initialCenter={{
                  latitude: (mapBounds.minLat + mapBounds.maxLat) / 2,
                  longitude: (mapBounds.minLon + mapBounds.maxLon) / 2,
                }}
                initialZoom={14}
                polylines={journeyPolylines}
                circles={journeyCircles}
                markers={replayMarkers}
                onMapReady={() => {
                  if (waypoints.length > 1) {
                    mapViewRef.current?.fitBounds(
                      waypoints.map((w) => ({
                        latitude: w.latitude,
                        longitude: w.longitude,
                      })),
                      45
                    );
                  }
                }}
              />
            </View>
          )}

          {/* Stats Summary Cards */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              marginTop: 14,
              marginBottom: 16,
              gap: 10,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#ECFDF5',
                borderRadius: 14,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#A7F3D0',
              }}
            >
              <Text style={{ fontSize: 11, color: '#059669', marginBottom: 2, fontWeight: '600' }}>Outdoor</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#047857' }}>
                {formatDuration(history?.daily_stats?.total_outdoor_minutes || 0)}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFBEB',
                borderRadius: 14,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}
            >
              <Text style={{ fontSize: 11, color: '#D97706', marginBottom: 2, fontWeight: '600' }}>Indoor</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#B45309' }}>
                {formatDuration(history?.daily_stats?.total_indoor_minutes || 0)}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: '#FEF2F2',
                borderRadius: 14,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
            >
              <Text style={{ fontSize: 11, color: '#DC2626', marginBottom: 2, fontWeight: '600' }}>Max AQI</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#B91C1C' }}>
                {history?.daily_stats?.max_aqi || '-'}
              </Text>
            </View>
          </View>

          {/* Persistent Replay & Playback Controls (NEVER DISAPPEARS WHEN SCRUBBING) */}
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                Replay Perjalanan
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>
                Titik {currentWaypointIndex + 1} / {waypoints.length}
              </Text>
            </View>

            {/* Timeline Slider */}
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={Math.max(0, waypoints.length - 1)}
              step={1}
              value={currentWaypointIndex}
              onValueChange={(val) => {
                setCurrentWaypointIndex(Math.round(val));
              }}
              minimumTrackTintColor="#1E6CEF"
              maximumTrackTintColor="#CBD5E1"
              thumbTintColor="#1E6CEF"
            />

            {/* Play/Pause & Speed Buttons */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <Pressable
                onPress={() => {
                  if (currentWaypointIndex >= waypoints.length - 1) {
                    setCurrentWaypointIndex(0);
                  }
                  setIsPlaying(!isPlaying);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isPlaying ? '#EF4444' : '#1E6CEF',
                  paddingHorizontal: 18,
                  paddingVertical: 9,
                  borderRadius: 20,
                }}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                  {isPlaying ? 'Jeda' : 'Putar'}
                </Text>
              </Pressable>

              {/* Speed Buttons */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[0.5, 1, 2, 4].map((speed) => (
                  <Pressable
                    key={speed}
                    onPress={() => setPlaybackSpeed(speed)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: playbackSpeed === speed ? '#1E6CEF' : '#F1F5F9',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: playbackSpeed === speed ? '#FFFFFF' : '#64748B',
                      }}
                    >
                      {speed}x
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Current Waypoint Details */}
            {currentWaypoint && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: currentWaypoint.classification === 'indoor' ? '#F59E0B' : '#10B981',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Waktu: {formatTime(currentWaypoint.timestamp)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: currentWaypoint.classification === 'indoor' ? '#D97706' : '#059669',
                    }}
                  >
                    {currentWaypoint.classification === 'indoor' ? 'Indoor' : 'Outdoor'}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 4 }}>
                  {currentWaypoint.zone_name ||
                    findNearestSemarangRoad(currentWaypoint.latitude, currentWaypoint.longitude)?.n ||
                    'Area Semarang'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {typeof currentWaypoint.aqi === 'number' && (
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      AQI: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{currentWaypoint.aqi}</Text>
                    </Text>
                  )}
                  {typeof currentWaypoint.pm2_5 === 'number' && (
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      PM2.5: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{currentWaypoint.pm2_5} µg/m³</Text>
                    </Text>
                  )}
                  {typeof currentWaypoint.speed_mps === 'number' && (
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      Kecepatan: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{Math.round(currentWaypoint.speed_mps * 3.6)} km/h</Text>
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}
