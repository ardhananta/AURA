import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Assets ────────────────────────────────────────────────────────────
const CLOUD_ASSET = require('@/assets/images/Cloud.png');
const LOGO_ASSET  = require('@/assets/images/Logo Aura Putih.png');

// ─── Dimensions & Positioning ──────────────────────────────────────────
// Logo (Centered on screen)
const LOGO_WIDTH  = Math.min(SCREEN_WIDTH * 0.54, 230);
const LOGO_HEIGHT = LOGO_WIDTH / 1.64;

// Upper Cloud (Awan Atas — menutupi area tengah/logo)
const UPPER_CLOUD_WIDTH  = SCREEN_WIDTH * 1.85;
const UPPER_CLOUD_HEIGHT = UPPER_CLOUD_WIDTH * 0.70;
const UPPER_CLOUD_LEFT   = (SCREEN_WIDTH - UPPER_CLOUD_WIDTH) / 2;
const UPPER_CLOUD_BOTTOM = SCREEN_HEIGHT * 0.09;

// Lower Cloud (Awan Bawah — menutupi bagian tengah hingga dasar layar)
const LOWER_CLOUD_WIDTH  = SCREEN_WIDTH * 1.95;
const LOWER_CLOUD_HEIGHT = LOWER_CLOUD_WIDTH * 0.70;
const LOWER_CLOUD_LEFT   = (SCREEN_WIDTH - LOWER_CLOUD_WIDTH) / 2;
const LOWER_CLOUD_BOTTOM = -SCREEN_HEIGHT * 0.05;

// Jarak luncur animasi curtain membelah ke samping & turun
const CURTAIN_TRAVEL_X = SCREEN_WIDTH * 1.35;
const CURTAIN_TRAVEL_Y = SCREEN_HEIGHT * 0.22;

export interface AuraCloudSplashProps {
  onFinish?: () => void;
  autoHideDuration?: number;
  /**
   * 'startup': splash awal saat aplikasi dibuka (otomatis menutup & sembunyikan native SplashScreen).
   * 'loading': splash transisi / loading antar halaman (tetap tampil sampai parent menutupnya).
   */
  mode?: 'startup' | 'loading';
  /** Pesan teks loading di bagian bawah layar */
  message?: string;
  /** Tampilkan spinner aktivitas di sebelah pesan */
  showSpinner?: boolean;
  /** Tombol lewati opsional untuk situasi jaringan lambat */
  onSkip?: () => void;
  skipLabel?: string;
}

