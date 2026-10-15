import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { DOCTORS_DATA, HOSPITALS_DATA, DoctorItem, HospitalItem } from '@/data/medical-partners';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DATES_PRESET = [
  { dayName: 'Senin', dayNum: '10' },
  { dayName: 'Selasa', dayNum: '11' },
  { dayName: 'Rabu', dayNum: '12' },
  { dayName: 'Kamis', dayNum: '13' },
  { dayName: 'Jumat', dayNum: '14' },
  { dayName: 'Sabtu', dayNum: '15' },
];

const TIME_SLOTS = ['08.00', '09.00', '10.00', '13.00', '14.00', '15.00'];

export default function DoctorReservationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ doctorId?: string }>();

  // Find selected doctor (or fallback to dr-apung)
  const doctor: DoctorItem = useMemo(() => {
    const found = DOCTORS_DATA.find((d) => d.id === params.doctorId);
    return found || DOCTORS_DATA[0];
  }, [params.doctorId]);

  // Find affiliated hospital
  const hospital: HospitalItem = useMemo(() => {
    const found = HOSPITALS_DATA.find((h) => h.id === doctor.hospitalId);
    return found || HOSPITALS_DATA[0];
  }, [doctor.hospitalId]);

  const [selectedDateIdx, setSelectedDateIdx] = useState(3); // Kamis 13 as in reference
  const [selectedTime, setSelectedTime] = useState('13.00'); // 13.00 as in reference
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const topPadding =
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 6;

  // Mini Leaflet Map Preview HTML for hospital location
  const miniMapHtml = useMemo(() => {
    const lat = hospital.coordinates.lat;
    const lon = hospital.coordinates.lon;
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
    body, html, #map { width: 100%; height: 100%; background: #E2E8F0; overflow: hidden; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
    .hospital-pin {
      width: 24px;
      height: 24px;
      background: #0077F6;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-core {
      width: 6px;
      height: 6px;
      background: #FFFFFF;
      border-radius: 50%;
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
    }).setView([${lat}, ${lon}], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var pin = L.divIcon({
      className: '',
      html: '<div class="hospital-pin"><div class="pin-core"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([${lat}, ${lon}], { icon: pin }).addTo(map);
  </script>
</body>
</html>
    `;
  }, [hospital]);

  const handleBooking = () => {
    setShowSuccessModal(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER BAR */}
      <View style={[styles.headerBar, { paddingTop: topPadding }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0077F6" />
        </Pressable>
        <Text style={styles.headerTitle}>Reservasi Dokter</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* DOCTOR PROFILE CARD */}
        <View style={styles.doctorHeaderCard}>
          <View style={styles.doctorCardRow}>
            {/* Doctor Photo */}
            <View style={styles.doctorAvatarWrapper}>
              <Image source={doctor.image} style={styles.doctorAvatar} contentFit="contain" />
            </View>

            {/* Doctor Details */}
            <View style={styles.doctorDetailsCol}>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpec}>{doctor.specialization}</Text>

              <View style={styles.hospitalAffiliateRow}>
                <Ionicons name="business-outline" size={12} color="#64748B" />
                <Text numberOfLines={1} style={styles.hospitalAffiliateText}>
                  {doctor.hospital}
                </Text>
              </View>

              <View style={styles.thumbRatingRow}>
                <Ionicons name="thumbs-up" size={13} color="#0077F6" />
                <Text style={styles.thumbRatingText}>{doctor.ratingPercentage}% Puas</Text>
              </View>
            </View>
          </View>

          {/* 3 STATS PILLARS */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{doctor.experienceYears} Tahun</Text>
              <Text style={styles.statLabel}>Pengalaman</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {doctor.specialization.includes('Paru') ? 'Spesialis' : 'Umum'}
              </Text>
              <Text style={styles.statLabel}>Spesialisasi</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statValue}>{doctor.practiceHours}</Text>
              <Text style={styles.statLabel}>Jam Praktik</Text>
            </View>
          </View>
        </View>

        {/* DATE PICKER (JANUARI 2026) */}
        <View style={styles.sectionWrapper}>
          <View style={styles.monthHeaderRow}>
            <Text style={styles.monthTitle}>Januari 2026</Text>
            <View style={styles.monthArrows}>
              <Pressable style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={16} color="#64748B" />
              </Pressable>
              <Pressable style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* DAY CHIPS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateChipsContent}
          >
            {DATES_PRESET.map((d, index) => {
              const isSelected = selectedDateIdx === index;
              return (
                <Pressable
                  key={d.dayNum}
                  onPress={() => setSelectedDateIdx(index)}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                >
                  <Text style={[styles.dayNameText, isSelected && styles.dayNameTextSelected]}>
                    {d.dayName}
                  </Text>
                  <Text style={[styles.dayNumText, isSelected && styles.dayNumTextSelected]}>
                    {d.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* AVAILABLE TIME SLOTS (JAM TERSEDIA) */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionLabel}>Jam Tersedia</Text>
          <View style={styles.timeGrid}>
            {TIME_SLOTS.map((time) => {
              const isSelected = selectedTime === time;
              return (
                <Pressable
                  key={time}
                  onPress={() => setSelectedTime(time)}
                  style={[styles.timeSlotBtn, isSelected && styles.timeSlotBtnSelected]}
                >
                  <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected]}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* HOSPITAL LOCATION & ROUTE PREVIEW SNIPPET */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionLabel}>Lokasi Praktik &amp; Fasilitas</Text>
          <View style={styles.hospitalMapSnippetCard}>
            {/* Mini Map */}
            <View style={styles.miniMapWrapper}>
              <WebView
                originWhitelist={['*']}
                source={{ html: miniMapHtml }}
                style={StyleSheet.absoluteFill}
                scrollEnabled={false}
                overScrollMode="never"
              />
            </View>

            {/* Bottom info strip */}
            <View style={styles.hospitalSnippetInfo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.snippetHospName}>{hospital.name}</Text>
                <Text style={styles.snippetHospSub}>
                  {hospital.distance} • 6 menit perjalanan
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/hospital-route',
                    params: { hospitalId: hospital.id },
                  })
                }
                style={styles.snippetRouteBtn}
              >
                <Text style={styles.snippetRouteBtnText}>Rute</Text>
                <Ionicons name="navigate" size={13} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FLOATING BOTTOM BUTTON: BUAT JANJI TEMU */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handleBooking}
          style={styles.buatJanjiBtn}
        >
          <Text style={styles.buatJanjiBtnText}>Buat Janji Temu</Text>
        </Pressable>
      </View>

      {/* SUCCESS CONFIRMATION MODAL */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>

            <Text style={styles.modalSuccessTitle}>Janji Temu Berhasil!</Text>
            <Text style={styles.modalSuccessDesc}>
              Reservasi Anda bersama {doctor.name} telah terdaftar dalam sistem klinik.
            </Text>

            <View style={styles.bookingDetailsBox}>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.detailLabel}>Dokter</Text>
                <Text style={styles.detailValue}>{doctor.name}</Text>
              </View>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.detailLabel}>Waktu</Text>
                <Text style={styles.detailValue}>
                  {DATES_PRESET[selectedDateIdx].dayName}, {DATES_PRESET[selectedDateIdx].dayNum} Jan • {selectedTime} WIB
                </Text>
              </View>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.detailLabel}>Lokasi</Text>
                <Text style={styles.detailValue}>{hospital.name}</Text>
              </View>
              <View style={[styles.bookingDetailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>Kode Reservasi</Text>
                <Text style={[styles.detailValue, { color: '#0077F6', fontWeight: '800' }]}>
                  AUR-{Math.floor(100000 + Math.random() * 900000)}
                </Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push({
                    pathname: '/hospital-route',
                    params: { hospitalId: hospital.id },
                  });
                }}
                style={styles.modalRouteBtn}
              >
                <Ionicons name="navigate" size={16} color="#0077F6" />
                <Text style={styles.modalRouteText}>Petunjuk Rute</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace('/dashboard');
                }}
                style={styles.modalDoneBtn}
              >
                <Text style={styles.modalDoneText}>Selesai</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  doctorHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  doctorCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatarWrapper: {
    width: 86,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doctorAvatar: {
    width: 82,
    height: 92,
  },
  doctorDetailsCol: {
    flex: 1,
    marginLeft: 14,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  doctorSpec: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  hospitalAffiliateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  hospitalAffiliateText: {
    fontSize: 11,
    color: '#64748B',
    flexShrink: 1,
  },
  thumbRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  thumbRatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0077F6',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  sectionWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthArrows: {
    flexDirection: 'row',
    gap: 6,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipsContent: {
    gap: 8,
  },
  dateChip: {
    width: 58,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: {
    backgroundColor: '#0077F6',
    shadowColor: '#0077F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  dayNameTextSelected: {
    color: '#FFFFFF',
  },
  dayNumText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  dayNumTextSelected: {
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlotBtn: {
    width: (SCREEN_WIDTH - 64 - 20) / 3,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#0077F6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotBtnSelected: {
    backgroundColor: '#0077F6',
    borderColor: '#0077F6',
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0077F6',
  },
  timeSlotTextSelected: {
    color: '#FFFFFF',
  },
  hospitalMapSnippetCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniMapWrapper: {
    height: 120,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  hospitalSnippetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  snippetHospName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  snippetHospSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  snippetRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0077F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  snippetRouteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  buatJanjiBtn: {
    backgroundColor: '#0077F6',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0077F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buatJanjiBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalSuccessTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSuccessDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bookingDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  modalRouteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  modalRouteText: {
    color: '#0077F6',
    fontSize: 13,
    fontWeight: '800',
  },
  modalDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0077F6',
    paddingVertical: 12,
    borderRadius: 14,
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
