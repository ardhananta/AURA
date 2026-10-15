import React from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DOCTORS_DATA, HOSPITALS_DATA, DoctorItem, HospitalItem } from '@/data/medical-partners';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 312;

export default function CekSekarangScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* FLOATING BACK BUTTON */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.floatingBackButton, { top: topInset + 8 }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
      >
        <Ionicons name="arrow-back" size={20} color="#1E293B" />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* 1. TOP HERO WELCOMING BANNER */}
        <View style={styles.heroContainer}>
          <Image
            source={require('@/assets/dr/Welcoming.png')}
            style={styles.heroImage}
            contentFit="cover"
            priority="high"
          />
        </View>

        {/* 2. DOKTER MITRA AURA SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dokter Mitra Aura</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          snapToInterval={CARD_WIDTH + 14}
          decelerationRate="fast"
        >
          {DOCTORS_DATA.map((doctor: DoctorItem) => (
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
                <Text style={styles.doctorName} numberOfLines={1}>
                  {doctor.name}
                </Text>

                <View style={styles.doctorDetails}>
                  {/* Specialization */}
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons
                      name="stethoscope"
                      size={15}
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
                      size={15}
                      color="#64748B"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.infoText} numberOfLines={1}>
                      {doctor.hospital}
                    </Text>
                  </View>

                  {/* Satisfaction Rating */}
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons
                      name="thumb-up"
                      size={14}
                      color="#1E6CEF"
                      style={styles.infoIcon}
                    />
                    <Text style={styles.ratingText}>{doctor.ratingPercentage}%</Text>
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

        {/* 3. RUMAH SAKIT TERDEKAT SECTION */}
        <View style={[styles.sectionHeader, { marginTop: 26 }]}>
          <Text style={styles.sectionTitle}>Rumah Sakit Terdekat</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          snapToInterval={CARD_WIDTH + 14}
          decelerationRate="fast"
        >
          {HOSPITALS_DATA.map((hospital: HospitalItem) => (
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
                        size={13}
                        color="#FBBF24"
                      />
                    ))}
                  </View>
                </View>

                {/* Address */}
                <Text style={styles.hospitalAddress} numberOfLines={1}>
                  {hospital.address}
                </Text>

                {/* Status */}
                <Text style={styles.hospitalOpenHours}>{hospital.openHours}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E6CEF', // Vibrant Aura blue background
  },
  scrollContent: {
    paddingBottom: 40,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  heroContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.72,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 14,
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

  /* DOCTOR CARD STYLES */
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
    width: 125,
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
    width: 145,
    height: 145,
    borderRadius: 72.5,
    backgroundColor: '#E0EEFF', // Soft ice blue backdrop
  },
  doctorPhoto: {
    width: 125,
    height: 160,
    bottom: 0,
  },
  doctorInfo: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingRight: 14,
    paddingLeft: 4,
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 15,
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
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    flexShrink: 1,
  },
  ratingText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  reservasiButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E6CEF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  reservasiButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* HOSPITAL CARD STYLES */
  hospitalCard: {
    width: CARD_WIDTH,
    height: 168,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  hospitalPhoto: {
    width: 112,
    height: 144,
    borderRadius: 14,
  },
  hospitalInfo: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  hospitalName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: -0.2,
  },
  hospitalDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
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
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
    marginTop: 5,
  },
  hospitalOpenHours: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E6CEF',
    marginTop: 3,
  },
});
