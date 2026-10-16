import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
  TextInput,
  RefreshControl,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DOCTORS_DATA, HOSPITALS_DATA, DoctorItem, HospitalItem } from '@/data/medical-partners';
import { hospitalService } from '@/services/hospitalService';
import { locationService } from '@/services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Banner image natural aspect ratio (402 x 268 = 1.5)
const BANNER_HEIGHT = Math.round(SCREEN_WIDTH * (268 / 402));
const CARD_WIDTH = Math.min(312, SCREEN_WIDTH - 60);

export default function CekSekarangScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState<HospitalItem[]>(HOSPITALS_DATA);
  const [refreshing, setRefreshing] = useState(false);

  // Load nearby hospitals from backend/Firestore with GPS location
  const loadNearbyHospitals = useCallback(async () => {
    let lat = -6.9934;
    let lon = 110.4087;

    try {
      const gps = await locationService.getCurrentGpsLocation();
      if (gps.success && gps.location) {
        lat = gps.location.lat;
        lon = gps.location.lon;
      }

      const res = await hospitalService.getNearbyHospitals(lat, lon, 25, 12);
      if (res && res.length > 0) {
        const mapped: HospitalItem[] = res.map((h) => ({
          id: h.id,
          name: h.name,
          distance: h.distance_km ? `${h.distance_km.toFixed(1).replace('.', ',')} km` : '1,5 km',
          distanceKm: h.distance_km || 1.5,
          rating: h.rating,
          address: h.address,
          openHours: h.open_hours || 'Buka 24 Jam',
          description: `Rumah sakit rujukan terakreditasi dengan fasilitas ${h.facilities.join(', ')}.`,
          coordinates: {
            lat: h.latitude,
            lon: h.longitude,
          },
          image: h.image_url ? { uri: h.image_url } : require('@/assets/dr/hospital_kariadi.jpg'),
          facilities: h.facilities.map((f) => ({ icon: 'medical-outline', label: f })),
        }));
        setHospitals(mapped);
      }
    } catch (err) {
      console.warn('[CekSekarang] Error loading hospitals:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNearbyHospitals();
  }, [loadNearbyHospitals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNearbyHospitals();
  }, [loadNearbyHospitals]);

  // Filtered doctors by search query
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return DOCTORS_DATA;
    return DOCTORS_DATA.filter((doctor) => {
      return (
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.hospital.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery]);

  // Filtered hospitals by search query
  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return hospitals;
    return hospitals.filter((h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, hospitals]);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top;

  // Emergency Call Handler
  const handleCallEmergency = () => {
    Linking.openURL('tel:119').catch(() => {
      alert('Panggilan darurat 119 tidak didukung di perangkat ini.');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#1E6CEF']}
          />
        }
      >
        {/* ============================================================ */}
        {/* 1. HERO BANNER: FULL-WIDTH WELCOMING WITH VIBRANT FADE      */}
        {/* ============================================================ */}
        <View style={styles.heroWrapper}>
          <Image
            source={require('@/assets/dr/Welcoming.png')}
            style={styles.heroImage}
            contentFit="cover"
            priority="high"
          />

          {/* Top Status Gradient for contrast on back button */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
            style={[styles.topGradientOverlay, { height: topInset + 54 }]}
            pointerEvents="none"
          />

          {/* Bottom Seamless Gradient Fade into Aura Royal Blue */}
          <LinearGradient
            colors={['transparent', 'rgba(30, 108, 239, 0.4)', 'rgba(30, 108, 239, 0.85)', '#1E6CEF']}
            style={styles.bottomGradientOverlay}
            pointerEvents="none"
          />

          {/* Floating Back Button (Top-Left) */}
          <Pressable
            onPress={() => router.back()}
            style={[styles.floatingBackButton, { top: topInset + 8 }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </Pressable>

          {/* Floating Emergency 119 Pill (Top-Right) */}
          <Pressable
            onPress={handleCallEmergency}
            style={[styles.emergencyFloatingPill, { top: topInset + 8 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.emergencyDot} />
            <Ionicons name="call" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.emergencyFloatingText}>IGD 119</Text>
          </Pressable>
        </View>

        {/* ============================================================ */}
        {/* 2. COMPACT SEARCH BAR                                       */}
        {/* ============================================================ */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBarBox}>
            <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari dokter spesialis atau rumah sakit..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ============================================================ */}
        {/* 3. DOKTER MITRA AURA SECTION                                */}
        {/* ============================================================ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dokter Mitra Aura</Text>
        </View>

        {filteredDoctors.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            snapToInterval={CARD_WIDTH + 14}
            decelerationRate="fast"
          >
            {filteredDoctors.map((doctor: DoctorItem) => (
              <Pressable
                key={doctor.id}
                style={styles.doctorCard}
                onPress={() =>
                  router.push({
                    pathname: '/doctor-reservation',
                    params: { doctorId: doctor.id },
                  })
                }
              >
                {/* Left Side: Soft Blue Arc & Doctor Photo */}
                <View style={styles.doctorImageWrapper}>
                  <View style={styles.doctorBackdropCircle} />
                  <Image
                    source={doctor.image}
                    style={styles.doctorPhoto}
                    contentFit="contain"
                  />
                </View>

                {/* Right Side: Doctor Information */}
                <View style={styles.doctorInfo}>
                  <View>
                    <Text style={styles.doctorName} numberOfLines={1}>
                      {doctor.name}
                    </Text>

                    <View style={styles.doctorDetails}>
                      {/* Specialization */}
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons
                          name="stethoscope"
                          size={14}
                          color="#64748B"
                          style={styles.infoIcon}
                        />
                        <Text style={styles.infoText} numberOfLines={1}>
                          {doctor.specialization}
                        </Text>
                      </View>

                      {/* Hospital */}
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons
                          name="hospital-building"
                          size={14}
                          color="#64748B"
                          style={styles.infoIcon}
                        />
                        <Text style={styles.infoText} numberOfLines={1}>
                          {doctor.hospital}
                        </Text>
                      </View>

                      {/* Satisfaction Rating (Thumbs Up) */}
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons
                          name="thumb-up"
                          size={13}
                          color="#1E6CEF"
                          style={styles.infoIcon}
                        />
                        <Text style={styles.ratingText}>{doctor.ratingPercentage}%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Reservasi Sekarang Button */}
                  <Pressable
                    style={styles.reservasiButton}
                    onPress={() =>
                      router.push({
                        pathname: '/doctor-reservation',
                        params: { doctorId: doctor.id },
                      })
                    }
                  >
                    <Text style={styles.reservasiButtonText}>Reservasi Sekarang</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCardBox}>
            <Ionicons name="search-outline" size={26} color="#FFFFFF" style={{ opacity: 0.8 }} />
            <Text style={styles.emptyCardText}>Tidak ada dokter yang cocok dengan pencarian.</Text>
          </View>
        )}

        {/* ============================================================ */}
        {/* 4. RUMAH SAKIT TERDEKAT SECTION                             */}
        {/* ============================================================ */}
        <View style={[styles.sectionHeader, { marginTop: 26 }]}>
          <Text style={styles.sectionTitle}>Rumah Sakit Terdekat</Text>
        </View>

        {filteredHospitals.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            snapToInterval={CARD_WIDTH + 14}
            decelerationRate="fast"
          >
            {filteredHospitals.map((hospital: HospitalItem) => (
              <Pressable
                key={hospital.id}
                style={styles.hospitalCard}
                onPress={() =>
                  router.push({
                    pathname: '/hospital-detail',
                    params: { hospitalId: hospital.id },
                  })
                }
              >
                {/* Hospital Photo */}
                <Image
                  source={hospital.image}
                  style={styles.hospitalPhoto}
                  contentFit="cover"
                  transition={250}
                />

                {/* Hospital Information */}
                <View style={styles.hospitalInfo}>
                  <Text style={styles.hospitalName} numberOfLines={1}>
                    {hospital.name}
                  </Text>

                  <Text style={styles.hospitalDistance} numberOfLines={1}>
                    {hospital.distance}
                  </Text>

                  {/* Stars Rating Row */}
                  <View style={styles.ratingRow}>
                    <Text style={styles.hospitalRatingNum}>
                      {hospital.rating.toFixed(1).replace('.', ',')}
                    </Text>
                    <View style={styles.starsWrapper}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name="star"
                          size={12}
                          color="#FBBF24"
                        />
                      ))}
                    </View>
                  </View>

                  {/* Address */}
                  <Text style={styles.hospitalAddress} numberOfLines={1}>
                    {hospital.address}
                  </Text>

                  {/* Status & Petunjuk Arah Trigger */}
                  <View style={styles.hospitalBottomRow}>
                    <Text style={styles.hospitalOpenHours}>{hospital.openHours}</Text>
                    <Pressable
                      style={styles.quickRouteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({
                          pathname: '/hospital-route',
                          params: { hospitalId: hospital.id },
                        });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="navigate-circle" size={20} color="#1E6CEF" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCardBox}>
            <Ionicons name="business-outline" size={26} color="#FFFFFF" style={{ opacity: 0.8 }} />
            <Text style={styles.emptyCardText}>Tidak ada rumah sakit yang cocok dengan pencarian.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E6CEF', // Vibrant Aura Royal Blue
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* HERO BANNER STYLES */
  heroWrapper: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  topGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 5,
  },
  emergencyFloatingPill: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.94)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  emergencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  emergencyFloatingText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* COMPACT SEARCH BAR */
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: -8, // Pulls up cleanly against the banner fade
    zIndex: 10,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    paddingVertical: 0,
  },

  /* SECTION HEADERS */
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 14,
  },

  /* DOCTOR CARD STYLES (MATCHES REFERENCE EXACTLY) */
  doctorCard: {
    width: CARD_WIDTH,
    height: 168,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  doctorImageWrapper: {
    width: 122,
    height: 168,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  doctorBackdropCircle: {
    position: 'absolute',
    top: -15,
    left: -20,
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: '#E0EEFF', // Soft ice blue backdrop
  },
  doctorPhoto: {
    width: 122,
    height: 156,
    bottom: 0,
  },
  doctorInfo: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 12,
    paddingLeft: 4,
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  doctorDetails: {
    gap: 3,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoIcon: {
    width: 16,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    flexShrink: 1,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  reservasiButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E6CEF',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  reservasiButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* HOSPITAL CARD STYLES (MATCHES REFERENCE EXACTLY) */
  hospitalCard: {
    width: CARD_WIDTH,
    height: 168,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  hospitalPhoto: {
    width: 110,
    height: 148,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  hospitalInfo: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 2,
    justifyContent: 'center',
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: -0.2,
  },
  hospitalDistance: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  hospitalRatingNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  starsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  hospitalAddress: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    marginTop: 4,
  },
  hospitalBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  hospitalOpenHours: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  quickRouteBtn: {
    padding: 2,
  },

  /* EMPTY STATE */
  emptyCardBox: {
    marginHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyCardText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 6,
    textAlign: 'center',
  },
});
