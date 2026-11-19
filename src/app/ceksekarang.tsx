import { DoctorItem, DOCTORS_DATA, HospitalItem, HOSPITALS_DATA } from '@/data/medical-partners';
import { hospitalService } from '@/services/hospitalService';
import { locationService } from '@/services/locationService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_CARD_HEIGHT = 152;
const DOCTOR_CARD_WIDTH = Math.min(264, Math.round(SCREEN_WIDTH * 0.71));

const CLOUD_3D_ASSET = require('@/assets/dr/awan.png');
const AMBULANCE_3D_ASSET = require('@/assets/dr/ambulance.png');

export default function CekSekarangScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [hospitals, setHospitals] = useState<HospitalItem[]>(HOSPITALS_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Subtle UI-thread floating animations for the 3D hero assets
  const cloudFloat = useSharedValue(0);
  const ambulanceBob = useSharedValue(0);

  useEffect(() => {
    cloudFloat.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    ambulanceBob.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(cloudFloat);
      cancelAnimation(ambulanceBob);
    };
  }, [cloudFloat, ambulanceBob]);

  const cloudAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cloudFloat.value }],
  }));

  const ambulanceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ambulanceBob.value }, { translateX: ambulanceBob.value * 0.6 }],
  }));

  const fetchNearbyHospitals = useCallback(async () => {
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
        return res.map((h, index): HospitalItem => {
          const baseDist = h.distance_km
            ? `${h.distance_km.toFixed(1).replace('.', ',')} km`
            : '1,5 km';
          return {
            id: h.id,
            name: h.name,
            distance: index === 0 ? `${baseDist} – Terdekat` : baseDist,
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
          };
        });
      }
    } catch (err) {
      console.warn('[CekSekarang] Error loading hospitals:', err);
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    fetchNearbyHospitals().then((mapped) => {
      if (active && mapped) {
        setHospitals(mapped);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchNearbyHospitals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNearbyHospitals()
      .then((mapped) => {
        if (mapped) {
          setHospitals(mapped);
        }
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, [fetchNearbyHospitals]);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DOCTORS_DATA;
    return DOCTORS_DATA.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.hospital.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredHospitals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter(
      (h) => h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q)
    );
  }, [searchQuery, hospitals]);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top;
  const headerBarHeight = 46;
  const heroMarginTop = topInset + headerBarHeight + 14;
  const blueBackdropHeight = heroMarginTop + Math.round(HERO_CARD_HEIGHT * 0.48);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#1E6CEF']}
          />
        }
      >
        {/* ── 1. HEADER BIRU + FLOATING HERO CARD DENGAN ASET 3D AWAN & AMBULANS ── */}
        <View style={styles.headerSection}>
          {/* Latar biru gradien di bagian atas yang membentang hingga tengah kartu */}
          <LinearGradient
            colors={['#1259DB', '#1B6EF3', '#2980FA']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.blueHeaderBackdrop, { height: blueBackdropHeight + 300 }]}
          >
            {/* Aksen atmosfer halus di latar header */}
            <View style={styles.backdropGlowTop} pointerEvents="none" />
          </LinearGradient>

          {/* Top Action Bar */}
          <View style={[styles.topNavBar, { top: topInset + 6 }]}>
            <View style={styles.topNavLeft}>
              <Pressable
                onPress={() => router.back()}
                style={styles.navIconBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Kembali"
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.topNavTitle}>Layanan Medis</Text>
            </View>

            <View style={styles.topNavRight}>
              <Pressable
                onPress={() => {
                  setShowSearch((prev) => {
                    if (prev) setSearchQuery('');
                    return !prev;
                  });
                }}
                style={[styles.navIconBtn, showSearch && styles.navIconBtnActive]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Cari dokter atau rumah sakit"
              >
                <Ionicons name={showSearch ? 'close' : 'search'} size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Kartu Hero Mengambang */}
          <View style={[styles.heroCardOuter, { marginTop: heroMarginTop }]}>
            <View style={styles.heroCardInner}>
              <LinearGradient
                colors={['#4B94F7', '#5CA7FC', '#72BCFF']}
                start={{ x: 0, y: 0.15 }}
                end={{ x: 1, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Lapisan aksen lengkung biru di sisi kanan */}
              <View style={styles.heroAccentCircleLarge} pointerEvents="none" />
              <View style={styles.heroAccentCircleSmall} pointerEvents="none" />

              {/* Sheen halus di tepi atas kartu */}
              <LinearGradient
                colors={['rgba(255,255,255,0.16)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroTopSheen}
                pointerEvents="none"
              />

              <View style={styles.heroTextWrapper}>
                <Text style={styles.heroTitle}>
                  {'Temukan Dokter &\nRumah Sakit Terdekat\nSekarang'}
                </Text>
              </View>
            </View>

            {/* Aset 3D Awan di sudut kanan atas kartu */}
            <Animated.View
              style={[styles.heroCloudWrapper, cloudAnimStyle]}
              pointerEvents="none"
            >
              <Image
                source={CLOUD_3D_ASSET}
                style={styles.heroCloudAsset}
                contentFit="contain"
                priority="high"
              />
            </Animated.View>

            {/* Aset 3D Ambulans di sudut kanan bawah kartu */}
            <Animated.View
              style={[styles.heroAmbulanceWrapper, ambulanceAnimStyle]}
              pointerEvents="none"
            >
              <Image
                source={AMBULANCE_3D_ASSET}
                style={styles.heroAmbulanceAsset}
                contentFit="contain"
                priority="high"
              />
            </Animated.View>
          </View>
        </View>

        {/* Inline Expandable Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#2575EE" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama dokter, spesialis, atau rumah sakit..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── 2. SECTION DOKTER MITRA AURA ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dokter Mitra Aura</Text>
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCountText}>{filteredDoctors.length} Dokter</Text>
          </View>
        </View>

        {filteredDoctors.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.doctorScrollContent}
            snapToInterval={DOCTOR_CARD_WIDTH + 14}
            decelerationRate="fast"
          >
            {filteredDoctors.map((doctor: DoctorItem) => (
              <Pressable
                key={doctor.id}
                onPress={() =>
                  router.push({
                    pathname: '/doctor-reservation',
                    params: { doctorId: doctor.id },
                  })
                }
              >
                <View style={styles.doctorCard}>
                  {/* Foto Dokter di atas latar studio lembut */}
                  <View style={styles.doctorPhotoStage}>
                    <LinearGradient
                      colors={['#F5F8FD', '#E7F0FD']}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* Halo lingkaran lembut di belakang dokter */}
                    <View style={styles.doctorPortraitHalo} pointerEvents="none" />

                    {/* Badge Pengalaman */}
                    <View style={styles.doctorExpPill} pointerEvents="none">
                      <View style={styles.doctorOnlineDot} />
                      <Text style={styles.doctorExpText}>{doctor.experienceYears} Thn</Text>
                    </View>

                    <Image
                      source={doctor.image}
                      style={styles.doctorPhoto}
                      contentFit="contain"
                      contentPosition="bottom"
                    />
                  </View>

                  {/* Strip Biru Rumah Sakit */}
                  <LinearGradient
                    colors={['#1B6BF0', '#277CF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.doctorHospitalBar}
                  >
                    <Text style={styles.doctorHospitalText} numberOfLines={1}>
                      {doctor.hospital}
                    </Text>
                    <MaterialCommunityIcons name="hospital-building" size={18} color="#FFFFFF" />
                  </LinearGradient>

                  {/* Informasi Dokter & Rating */}
                  <View style={styles.doctorInfoFooter}>
                    <View style={styles.doctorInfoTextGroup}>
                      <Text style={styles.doctorName} numberOfLines={1}>
                        {doctor.name}
                      </Text>
                      <Text style={styles.doctorSpec} numberOfLines={1}>
                        {doctor.specialization}
                      </Text>
                    </View>

                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={styles.doctorRatingText}>{doctor.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={24} color="#64748B" />
            <Text style={styles.emptyText}>Tidak ada dokter yang cocok dengan pencarian.</Text>
          </View>
        )}

        {/* ── 3. SECTION RUMAH SAKIT TERDEKAT ── */}
        <View style={[styles.sectionHeader, styles.hospitalSectionHeader]}>
          <Text style={styles.sectionTitle}>Rumah Sakit Terdekat</Text>
          <View style={styles.gpsBadge}>
            <Ionicons name="location" size={12} color="#1E6CEF" />
            <Text style={styles.gpsBadgeText}>{filteredHospitals.length} Lokasi</Text>
          </View>
        </View>

        {filteredHospitals.length > 0 ? (
          <View style={styles.hospitalList}>
            {filteredHospitals.map((hospital: HospitalItem) => (
              <Pressable
                key={hospital.id}
                onPress={() =>
                  router.push({
                    pathname: '/hospital-detail',
                    params: { hospitalId: hospital.id },
                  })
                }
              >
                <View style={styles.hospitalCard}>
                  <View style={styles.hospitalPhotoBox}>
                    <Image
                      source={hospital.image}
                      style={styles.hospitalPhoto}
                      contentFit="cover"
                      transition={250}
                    />
                  </View>

                  <View style={styles.hospitalDetails}>
                    <View>
                      <Text style={styles.hospitalName} numberOfLines={1}>
                        {hospital.name}
                      </Text>
                      <Text style={styles.hospitalAddress} numberOfLines={1}>
                        {hospital.address}
                      </Text>
                      <Text style={styles.hospitalHours} numberOfLines={1}>
                        {hospital.openHours}
                      </Text>
                    </View>

                    <View style={styles.hospitalBottomRow}>
                      <Text style={styles.hospitalDistance} numberOfLines={1}>
                        {hospital.distance}
                      </Text>
                      <View style={styles.hospitalRatingRow}>
                        <Ionicons name="star" size={14} color="#FBBF24" />
                        <Text style={styles.hospitalRatingText}>{hospital.rating.toFixed(1)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="business-outline" size={24} color="#64748B" />
            <Text style={styles.emptyText}>Tidak ada rumah sakit yang cocok dengan pencarian.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ─── Header & Hero Banner ──────────────────────────────────────────────
  headerSection: {
    position: 'relative',
    paddingBottom: 28,
  },
  blueHeaderBackdrop: {
    position: 'absolute',
    top: -300,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  backdropGlowTop: {
    position: 'absolute',
    top: 250,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  topNavBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  topNavTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroCardOuter: {
    marginHorizontal: 20,
    position: 'relative',
    overflow: 'visible',
  },
  heroCardInner: {
    height: HERO_CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    backgroundColor: '#4E97F7',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroAccentCircleLarge: {
    position: 'absolute',
    right: -46,
    top: -36,
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: 'rgba(24, 102, 236, 0.32)',
  },
  heroAccentCircleSmall: {
    position: 'absolute',
    right: 26,
    bottom: -54,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroTopSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
  },
  heroTextWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 114,
  },
  heroTitle: {
    fontSize: 18.5,
    lineHeight: 24.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(15, 23, 42, 0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroCloudWrapper: {
    position: 'absolute',
    top: -26,
    right: -8,
    width: 94,
    height: 72,
    zIndex: 20,
  },
  heroCloudAsset: {
    width: '100%',
    height: '100%',
  },
  heroAmbulanceWrapper: {
    position: 'absolute',
    bottom: -20,
    right: -12,
    width: 130,
    height: 90,
    zIndex: 20,
  },
  heroAmbulanceAsset: {
    width: '100%',
    height: '100%',
  },

  // ─── Expandable Search ─────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    paddingVertical: 0,
  },

  // ─── Section Headers ───────────────────────────────────────────────────
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hospitalSectionHeader: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gpsBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },

  // ─── Doctor Cards ──────────────────────────────────────────────────────
  doctorScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 14,
  },
  doctorCard: {
    width: DOCTOR_CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    overflow: 'hidden',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  doctorPhotoStage: {
    height: 176,
    backgroundColor: '#EEF2F7',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  doctorPortraitHalo: {
    position: 'absolute',
    bottom: -24,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  doctorExpPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37, 117, 238, 0.15)',
  },
  doctorOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  doctorExpText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  doctorPhoto: {
    width: '88%',
    height: '94%',
  },
  doctorHospitalBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorHospitalText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  doctorInfoFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorInfoTextGroup: {
    flex: 1,
    marginRight: 8,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  doctorSpec: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doctorRatingText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#D97706',
  },

  // ─── Hospital List Cards ───────────────────────────────────────────────
  hospitalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  hospitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  hospitalPhotoBox: {
    width: 112,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  hospitalPhoto: {
    width: '100%',
    height: '100%',
  },
  hospitalDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
    height: 84,
    paddingVertical: 2,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E6CEF',
    letterSpacing: -0.2,
  },
  hospitalAddress: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
  },
  hospitalHours: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2575EE',
    marginTop: 2,
  },
  hospitalBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hospitalDistance: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  hospitalRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hospitalRatingText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F59E0B',
  },

  // ─── Empty State ───────────────────────────────────────────────────────
  emptyBox: {
    marginHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
});
