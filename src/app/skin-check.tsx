import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { aiService } from '@/services/aiService';
import { ScanSkinContext } from '@/types/ai';
import { useAuth } from '@/context/auth-context';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import { SavedSkinScan, skinHistoryService } from '@/services/skinHistoryService';
import {
  AGENTIC_PIPELINE_STEPS,
  AgenticPipelinePanel,
  FaceScanMaskOverlay,
  SkinDifferenceTriplet,
  buildAgenticSummary,
} from '@/components/skin/SkinAnalysisVisuals';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DetectionState = 'idle' | 'analyzing' | 'diff_ready' | 'error';

export default function SkinCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const scanSessionRef = useRef(0);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('front');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const [state, setState] = useState<DetectionState>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [savedScan, setSavedScan] = useState<SavedSkinScan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Advance visual Agentic AI pipeline steps cleanly while analysis runs
  useEffect(() => {
    if (state !== 'analyzing') return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < AGENTIC_PIPELINE_STEPS.length; i++) {
      const t = setTimeout(() => {
        setPipelineStep((prev) => Math.max(prev, i));
      }, i * 520);
      timers.push(t);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [state]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const runAnalysis = async (uri: string, base64?: string | null) => {
    const sessionId = ++scanSessionRef.current;
    setPhotoUri(uri);
    setSavedScan(null);
    setErrorMessage(null);
    setPipelineStep(0);
    setState('analyzing');

    // Collect real mobility waypoints context without dummy data
    const waypoints = backgroundMobilityTracker.getCollectedWaypoints();
    let totalOutdoor = 0;
    let totalIndoor = 0;
    waypoints.forEach((wp) => {
      if (wp.classification === 'indoor' || wp.is_stay) {
        totalIndoor += wp.duration_minutes;
      } else {
        totalOutdoor += wp.duration_minutes;
      }
    });

    const context: ScanSkinContext = {
      total_outdoor_minutes: totalOutdoor > 0 ? totalOutdoor : undefined,
      total_indoor_minutes: totalIndoor > 0 ? totalIndoor : undefined,
      city: 'Semarang',
      usia: user?.usia,
      tinggi_badan: user?.tinggi_badan,
      berat_badan: user?.berat_badan,
    };

    const minAgenticVisualDurationMs = AGENTIC_PIPELINE_STEPS.length * 520 + 250;
    const startedAt = Date.now();

    try {
      if (!base64 && !uri) {
        throw new Error('Foto kulit wajah tidak ditemukan.');
      }

      const res = await aiService.scanSkin(base64 || uri, context);
      if (sessionId !== scanSessionRef.current) return;

      if (!res || !res.data) {
        throw new Error('Format respon analisis kulit tidak valid.');
      }

      // Ensure user sees all Agentic AI preprocessing & mapping substeps complete
      const elapsed = Date.now() - startedAt;
      if (elapsed < minAgenticVisualDurationMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, minAgenticVisualDurationMs - elapsed)
        );
      }
      if (sessionId !== scanSessionRef.current) return;

      const summary = buildAgenticSummary(res.data);
      const saved = await skinHistoryService.saveScan(res.data, uri, summary);
      if (sessionId !== scanSessionRef.current) return;

      setSavedScan(saved);
      setPipelineStep(AGENTIC_PIPELINE_STEPS.length);
      setState('diff_ready');
    } catch (err: any) {
      if (sessionId !== scanSessionRef.current) return;
      console.error('[SkinScan] Scan API error:', err);
      setErrorMessage(
        err?.message ||
          'Tidak dapat terhubung ke server AI kulit Groq/SCIN. Pastikan koneksi internet stabil.'
      );
      setState('error');
    }
  };

  const handleCapturePhoto = async () => {
    if (state !== 'idle') return;

    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setErrorMessage(
          'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan perangkat.'
        );
        setState('error');
        return;
      }
    }

    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          base64: true,
        });
        if (photo?.uri) {
          runAnalysis(photo.uri, photo.base64);
          return;
        }
      } catch (err: any) {
        console.error('[SkinScan] takePictureAsync failed:', err);
        setErrorMessage(
          'Gagal mengambil foto dari kamera: ' + (err?.message || 'Kamera tidak merespon')
        );
        setState('error');
        return;
      }
    }

    setErrorMessage(
      'Kamera belum siap. Pastikan perangkat memiliki modul kamera yang aktif.'
    );
    setState('error');
  };

  const handleLaunchGallery = async () => {
    if (state !== 'idle') return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        runAnalysis(asset.uri, asset.base64);
      }
    } catch (err: any) {
      console.error('[SkinScan] Gallery error:', err);
      setErrorMessage('Gagal memilih foto dari galeri: ' + (err?.message || 'Error'));
      setState('error');
    }
  };

  const handleRetry = () => {
    scanSessionRef.current += 1;
    setPhotoUri(null);
    setSavedScan(null);
    setPipelineStep(0);
    setErrorMessage(null);
    setState('idle');
  };

  const handleOpenFinalResult = () => {
    if (!savedScan) return;
    router.push({
      pathname: '/skin-result',
      params: { id: savedScan.id },
    });
  };

  return (
    <View style={styles.root}>
      {/* ─── 1. FULLSCREEN LIVE CAMERA OR SCANNED PHOTO ─── */}
      {permission?.granted && state === 'idle' ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
        />
      ) : photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#0F172A', '#1E3A8A', '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Dark Backdrop when in Agentic Pipeline or 3-Image Diff Review */}
      {(state === 'analyzing' || state === 'diff_ready') && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(2, 6, 23, 0.86)' },
          ]}
        />
      )}

      {/* Top & Bottom Vignettes (Idle Camera State) */}
      {state === 'idle' && (
        <>
          <LinearGradient
            colors={['rgba(2, 6, 23, 0.72)', 'transparent']}
            style={styles.topVignette}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(2, 6, 23, 0.85)']}
            style={styles.bottomVignette}
            pointerEvents="none"
          />
        </>
      )}

      {/* ─── 2. TOP NAVIGATION BAR (DEDICATED SKIN AI - NO LUNG CHECK LINK) ─── */}
      <View style={[styles.topNavBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.circleBtn}
          onPress={handleBack}
          hitSlop={12}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>

        <View style={styles.headerBrandPill}>
          <Ionicons name="person-circle-outline" size={16} color="#38BDF8" />
          <Text style={styles.headerBrandText}>AURA Skin AI • Wajah</Text>
        </View>

        <View style={styles.cameraControlsRow}>
          <Pressable
            style={styles.circleBtnSmall}
            onPress={() => router.push('/skin-result')}
            accessibilityLabel="Riwayat Analisis Kulit"
          >
            <Ionicons name="time-outline" size={18} color="white" />
          </Pressable>
          {permission?.granted && state === 'idle' && (
            <>
              <Pressable style={styles.circleBtnSmall} onPress={toggleFlash}>
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={18}
                  color={flash === 'on' ? '#FFB433' : 'white'}
                />
              </Pressable>
              <Pressable style={styles.circleBtnSmall} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse" size={18} color="white" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ─── 3. CAMERA PERMISSION PROMPT ─── */}
      {!permission?.granted && state === 'idle' && (
        <View style={styles.permissionCard}>
          <Ionicons name="camera" size={38} color="#FFFFFF" style={{ marginBottom: 10 }} />
          <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
          <Text style={styles.permissionDesc}>
            AURA membutuhkan akses kamera untuk memindai kontur wajah dan menganalisis
            kondisi kulit Anda secara akurat.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Izinkan Kamera</Text>
          </Pressable>
        </View>
      )}

      {/* ─── 4. ANATOMICAL FACE-SHAPED SCANNER OVERLAY (IDLE) ─── */}
      {state === 'idle' && (
        <View style={styles.faceMaskStage} pointerEvents="none">
          <FaceScanMaskOverlay
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            isAnalyzing={false}
          />
          <View style={styles.guidanceBannerWrap}>
            <View style={styles.liveScannerBadge}>
              <View style={[styles.liveDot, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.liveScannerBadgeText}>
                POSISIKAN WAJAH MENGIKUTI BINGKAI KONTUR
              </Text>
            </View>
            <Text style={styles.guidanceSubText}>
              Cahaya merata • Bebas rambut menutupi dahi & pipi
            </Text>
          </View>
        </View>
      )}

      {/* ─── 5. AGENTIC AI PROCESSING PIPELINE (POST-SCAN) ─── */}
      {state === 'analyzing' && (
        <ScrollView
          style={styles.pipelineScroll}
          contentContainerStyle={[
            styles.pipelineScrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <AgenticPipelinePanel
            photoUri={photoUri}
            activeStepIndex={pipelineStep}
            isCompleted={false}
          />
        </ScrollView>
      )}

      {/* ─── 6. 3 DIFFERENCE IMAGES OUTPUT BEFORE FINAL ANALYSIS PAGE ─── */}
      {state === 'diff_ready' && savedScan && (
        <ScrollView
          style={styles.pipelineScroll}
          contentContainerStyle={[
            styles.diffReadyContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.diffReadyBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.diffReadyBannerTitle}>
                Agentic AI Selesai • 3 Citra Perbedaan Dihasilkan
              </Text>
              <Text style={styles.diffReadyBannerSub}>
                Tinjau 3 citra hasil preprocessing HSV/YCbCr, 468-point mesh T/U-Zone, dan
                peta mikro-region 384+ patch sebelum melihat diagnosis akhir.
              </Text>
            </View>
          </View>

          <View style={styles.diffCardSurface}>
            <SkinDifferenceTriplet
              imageUri={photoUri || undefined}
              data={savedScan.data}
              summary={savedScan.agenticSummary}
            />
          </View>
        </ScrollView>
      )}

      {/* ─── 7. ERROR CARD ─── */}
      {state === 'error' && (
        <View style={styles.centerArea}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={54} color="#EF4444" />
            <Text style={styles.errorTitle}>Analisis Kulit Gagal</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.retryActionBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryActionBtnText}>Ambil Foto Ulang</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── 8. BOTTOM CONTROLS BAR ─── */}
      {state === 'idle' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.idleBottomContainer}>
            <View style={styles.shutterRow}>
              <Pressable
                style={styles.sideControlBtn}
                onPress={handleLaunchGallery}
                hitSlop={8}
                accessibilityLabel="Pilih dari Galeri"
              >
                <Ionicons name="images" size={24} color="#FFFFFF" />
                <Text style={styles.sideControlBtnText}>Galeri</Text>
              </Pressable>

              <Pressable
                style={styles.shutterOuterRing}
                onPress={handleCapturePhoto}
                accessibilityLabel="Ambil Foto Wajah dan Pindai Kulit"
              >
                <View style={styles.shutterInnerButton}>
                  <Ionicons name="scan" size={28} color="#2373F4" />
                </View>
              </Pressable>

              <Pressable
                style={styles.sideControlBtn}
                onPress={toggleCameraFacing}
                hitSlop={8}
                accessibilityLabel="Putar Kamera"
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
                <Text style={styles.sideControlBtnText}>Putar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {state === 'diff_ready' && savedScan && (
        <View style={[styles.diffReadyFooter, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable style={styles.diffRescanBtn} onPress={handleRetry}>
            <Ionicons name="refresh" size={17} color="#E2E8F0" />
            <Text style={styles.diffRescanText}>Ulang</Text>
          </Pressable>
          <Pressable style={styles.diffContinueBtn} onPress={handleOpenFinalResult}>
            <Text style={styles.diffContinueText}>Lihat Hasil Analisis Akhir</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {state === 'error' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.resultBtns}>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#2373F4" />
              <Text style={styles.retryBtnTxt}>Pindai Ulang</Text>
            </Pressable>
            <Pressable style={styles.homeBtn} onPress={handleBack}>
              <Text style={styles.homeBtnTxt}>Kembali</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 10,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 210,
    zIndex: 10,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 25,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerBrandText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cameraControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    position: 'absolute',
    top: '36%',
    left: '8%',
    right: '8%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  permissionDesc: {
    color: '#94A3B8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#2373F4',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  faceMaskStage: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 15,
  },
  guidanceBannerWrap: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  liveScannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveScannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  guidanceSubText: {
    color: 'rgba(226, 232, 240, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  pipelineScroll: {
    flex: 1,
    zIndex: 20,
  },
  pipelineScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  diffReadyContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  diffReadyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.38)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  diffReadyBannerTitle: {
    color: '#ECFDF5',
    fontSize: 13.5,
    fontWeight: '800',
  },
  diffReadyBannerSub: {
    color: '#CBD5E1',
    fontSize: 11.5,
    lineHeight: 16.5,
    marginTop: 2,
  },
  diffCardSurface: {
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    padding: 14,
  },
  diffReadyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    zIndex: 30,
  },
  diffRescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  diffRescanText: {
    color: '#F1F5F9',
    fontSize: 13.5,
    fontWeight: '700',
  },
  diffContinueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#2373F4',
  },
  diffContinueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2373F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginTop: 18,
  },
  retryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  idleBottomContainer: {
    width: '100%',
    alignItems: 'center',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    paddingHorizontal: 10,
  },
  sideControlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlBtnText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
  },
  shutterOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBtns: {
    flexDirection: 'row',
    gap: 14,
    width: '88%',
    maxWidth: 340,
    justifyContent: 'center',
  },
  retryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
  },
  retryBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2373F4',
  },
  homeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
