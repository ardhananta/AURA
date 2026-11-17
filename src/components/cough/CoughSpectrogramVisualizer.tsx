import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { CoughPredictionResponse } from '@/types/ai';

const SCREEN_W = Dimensions.get('window').width;

function getRegionAccent(kind: string): string {
  switch (kind) {
    case 'normal':
      return '#10B981';
    case 'wheeze':
      return '#F59E0B';
    case 'crackle':
      return '#EF4444';
    case 'tonal':
      return '#0284C7';
    default:
      return '#1E6CEF';
  }
}

export const CoughSpectrogramVisualizer: React.FC<{
  data: CoughPredictionResponse;
}> = ({ data }) => {
  const viz = data.visualization;
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!viz) {
    return (
      <View style={styles.fallbackCard}>
        <View style={styles.headerBadge}>
          <Ionicons name="pulse" size={13} color="#1E6CEF" />
          <Text style={styles.headerBadgeText}>PROSES AKUSTIK ICBHI</Text>
        </View>
        <Text style={styles.fallbackTitle}>Cara Model ONNX ICBHI Mendeteksi</Text>
        <Text style={styles.fallbackDesc}>
          Audio batuk dikonversi ke WAV 16 kHz, melewati Filter Bandpass Butterworth 100-2000 Hz,
          lalu diekstrak menjadi Mel-Spektrogram 128x128 sebelum diklasifikasi CNN ONNX.
        </Text>
      </View>
    );
  }

  const metrics = viz.acoustic_metrics;
  const primaryRegion = viz.detected_regions?.[0] || null;

  return (
    <View style={styles.container}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerBadge}>
            <Ionicons name="analytics-outline" size={13} color="#1E6CEF" />
            <Text style={styles.headerBadgeText}>PLOT PYTHON WAVEFORM & SPEKTROGRAM</Text>
          </View>
          <Text style={styles.cardTitle}>Visualisasi Sinyal & Prediksi Batuk</Text>
        </View>

        <Pressable
          style={styles.zoomBtn}
          onPress={() => setZoomOpen(true)}
          hitSlop={6}
          accessibilityLabel="Perbesar Spektrogram"
        >
          <Ionicons name="expand-outline" size={16} color="#1E6CEF" />
        </Pressable>
      </View>

      {/* Pure Python-generated Matplotlib/MATLAB-style 2-panel Figure (920x740) */}
      <Pressable
        style={styles.figureFrame}
        onPress={() => setZoomOpen(true)}
      >
        <Image
          source={{ uri: viz.spectrogram_image }}
          style={styles.figureImage}
          contentFit="contain"
        />
        <View style={styles.zoomHintPill}>
          <Ionicons name="search-outline" size={11} color="#1E6CEF" />
          <Text style={styles.zoomHintText}>Ketuk untuk perbesar</Text>
        </View>
      </Pressable>

      {/* Detected Acoustic Region Summary from Spectrogram */}
      {primaryRegion && (
        <View style={styles.regionInsightCard}>
          <View style={styles.regionInsightTop}>
            <View style={styles.regionInsightTitleWrap}>
              <View
                style={[
                  styles.regionDot,
                  { backgroundColor: getRegionAccent(primaryRegion.kind) },
                ]}
              />
              <Text style={styles.regionInsightTitle} numberOfLines={1}>
                {primaryRegion.label}
              </Text>
            </View>
            <Text style={styles.regionMetaBadge}>
              {primaryRegion.time_start_sec}s-{primaryRegion.time_end_sec}s • {primaryRegion.freq_low_hz}-{primaryRegion.freq_high_hz} Hz
            </Text>
          </View>
          <Text style={styles.regionInsightDesc}>{primaryRegion.detail}</Text>
        </View>
      )}

      {/* Quantitative Acoustic Telemetry Chips */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Frekuensi Puncak</Text>
          <Text style={styles.metricValue}>{metrics.peak_frequency_hz} Hz</Text>
          <Text style={styles.metricSub}>Sentroid {metrics.spectral_centroid_hz} Hz</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Energi Bandpass</Text>
          <Text style={styles.metricValue}>
            {metrics.bandpass_retention_pct ?? 80}%
          </Text>
          <Text style={styles.metricSub}>Zona 100-2000 Hz</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Tonal / Transien</Text>
          <Text style={styles.metricValue}>{metrics.tonal_persistency_pct}%</Text>
          <Text style={styles.metricSub}>{metrics.transient_burst_count} letupan cepat</Text>
        </View>
      </View>

      {/* Step-by-step Clinical Explanation */}
      <View style={styles.stepsSection}>
        <View style={styles.stepsHeaderRow}>
          <Ionicons name="git-network-outline" size={16} color="#1E6CEF" />
          <Text style={styles.stepsSectionTitle}>
            Cara AI Membaca Spektrogram & Memprediksi
          </Text>
        </View>

        {viz.explanation_steps.map((st, idx) => (
          <View
            key={st.step}
            style={[
              styles.stepCard,
              idx === viz.explanation_steps.length - 1 && { marginBottom: 0 },
            ]}
          >
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>{st.step}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.stepTopLine}>
                <Text style={styles.stepTitle} numberOfLines={1}>
                  {st.title}
                </Text>
                <View style={styles.stepMetricChip}>
                  <Text style={styles.stepMetricText}>{st.metric}</Text>
                </View>
              </View>
              <Text style={styles.stepDesc}>{st.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Fullscreen Figure Inspection Modal */}
      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { width: Math.min(SCREEN_W - 20, 440) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Plot Sinyal & Spektrogram Batuk</Text>
                <Text style={styles.modalSub}>
                  Hasil plot langsung dari backend Python DSP + ONNX ICBHI
                </Text>
              </View>
              <Pressable
                style={styles.modalClose}
                onPress={() => setZoomOpen(false)}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </Pressable>
            </View>

            <View style={styles.modalFigureWrap}>
              <Image
                source={{ uri: viz.spectrogram_image }}
                style={styles.figureImage}
                contentFit="contain"
              />
            </View>

            {primaryRegion && (
              <View style={[styles.regionInsightCard, { marginTop: 10 }]}>
                <Text style={styles.regionInsightTitle}>{primaryRegion.label}</Text>
                <Text style={[styles.regionInsightDesc, { marginTop: 4 }]}>
                  {primaryRegion.detail}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  fallbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
    marginBottom: 4,
  },
  fallbackDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 5,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Python scientific plot container */
  figureFrame: {
    width: '100%',
    aspectRatio: 920 / 740,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  figureImage: {
    width: '100%',
    height: '100%',
  },
  zoomHintPill: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 246, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  zoomHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E6CEF',
  },

  regionInsightCard: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  regionInsightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  regionInsightTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  regionDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  regionInsightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  regionMetaBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E6CEF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  regionInsightDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17.5,
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E6CEF',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 9.5,
    color: '#475569',
    marginTop: 2,
  },

  stepsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF6FF',
  },
  stepsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  stepsSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E6CEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 3,
  },
  stepTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepMetricChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stepMetricText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  stepDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16.5,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFigureWrap: {
    width: '100%',
    aspectRatio: 920 / 740,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
});
