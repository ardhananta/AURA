import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOSPITALS_DATA, HospitalItem } from '@/data/medical-partners';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HospitalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ hospitalId?: string }>();

  // Find target hospital or fallback to first
  const hospital: HospitalItem = useMemo(() => {
    const found = HOSPITALS_DATA.find((h) => h.id === params.hospitalId);
    return found || HOSPITALS_DATA[0];
  }, [params.hospitalId]);

  const topPadding =
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 6;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* SCROLLABLE MAIN CONTENT */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* TOP BLUE HEADER SECTION */}
        <View style={[styles.headerSection, { paddingTop: topPadding }]}>
          <View style={styles.headerBar}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Detail Rumah Sakit</Text>
          </View>

          {/* HOSPITAL HERO PHOTO CARD */}
          <View style={styles.photoCardWrapper}>
            <Image
              source={hospital.image}
              style={styles.hospitalPhoto}
              contentFit="cover"
              priority="high"
            />
          </View>
        </View>

        {/* WHITE BODY CONTENT */}
        <View style={styles.bodySection}>
          {/* HOSPITAL TITLE */}
          <Text style={styles.hospitalName}>{hospital.name}</Text>

          {/* DISTANCE & RATING ROW */}
          <View style={styles.metaRow}>
            <View style={styles.distanceWrapper}>
              <Ionicons name="location-sharp" size={17} color="#1E6CEF" />
              <Text style={styles.distanceText}>{hospital.distance}</Text>
            </View>
            <View style={styles.ratingWrapper}>
              <Ionicons name="star" size={17} color="#FBBF24" />
              <Text style={styles.ratingText}>
                {hospital.rating.toFixed(1).replace('.', ',')}
              </Text>
            </View>
          </View>

          {/* ADDRESS & OPEN HOURS INFO BOX */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="location-sharp" size={18} color="#1E6CEF" style={styles.infoIcon} />
              <Text style={styles.addressText}>{hospital.address}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 10 }]}>
              <Ionicons name="time-outline" size={18} color="#1E6CEF" style={styles.infoIcon} />
              <Text style={styles.openHoursText}>{hospital.openHours}</Text>
            </View>
          </View>

          {/* TENTANG RUMAH SAKIT */}
          <Text style={styles.sectionTitle}>Tentang Rumah Sakit</Text>
          <Text style={styles.aboutText}>
            {hospital.description ||
              'Rumah sakit rujukan di Semarang untuk kebutuhan pemeriksaan, pengobatan, dan perawatan Anda.'}
          </Text>

          {/* LAYANAN & FASILITAS */}
          <View style={styles.facilitySectionHeader}>
            <MaterialCommunityIcons
              name="stethoscope"
              size={18}
              color="#1E6CEF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sectionTitleWithoutMargin}>Layanan &amp; Fasilitas</Text>
          </View>

          {/* 3 FACILITY CARDS ROW */}
          <View style={styles.facilitiesRow}>
            <View style={styles.facilityCard}>
              <Ionicons name="add" size={26} color="#1E6CEF" />
              <Text style={styles.facilityLabel}>IGD 24 Jam</Text>
            </View>
            <View style={styles.facilityCard}>
              <MaterialCommunityIcons name="stethoscope" size={26} color="#1E6CEF" />
              <Text style={styles.facilityLabel}>Rawat Jalan</Text>
            </View>
            <View style={styles.facilityCard}>
              <Ionicons name="bed-outline" size={26} color="#1E6CEF" />
              <Text style={styles.facilityLabel}>Rawat Inap</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* GUARANTEED FIXED BOTTOM BAR: PETUNJUK ARAH */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/hospital-route',
              params: { hospitalId: hospital.id },
            })
          }
          style={styles.petunjukArahBtn}
        >
          <Ionicons name="navigate" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.petunjukArahText}>Petunjuk Arah</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerSection: {
    backgroundColor: '#1E6CEF', // Vibrant Aura blue
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  photoCardWrapper: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  hospitalPhoto: {
    width: '100%',
    height: '100%',
  },
  bodySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
  },
  hospitalName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: -0.4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  distanceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  ratingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoBox: {
    backgroundColor: '#F0F6FE', // Soft light blue card
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
    width: 20,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    flexShrink: 1,
  },
  openHoursText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 22,
    letterSpacing: -0.2,
  },
  aboutText: {
    fontSize: 13.5,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 20,
    marginTop: 6,
  },
  facilitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitleWithoutMargin: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  facilitiesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  facilityCard: {
    flex: 1,
    backgroundColor: '#F0F6FE',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  facilityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexShrink: 0,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  petunjukArahBtn: {
    backgroundColor: '#1E6CEF',
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  petunjukArahText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
