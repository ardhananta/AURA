/**
 * Universal Navigation Screen
 * Navigate to any destination with turn-by-turn directions, GPS guidance, and health warnings.
 * Free mapping: OpenStreetMap / native MapKit without Google Maps API key.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationService } from '@/services/navigationService';
import { useNavigationStore } from '@/stores/navigationStore';
import { HealthWarning, MapMarker, RouteStep } from '@/types/navigation';

const POPULAR_SEMARANG_POIS = [
  { name: 'RSUP Dr. Kariadi', lat: -7.0015, lon: 110.4128 },
  { name: 'Simpang Lima Semarang', lat: -6.9904, lon: 110.4227 },
  { name: 'Lawang Sewu', lat: -6.9839, lon: 110.4104 },
  { name: 'Stadion Jatidiri', lat: -7.0210, lon: 110.4074 },
  { name: 'Kelenteng Sam Poo Kong', lat: -6.9965, lon: 110.3985 },
  { name: 'Kota Lama Semarang', lat: -6.9682, lon: 110.4281 },
  { name: 'Bandara Ahmad Yani', lat: -6.9749, lon: 110.3789 },
];

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function UniversalNavigationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigationStore = useNavigationStore();
  const mapViewRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodedResults, setGeocodedResults] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: -6.9932,
    longitude: 110.4203,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<HealthWarning | null>(null);
  const [showWarningDetail, setShowWarningDetail] = useState(false);
  const [showAllStepsModal, setShowAllStepsModal] = useState(false);

  // Fetch initial user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (err) {
        console.warn('[UniversalNav] Location permission note:', err);
      }
    })();

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, []);

  // Filter static POIs matching search
  const filteredPois = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_SEMARANG_POIS;
    return POPULAR_SEMARANG_POIS.filter((poi) =>
      poi.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Combined suggestions: local matches + geocoded addresses
  const allSuggestions = useMemo(() => {
    if (geocodedResults.length > 0) {
      return [...geocodedResults, ...filteredPois];
    }
    return filteredPois;
  }, [geocodedResults, filteredPois]);

  // Handle Geocoding Search for user typed queries (Universal)
  const handlePerformSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsGeocoding(true);
    setShowSearchSuggestions(true);
    try {
      // 1. Try search with Semarang context
      const queryWithCity = searchQuery.includes('Semarang')
        ? searchQuery
        : `${searchQuery}, Semarang, Jawa Tengah`;

      let results = await Location.geocodeAsync(queryWithCity);

      // 2. Fallback to direct query if no results
      if (!results || results.length === 0) {
        results = await Location.geocodeAsync(searchQuery);
      }

      if (results && results.length > 0) {
        const mapped = results.slice(0, 5).map((r, i) => ({
          name: `${searchQuery.trim()} #${i + 1}`,
          lat: r.latitude,
          lon: r.longitude,
        }));
        setGeocodedResults(mapped);
      } else {
        setGeocodedResults([]);
      }
    } catch (err) {
      console.warn('[UniversalNav] Geocoding error:', err);
      setGeocodedResults([]);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Turn-by-Turn GPS Watcher during active navigation
  useEffect(() => {
    if (!navigationStore.isNavigating || !navigationStore.activeRoute) {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            const currentPos = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(currentPos);

            // Update user position in store
            navigationStore.updatePosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading || 0,
              accuracy_meters: loc.coords.accuracy || 10,
              timestamp: Date.now(),
            });

            // Check distance to current step's end location
            const steps = navigationStore.activeRoute?.steps;
            const stepIdx = navigationStore.currentStepIndex;
            if (steps && steps[stepIdx]) {
              const currentStep = steps[stepIdx];
              const distToEnd = calculateHaversineDistance(
                loc.coords.latitude,
                loc.coords.longitude,
                currentStep.end_location.latitude,
                currentStep.end_location.longitude
              );

              // Auto-advance to next step when within 30 meters
              if (distToEnd <= 30 && stepIdx < steps.length - 1) {
                navigationStore.updateCurrentStep(stepIdx + 1);
              }
            }
          }
        );
      } catch (err) {
        console.warn('[UniversalNav] Watcher start error:', err);
      }
    })();

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, [navigationStore.isNavigating, navigationStore.activeRoute?.route_id]);

  // Handle route calculation
  const handleCalculateRoute = async (destination: { name: string; lat: number; lon: number }) => {
    setIsLoading(true);
    setShowSearchSuggestions(false);
    setSearchQuery('');
    setGeocodedResults([]);

    try {
      const route = await navigationService.calculateRoute(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: destination.lat, longitude: destination.lon }
      );

      if (!route || !Array.isArray(route.coordinates) || route.coordinates.length < 2) {
        Alert.alert('Rute Tidak Ditemukan', 'Tidak dapat menghitung rute ke tujuan ini.');
        return;
      }

      navigationStore.setRoute(route);
      navigationStore.startNavigation();

      // Fit map camera on route
      if (mapViewRef.current && route.coordinates.length >= 2) {
        const [minLon, minLat] = route.coordinates.reduce(
          ([minL, minLa], [l, la]) => [Math.min(minL, l), Math.min(minLa, la)],
          [route.coordinates[0][0], route.coordinates[0][1]]
        );
        const [maxLon, maxLat] = route.coordinates.reduce(
          ([maxL, maxLa], [l, la]) => [Math.max(maxL, l), Math.max(maxLa, la)],
          [route.coordinates[0][0], route.coordinates[0][1]]
        );

        mapViewRef.current.fitToCoordinates(
          [
            { latitude: minLat, longitude: minLon },
            { latitude: maxLat, longitude: maxLon },
          ],
          { edgePadding: { top: 120, right: 40, bottom: 220, left: 40 }, animated: true }
        );
      }
    } catch (err: any) {
      Alert.alert('Gagal Menghitung Rute', err?.message || 'Periksa koneksi internet Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopNavigation = () => {
    Alert.alert('Akhiri Navigasi', 'Apakah Anda ingin mengakhiri sesi navigasi rute ini?', [
      { text: 'Lanjutkan', style: 'cancel' },
      {
        text: 'Akhiri',
        style: 'destructive',
        onPress: () => {
          navigationStore.clearRoute();
          if (locationWatcherRef.current) {
            locationWatcherRef.current.remove();
            locationWatcherRef.current = null;
          }
        },
      },
    ]);
  };

  const isNavigating = navigationStore.isNavigating && !!navigationStore.activeRoute;
  const currentStep = isNavigating && navigationStore.activeRoute?.steps
    ? navigationStore.activeRoute.steps[navigationStore.currentStepIndex]
    : null;
  const totalSteps = navigationStore.activeRoute?.steps?.length || 0;

  const topPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 8;

  const getManeuverIcon = (maneuver?: RouteStep['maneuver']) => {
    switch (maneuver) {
      case 'turn-left':
        return 'arrow-back';
      case 'turn-right':
        return 'arrow-forward';
      case 'uturn':
        return 'return-up-back';
      case 'roundabout':
        return 'sync';
      case 'arrive':
        return 'flag';
      default:
        return 'arrow-up';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Map View without Google Maps API key */}
      <MapView
        ref={mapViewRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* OpenStreetMap Tile Layer for free raster map */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          zIndex={-1}
        />

        {/* Route Polyline (Null-safe array check) */}
        {isNavigating &&
          Array.isArray(navigationStore.activeRoute?.coordinates) &&
          navigationStore.activeRoute.coordinates.length > 1 && (
            <Polyline
              coordinates={navigationStore.activeRoute.coordinates.map(([lon, lat]: [number, number]) => ({
                latitude: lat,
                longitude: lon,
              }))}
              strokeColor="#1E6CEF"
              strokeWidth={5}
            />
          )}

        {/* Destination Marker */}
        {isNavigating &&
          Array.isArray(navigationStore.activeRoute?.coordinates) &&
          navigationStore.activeRoute.coordinates.length > 0 && (
            <Marker
              coordinate={{
                latitude: navigationStore.activeRoute.coordinates[navigationStore.activeRoute.coordinates.length - 1][1],
                longitude: navigationStore.activeRoute.coordinates[navigationStore.activeRoute.coordinates.length - 1][0],
              }}
              title="Tujuan Anda"
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="location" size={36} color="#EF4444" />
              </View>
            </Marker>
          )}

        {/* Health / Traffic Markers */}
        {isNavigating &&
          Array.isArray(navigationStore.mapMarkers) &&
          navigationStore.mapMarkers.map((marker: MapMarker) => (
            <Marker
              key={marker.marker_id}
              coordinate={{
                latitude: marker.location.latitude,
                longitude: marker.location.longitude,
              }}
              title={marker.title}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: marker.color || '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  elevation: 4,
                }}
              >
                <Ionicons name={(marker.icon as any) || 'warning'} size={20} color="#FFFFFF" />
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Top Bar: Search Bar / Navigation Header */}
      {!isNavigating ? (
        <View
          style={{
            position: 'absolute',
            top: topPadding,
            left: 16,
            right: 16,
            zIndex: 100,
          }}
        >
          {/* Search Box */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: '#3B82F6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={{ paddingRight: 6 }}
            >
              <Ionicons name="arrow-back" size={22} color="#1E293B" />
            </Pressable>

            <TextInput
              style={{
                flex: 1,
                fontSize: 14,
                color: '#1E293B',
                paddingVertical: 2,
              }}
              placeholder="Cari lokasi tujuan di Semarang..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSearchSuggestions(true);
              }}
              onSubmitEditing={handlePerformSearch}
              returnKeyType="search"
              onFocus={() => setShowSearchSuggestions(true)}
            />

            {isGeocoding ? (
              <ActivityIndicator size="small" color="#1E6CEF" style={{ marginRight: 6 }} />
            ) : searchQuery.trim() ? (
              <Pressable onPress={handlePerformSearch} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                <Ionicons name="search" size={20} color="#1E6CEF" />
              </Pressable>
            ) : null}

            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setGeocodedResults([]);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          {/* Search Suggestions Dropdown */}
          {showSearchSuggestions && allSuggestions.length > 0 && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                maxHeight: 260,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 5,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                overflow: 'hidden',
              }}
            >
              <FlatList
                data={allSuggestions}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleCalculateRoute(item)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Ionicons name="location-outline" size={18} color="#1E6CEF" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '600' }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                      </Text>
                    </View>
                    <Ionicons name="navigate-outline" size={16} color="#94A3B8" />
                  </Pressable>
                )}
                keyExtractor={(item, index) => `${item.name}-${index}`}
              />
            </View>
          )}
        </View>
      ) : (
        /* Active Navigation Header Banner */
        <View
          style={{
            position: 'absolute',
            top: topPadding,
            left: 16,
            right: 16,
            backgroundColor: '#1E6CEF',
            borderRadius: 20,
            padding: 16,
            shadowColor: '#1E6CEF',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
            zIndex: 100,
          }}
        >
          {currentStep ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={getManeuverIcon(currentStep.maneuver) as any} size={26} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={2}>
                    {currentStep.instruction}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    Langkah {navigationStore.currentStepIndex + 1} dari {totalSteps} • {currentStep.distance_meters} m
                  </Text>
                </View>
              </View>

              {/* Step Navigation Controls (Prev / Next & Overview) */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Pressable
                  disabled={navigationStore.currentStepIndex === 0}
                  onPress={() => navigationStore.updateCurrentStep(Math.max(0, navigationStore.currentStepIndex - 1))}
                  style={{ opacity: navigationStore.currentStepIndex === 0 ? 0.3 : 1, padding: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>← Langkah Lalu</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowAllStepsModal(true)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '700' }}>Semua Langkah</Text>
                </Pressable>

                <Pressable
                  disabled={navigationStore.currentStepIndex >= totalSteps - 1}
                  onPress={() => navigationStore.updateCurrentStep(Math.min(totalSteps - 1, navigationStore.currentStepIndex + 1))}
                  style={{ opacity: navigationStore.currentStepIndex >= totalSteps - 1 ? 0.3 : 1, padding: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>Berikutnya →</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Rute siap. Mengikuti posisi GPS...</Text>
          )}
        </View>
      )}

      {/* Bottom Floating Bar during Navigation */}
      {isNavigating && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: 16,
            right: 16,
            zIndex: 90,
          }}
        >
          {/* Health Warnings Carousel if any */}
          {Array.isArray(navigationStore.healthWarnings) && navigationStore.healthWarnings.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {navigationStore.healthWarnings.map((warning) => (
                <Pressable
                  key={warning.warning_id}
                  onPress={() => {
                    setSelectedWarning(warning);
                    setShowWarningDetail(true);
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 12,
                    marginRight: 10,
                    width: 260,
                    borderLeftWidth: 4,
                    borderLeftColor: warning.color || '#EF4444',
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 5,
                    elevation: 3,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{warning.title}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={1}>{warning.message}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Route Summary & Stop Navigation Button */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View>
              <Text style={{ fontSize: 12, color: '#64748B' }}>Total Rute</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {((navigationStore.activeRoute?.distance_meters || 0) / 1000).toFixed(1)} km • {Math.round((navigationStore.activeRoute?.duration_seconds || 0) / 60)} menit
              </Text>
            </View>

            <Pressable
              onPress={handleStopNavigation}
              style={{
                backgroundColor: '#EF4444',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="stop" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Akhiri</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: -40,
            marginTop: -40,
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* All Steps Modal */}
      <Modal visible={showAllStepsModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Langkah Navigasi</Text>
              <Pressable onPress={() => setShowAllStepsModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {navigationStore.activeRoute?.steps?.map((step, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    navigationStore.updateCurrentStep(idx);
                    setShowAllStepsModal(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: idx === navigationStore.currentStepIndex ? '#EFF6FF' : 'transparent',
                    borderRadius: 10,
                    paddingHorizontal: 8,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: idx === navigationStore.currentStepIndex ? '#1E6CEF' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={getManeuverIcon(step.maneuver) as any}
                      size={16}
                      color={idx === navigationStore.currentStepIndex ? '#FFFFFF' : '#475569'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{step.instruction}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>{step.distance_meters} meter</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Warning Detail Modal */}
      <Modal visible={showWarningDetail} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>Detail Peringatan Kesehatan</Text>
              <Pressable onPress={() => setShowWarningDetail(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {selectedWarning && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.title}</Text>
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{selectedWarning.message}</Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                  <View style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>AQI</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.aqi}</Text>
                  </View>
                  <View style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>PM2.5</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.pm2_5} µg/m³</Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
