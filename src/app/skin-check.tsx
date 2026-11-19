import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
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
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { aiService } from '@/services/aiService';
import { ScanSkinContext, SkinCvAnalysis } from '@/types/ai';
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
import {
  LiveFaceStatus,
  LiveFaceTrackerCamera,
  LiveFaceTrackerHandle,
} from '@/components/skin/LiveFaceTrackerCamera';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DetectionState = 'idle' | 'analyzing' | 'diff_ready' | 'error';

export default function SkinCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const liveTrackerRef = useRef<LiveFaceTrackerHandle>(null);
  const scanSessionRef = useRef(0);
  const isCapturingRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('front');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [cameraReady, setCameraReady] = useState(false);
  const [useFallbackCamera, setUseFallbackCamera] = useState(Platform.OS === 'web');
  const [liveFaceStatus, setLiveFaceStatus] = useState<LiveFaceStatus>({
    detected: false,
    centered: false,
    forward: false,
  });

  const [state, setState] = useState<DetectionState>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [liveCvPreview, setLiveCvPreview] = useState<SkinCvAnalysis | null>(null);
  const [savedScan, setSavedScan] = useState<SavedSkinScan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const topPad =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 24) + 6
      : insets.top + 6;

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

  const resolveImageBase64 = async (
    uri: string,
    providedBase64?: string | null
  ): Promise<string> => {
    if (providedBase64 && providedBase64.length > 64) {
      return providedBase64;
    }
    if (uri.startsWith('data:image')) {
      return uri;
    }
    const base64FromFile = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64FromFile) {
      throw new Error('Gagal membaca data gambar wajah.');
    }
    return base64FromFile;
  };

  const runAnalysis = async (uri: string, base64?: string | null) => {
    const sessionId = ++scanSessionRef.current;
    setPhotoUri(uri);
    setLiveCvPreview(null);
    setSavedScan(null);
    setErrorMessage(null);
    setPipelineStep(0);
    setState('analyzing');

    // Collect real mobility waypoints context
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
      if (!uri && !base64) {
        throw new Error('Foto kulit wajah tidak ditemukan.');
      }

      const encodedBase64 = await resolveImageBase64(uri, base64);
      if (sessionId !== scanSessionRef.current) return;

      let cvShown = false;
      let latestCroppedFaceUri: string | undefined;
      // Immediately fit Python CV face geometry & Wood's Lamp onto the captured face photo
      void aiService.previewSkinGeometry(encodedBase64).then((preview) => {
        if (preview && sessionId === scanSessionRef.current) {
          cvShown = true;
          setLiveCvPreview(preview);
          if (preview.cropped_face_image) {
            latestCroppedFaceUri = preview.cropped_face_image;
            setPhotoUri(preview.cropped_face_image);
          }
        }
      });

      const res = await aiService.scanSkin(encodedBase64, context);
      if (sessionId !== scanSessionRef.current) return;

      if (!res || !res.data) {
        throw new Error('Format respon analisis kulit tidak valid.');
      }

      if (res.data.cv_analysis) {
        setLiveCvPreview(res.data.cv_analysis);
        if (!cvShown) {
          setPipelineStep(2);
          await new Promise((resolve) => setTimeout(resolve, 650));
          if (sessionId !== scanSessionRef.current) return;
        }
      }

      const finalFaceUri =
        res.data.cv_analysis?.cropped_face_image || latestCroppedFaceUri || uri;
      if (finalFaceUri && finalFaceUri !== uri) {
        setPhotoUri(finalFaceUri);
      }

      // Let user see both Agentic AI stages finish
      const elapsed = Date.now() - startedAt;
      if (elapsed < minAgenticVisualDurationMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, minAgenticVisualDurationMs - elapsed)
        );
      }
      if (sessionId !== scanSessionRef.current) return;

      const summary = buildAgenticSummary(res.data);
      const saved = await skinHistoryService.saveScan(res.data, finalFaceUri, summary);
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
    if (state !== 'idle' || isCapturingRef.current) return;

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

    if (!useFallbackCamera && liveTrackerRef.current) {
      isCapturingRef.current = true;
      liveTrackerRef.current.capture();
      return;
    }

    if (!cameraRef.current) {
      setErrorMessage(
        'Kamera belum siap. Pastikan perangkat memiliki modul kamera yang aktif.'
      );
      setState('error');
      return;
    }

    isCapturingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.48,
        base64: true,
      });
      if (photo?.uri) {
        void runAnalysis(photo.uri, photo.base64);
        return;
      }
      setErrorMessage('Foto tidak berhasil diambil dari kamera.');
      setState('error');
    } catch (err: any) {
      console.error('[SkinScan] takePictureAsync failed:', err);
      setErrorMessage(
        'Gagal mengambil foto dari kamera: ' + (err?.message || 'Kamera tidak merespon')
      );
      setState('error');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleLaunchGallery = async () => {
    if (state !== 'idle' || isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.52,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        void runAnalysis(asset.uri, asset.base64);
      }
    } catch (err: any) {
      console.error('[SkinScan] Gallery error:', err);
      setErrorMessage('Gagal memilih foto dari galeri: ' + (err?.message || 'Error'));
      setState('error');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleRetry = () => {
    scanSessionRef.current += 1;
    isCapturingRef.current = false;
    setPhotoUri(null);
    setLiveCvPreview(null);
    setSavedScan(null);
    setPipelineStep(0);
    setErrorMessage(null);
    setLiveFaceStatus({ detected: false, centered: false, forward: false });
    setState('idle');
  };

  const handleOpenFinalResult = () => {
    if (!savedScan) return;
    router.push({
      pathname: '/skin-result',
      params: { id: savedScan.id },
    });
  };

  const viewfinderW = Math.min(SCREEN_WIDTH * 0.78, 300);
  const viewfinderH = Math.min(SCREEN_HEIGHT * 0.5, 360);

  const isLightBackdrop = state === 'analyzing' || state === 'diff_ready';

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isLightBackdrop ? 'dark-content' : 'light-content'} />

      {/* ─── 1. FULLSCREEN LIVE FACE-TRACKED CAMERA OR FALLBACK / SCANNED PHOTO ─── */}
      {permission?.granted && state === 'idle' ? (
        useFallbackCamera ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <LiveFaceTrackerCamera
            ref={liveTrackerRef}
            facing={facing}
            flash={flash}
            active={Boolean(permission?.granted && state === 'idle' && !useFallbackCamera)}
            onReadyChange={(ready) => setCameraReady(ready)}
            onFaceStatusChange={setLiveFaceStatus}
            onCaptured={(dataUrl) => {
              isCapturingRef.current = false;
              void runAnalysis(dataUrl, dataUrl);
            }}
            onFallbackRequired={() => {
              isCapturingRef.current = false;
              setCameraReady(false);
              setUseFallbackCamera(true);
            }}
          />
        )
      ) : photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#0F2B6B', '#1E3A8A', '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Clean White-Blue Clinical Backdrop during Pipeline / 3 Horizontal Diff Review */}
      {(state === 'analyzing' || state === 'diff_ready') && (
        <LinearGradient
          colors={['#F8FAFC', '#EFF6FF', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {state === 'error' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(15, 23, 42, 0.85)' },
          ]}
        />
      )}

      {/* ─── 2. TOP NAVIGATION BAR (NO LUNG CHECK LINK) ─── */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          style={[styles.circleBtn, isLightBackdrop && styles.circleBtnLight]}
          onPress={state === 'idle' ? handleBack : handleRetry}
          hitSlop={12}
          accessibilityLabel={state === 'idle' ? 'Kembali' : 'Ulangi Scan'}
        >
          <Ionicons
            name={state === 'idle' ? 'arrow-back' : 'close'}
            size={21}
            color={isLightBackdrop ? '#1E6CEF' : '#FFFFFF'}
          />
        </Pressable>

        {isLightBackdrop ? (
          <View style={styles.lightTopTitlePill}>
            <View style={styles.lightTopBlueDot} />
            <Text style={styles.lightTopTitleText}>
              {state === 'analyzing' ? "Wood's Lamp & CV Pipeline" : 'Analisis Visual Wajah'}
            </Text>
          </View>
        ) : null}

        {/* Quick tools (History / Flash / Flip) - zero Lung Check navigation */}
        <View style={styles.cameraControlsRow}>
          <Pressable
            style={[styles.circleBtnSmall, isLightBackdrop && styles.circleBtnLight]}
            onPress={() => router.push('/skin-result')}
            accessibilityLabel="Riwayat Analisis Kulit"
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={isLightBackdrop ? '#1E6CEF' : '#FFFFFF'}
            />
          </Pressable>
          {permission?.granted && state === 'idle' && (
            <>
              <Pressable style={styles.circleBtnSmall} onPress={toggleFlash}>
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={18}
                  color={flash === 'on' ? '#FBBF24' : '#FFFFFF'}
                />
              </Pressable>
              <Pressable style={styles.circleBtnSmall} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ─── 3. TWO DYNAMIC LIVE FACE ALIGNMENT PILLS ─── */}
      {state === 'idle' && (
        <View style={styles.statusPillsRow}>
          <View style={styles.blueStatusPill}>
            <View
              style={[
                styles.blueCheckCircle,
                {
                  backgroundColor: useFallbackCamera
                    ? '#1E6CEF'
                    : liveFaceStatus.detected && liveFaceStatus.centered
                    ? '#10B981'
                    : '#94A3B8',
                },
              ]}
            >
              <Ionicons
                name={
                  useFallbackCamera || (liveFaceStatus.detected && liveFaceStatus.centered)
                    ? 'checkmark'
                    : 'scan-outline'
                }
                size={11}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.bluePillText}>Posisi wajah</Text>
          </View>

          <View style={styles.blueStatusPill}>
            <View
              style={[
                styles.blueCheckCircle,
                {
                  backgroundColor: useFallbackCamera
                    ? '#1E6CEF'
                    : liveFaceStatus.detected && liveFaceStatus.forward
                    ? '#10B981'
                    : '#94A3B8',
                },
              ]}
            >
              <Ionicons
                name={
                  useFallbackCamera || (liveFaceStatus.detected && liveFaceStatus.forward)
                    ? 'checkmark'
                    : 'eye-outline'
                }
                size={11}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.bluePillText}>Hadap depan</Text>
          </View>
        </View>
      )}

      {/* ─── 4. CAMERA PERMISSION PROMPT ─── */}
      {!permission?.granted && state === 'idle' && (
        <View style={styles.permissionCard}>
          <Ionicons name="camera" size={38} color="#FFFFFF" style={{ marginBottom: 10 }} />
          <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
          <Text style={styles.permissionDesc}>
            AURA membutuhkan akses kamera untuk memindai wajah Anda dengan 3D Facial Mesh
            dan menganalisis kondisi kulit.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Izinkan Kamera</Text>
          </Pressable>
        </View>
      )}

      {/* ─── 5. CORNER BRACKETS + LIVE ALIGNMENT CUE (DYNAMIC MESH DRAWN LIVE BY TRACKER) ─── */}
      {state === 'idle' && (
        <View style={styles.viewfinderStage} pointerEvents="none">
          <FaceScanMaskOverlay
            frameWidth={viewfinderW}
            frameHeight={viewfinderH}
            showCornerBrackets={true}
            showMesh={useFallbackCamera}
            statusLabel={
              permission?.granted && !cameraReady
                ? 'Menyiapkan kamera...'
                : useFallbackCamera
                ? 'Sejajarkan wajah di bingkai'
                : liveFaceStatus.detected && liveFaceStatus.centered && liveFaceStatus.forward
                ? 'Siap! Ketuk tombol'
                : liveFaceStatus.detected
                ? 'Posisikan wajah lurus ke tengah'
                : 'Arahkan wajah ke kamera'
            }
          />
        </View>
      )}

      {/* ─── 6. AGENTIC AI PROCESSING PIPELINE (POST-SCAN) ─── */}
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
            cvPreview={liveCvPreview}
          />
        </ScrollView>
      )}

      {/* ─── 7. 3 DIFFERENCE IMAGES OUTPUT BEFORE FINAL ANALYSIS PAGE ─── */}
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
            <View style={styles.diffReadyCheckWrap}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.diffReadyBannerTitle}>
                Transformasi Wood’s Lamp & Geometri Selesai
              </Text>
              <Text style={styles.diffReadyBannerSub}>
                3 citra perbedaan muncul bertahap: Wood’s Lamp UV 365nm, Geometri Wajah Otomatis,
                dan Peta 384+ Mikro-Patch sebelum hasil klinis akhir.
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

      {/* ─── 8. ERROR CARD ─── */}
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

      {/* ─── 9. BOTTOM SHUTTER CONTROLS (MATCHING PURPLE-RING WHITE BUTTON) ─── */}
      {state === 'idle' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.shutterRow}>
            <Pressable
              style={styles.sideControlBtn}
              onPress={handleLaunchGallery}
              hitSlop={8}
              accessibilityLabel="Pilih dari Galeri"
            >
              <Ionicons name="images-outline" size={22} color="#FFFFFF" />
              <Text style={styles.sideControlBtnText}>Galeri</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.shutterBlueRing,
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
              onPress={handleCapturePhoto}
              accessibilityLabel="Ambil Foto Wajah dan Pindai Kulit"
            >
              <View style={styles.shutterWhiteCore} />
            </Pressable>

            <Pressable
              style={styles.sideControlBtn}
              onPress={toggleCameraFacing}
              hitSlop={8}
              accessibilityLabel="Putar Kamera"
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
              <Text style={styles.sideControlBtnText}>Putar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {state === 'diff_ready' && savedScan && (
        <View style={[styles.diffReadyFooter, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable style={styles.diffRescanBtn} onPress={handleRetry}>
            <Ionicons name="refresh" size={17} color="#1E6CEF" />
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
              <Ionicons name="refresh" size={18} color="#1E6CEF" />
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
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 30,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lightTopTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  lightTopBlueDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1E6CEF',
  },
  lightTopTitleText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  cameraControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    zIndex: 25,
  },
  blueStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    gap: 6,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  blueCheckCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#1E6CEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bluePillText: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '700',
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
    zIndex: 35,
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
    backgroundColor: '#1E6CEF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewfinderStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  pipelineScroll: {
    flex: 1,
    zIndex: 25,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  diffReadyCheckWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E6CEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  diffReadyBannerTitle: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '800',
  },
  diffReadyBannerSub: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 16.5,
    marginTop: 2,
  },
  diffCardSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
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
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    zIndex: 35,
  },
  diffRescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  diffRescanText: {
    color: '#1E6CEF',
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
    backgroundColor: '#1E6CEF',
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
    zIndex: 25,
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
    backgroundColor: '#1E6CEF',
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
    zIndex: 25,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 280,
  },
  sideControlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlBtnText: {
    fontSize: 9.5,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
  },
  shutterBlueRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5.5,
    borderColor: '#1E6CEF',
    backgroundColor: 'rgba(30, 108, 239, 0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 6,
  },
  shutterWhiteCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
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
    color: '#1E6CEF',
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