export function AuraCloudSplash({
  onFinish,
  autoHideDuration = 3800,
  mode = 'startup',
  message,
  showSpinner = false,
  onSkip,
  skipLabel = 'Lewati & Lanjutkan ➔',
}: AuraCloudSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const isStartup = mode === 'startup';

  // ─── Animated Values ─────────────────────────────────────────────────
  // Efek nafas / swell awan di awal (0 -> -16px)
  const cloudRise = useSharedValue(0);

  // Progress membuka curtain (0 = tertutup rapat, 1 = terbuka penuh)
  const curtainProgress = useSharedValue(0);

  // Logo Aura di tengah
  const logoOpacity = useSharedValue(0);
  const logoScale   = useSharedValue(0.84);

  // Fade-out seluruh splash screen di akhir
  const containerOpacity = useSharedValue(1);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    setIsVisible(false);
    onFinish?.();
  }, [onFinish]);

  const handleSkip = useCallback(() => {
    containerOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(handleComplete)();
      }
    });
  }, [containerOpacity, handleComplete]);

  // ─── Animation Timeline ──────────────────────────────────────────────
  useEffect(() => {
    cloudRise.value = 0;
    curtainProgress.value = 0;
    logoOpacity.value = 0;
    logoScale.value = 0.84;
    containerOpacity.value = 1;

    if (isStartup) {
      // Sembunyikan native splash screen seketika komponen termount
      SplashScreen.hideAsync().catch(() => {});

      // [Fase 1: 0 - 650ms]
      // Awan naik perlahan dari bawah, lalu diam menutup logo & tengah layar
      cloudRise.value = withTiming(-16, {
        duration: 650,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });

      // [Fase 2: 1200ms - 2700ms]
      // Awan diam ~1.2 detik, lalu curtain membuka halus (kiri ke kiri, kanan ke kanan)
      curtainProgress.value = withDelay(
        1200,
        withTiming(1, {
          duration: 1500,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        })
      );

      // [Fase 3: 1600ms - 2600ms]
      // Logo Aura fade-in & scale lembut saat tirai awan mulai terbuka
      logoOpacity.value = withDelay(
        1600,
        withTiming(1, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        })
      );

      logoScale.value = withDelay(
        1600,
        withSpring(1, {
          damping: 14,
          stiffness: 100,
          mass: 0.85,
        })
      );

      // [Fase 4: autoHideDuration - 400ms]
      // Transisi penutup: seluruh splash fade-out ke aplikasi utama
      containerOpacity.value = withDelay(
        autoHideDuration - 400,
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }, (finished) => {
          if (finished) {
            runOnJS(handleComplete)();
          }
        })
      );
    } else {
      // Mode 'loading' (Transisi antar halaman):
      // Curtain membuka lebih cepat agar tetap terasa responsif meski loading singkat
      cloudRise.value = withTiming(-16, {
        duration: 380,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });

      curtainProgress.value = withDelay(
        180,
        withTiming(1, {
          duration: 900,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        })
      );

      logoOpacity.value = withDelay(
        280,
        withTiming(1, {
          duration: 520,
          easing: Easing.out(Easing.cubic),
        })
      );

      logoScale.value = withSequence(
        withDelay(
          280,
          withSpring(1, {
            damping: 14,
            stiffness: 100,
            mass: 0.85,
          })
        ),
        withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    }

    return () => {
      cancelAnimation(cloudRise);
      cancelAnimation(curtainProgress);
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(containerOpacity);
    };
  }, [
    isStartup,
    cloudRise,
    curtainProgress,
    logoOpacity,
    logoScale,
    containerOpacity,
    autoHideDuration,
    handleComplete,
  ]);

  // ─── Animated Styles ─────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // Awan Atas: Meluncur ke KIRI dan sedikit turun saat curtain terbuka
  const upperCloudStyle = useAnimatedStyle(() => {
    const p = curtainProgress.value;
    const translateX = -p * CURTAIN_TRAVEL_X;
    const translateY = cloudRise.value + p * CURTAIN_TRAVEL_Y;
    const opacity = interpolate(p, [0, 0.7, 1], [1, 0.85, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { translateY }],
      opacity,
    };
  });

  // Awan Bawah: Meluncur ke KANAN dan sedikit turun saat curtain terbuka
  const lowerCloudStyle = useAnimatedStyle(() => {
    const p = curtainProgress.value;
    const translateX = p * CURTAIN_TRAVEL_X;
    const translateY = cloudRise.value + p * CURTAIN_TRAVEL_Y;
    const opacity = interpolate(p, [0, 0.7, 1], [1, 0.85, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { translateY }],
      opacity,
    };
  });

  if (isStartup && !isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.root, containerStyle]}
      pointerEvents={isStartup || onSkip ? 'box-none' : 'auto'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2B71EE" translucent />

      {/* Tap di mana saja untuk skip langsung pada splash awal */}
      {isStartup && <Pressable style={StyleSheet.absoluteFill} onPress={handleSkip} />}

      {/* ── 1. LOGO AURA (Tepat di tengah layar, di bawah lapisan awan) ── */}
      <View style={styles.logoCenterWrapper} pointerEvents="none">
        <Animated.View style={logoStyle}>
          <Image
            source={LOGO_ASSET}
            style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
            contentFit="contain"
            priority="high"
          />
        </Animated.View>
      </View>

      {/* ── 2. LAPISAN 2 AWAN (Saling timpa atas-bawah, menutup tengah ke bawah) ── */}
      <View style={styles.cloudStage} pointerEvents="none">

        {/* Awan Atas: Posisi tengah agak atas, meluncur ke kiri (Curtain Kiri) */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              width: UPPER_CLOUD_WIDTH,
              height: UPPER_CLOUD_HEIGHT,
              left: UPPER_CLOUD_LEFT,
              bottom: UPPER_CLOUD_BOTTOM,
            },
            upperCloudStyle,
          ]}
        >
          <Image
            source={CLOUD_ASSET}
            style={styles.cloudImage}
            contentFit="contain"
          />
        </Animated.View>

        {/* Awan Bawah: Posisi tengah di depan awan atas, meluncur ke kanan (Curtain Kanan) */}
        <Animated.View
          style={[
            styles.cloudWrapper,
            {
              width: LOWER_CLOUD_WIDTH,
              height: LOWER_CLOUD_HEIGHT,
              left: LOWER_CLOUD_LEFT,
              bottom: LOWER_CLOUD_BOTTOM,
            },
            lowerCloudStyle,
          ]}
        >
          <Image
            source={CLOUD_ASSET}
            style={[styles.cloudImage, styles.flipHorizontal]}
            contentFit="contain"
          />
        </Animated.View>

      </View>

      {/* ── 3. PESAN LOADING & TOMBOL LEWATI OPSIONAL ── */}
      {(message || showSpinner || onSkip) && (
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          {(message || showSpinner) && (
            <View style={styles.messageBubble} pointerEvents="none">
              {showSpinner && (
                <ActivityIndicator size="small" color="#2B71EE" style={styles.spinner} />
              )}
              {message ? <Text style={styles.messageText}>{message}</Text> : null}
            </View>
          )}
          {onSkip && (
            <Pressable
              onPress={onSkip}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipButtonPressed,
              ]}
            >
              <Text style={styles.skipButtonText}>{skipLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

export interface PageTransitionSplashProps {
  visible: boolean;
  message?: string;
  minDisplayMs?: number;
  onDismiss?: () => void;
  showSpinner?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}

/**
 * PageTransitionSplash
 * Modal loading transisi layar penuh menggunakan animasi AuraCloudSplash.
 * Dilengkapi minDisplayMs untuk mencegah flicker jika API merespon terlalu cepat.
 */
export const PageTransitionSplash: React.FC<PageTransitionSplashProps> = ({
  visible,
  message = 'Memuat Data...',
  minDisplayMs = 500,
  onDismiss,
  showSpinner = true,
  onSkip,
  skipLabel,
}) => {
  const [holdingMinDisplay, setHoldingMinDisplay] = useState(visible);
  const showTimeRef = useRef<number>(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (visible) {
      showTimeRef.current = Date.now();
      timeoutId = setTimeout(() => {
        setHoldingMinDisplay(true);
      }, 0);
    } else if (showTimeRef.current > 0) {
      const elapsed = Date.now() - showTimeRef.current;
      const remaining = Math.max(0, minDisplayMs - elapsed);
      timeoutId = setTimeout(() => {
        setHoldingMinDisplay(false);
      }, remaining);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [visible, minDisplayMs]);

  const modalVisible = visible || holdingMinDisplay;
  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <AuraCloudSplash
          mode="loading"
          message={message}
          showSpinner={showSpinner}
          onSkip={onSkip}
          skipLabel={skipLabel}
        />
      </View>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2B71EE',
    zIndex: 99999,
  },
  logoCenterWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cloudStage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  cloudWrapper: {
    position: 'absolute',
  },
  cloudImage: {
    width: '100%',
    height: '100%',
  },
  flipHorizontal: {
    transform: [{ scaleX: -1 }],
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 42,
    left: 20,
    right: 20,
    zIndex: 30,
    alignItems: 'center',
    gap: 12,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  spinner: {
    marginRight: 8,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  skipButtonPressed: {
    opacity: 0.8,
  },
  skipButtonText: {
    color: '#2B71EE',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

export default AuraCloudSplash;
