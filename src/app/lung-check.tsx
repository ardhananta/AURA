import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIC_WIDTH = Math.min(SCREEN_WIDTH * 0.52, 220);
const MIC_HEIGHT = MIC_WIDTH * (465 / 266); // preserve original SVG aspect ratio (266 x 465)

type DetectionState = 'idle' | 'listening' | 'analyzing' | 'result';

// ─── Microphone Icon (from assets/images/mic.svg) ────────────────────
const MicrophoneIcon: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <Svg width={width} height={height} viewBox="0 0 266 465" fill="none">
    <Rect x="109.728" y="376.379" width="44.9491" height="59.4915" fill="#2373F4" />
    <Rect y="196.583" width="17.1864" height="42.305" fill="#578EF5" />
    <Rect x="248.542" y="196.583" width="17.1864" height="42.305" fill="#578EF5" />
    <Rect x="33.0508" y="196.583" width="19.8305" height="25.1186" fill="#578EF5" />
    <Rect x="210.203" y="196.583" width="19.8305" height="25.1186" fill="#578EF5" />
    <Rect x="14.542" y="181.387" width="22.4746" height="37.0169" rx="6" fill="white" />
    <Path
      d="M74.0382 328.137C48.9196 306.985 48.9176 261.374 49.5786 227.002C48.6974 197.917 50.9719 91.5258 51.5594 80.9131C52.2181 69.0145 61.4679 4.06973 134.187 4.896C192.356 5.55694 206.68 49.1883 212.85 70.3408C216.155 92.1544 214.172 156.934 214.173 234.273C214.175 313.771 185.089 334.747 170.547 342.68C130.885 361.188 88.1399 341.357 74.0382 328.137Z"
      fill="white"
    />
    <Path
      d="M210.204 357.879C182.177 386.963 131.543 388.946 109.729 386.302C50.8989 369.116 35.0338 338.709 22.4745 317.557C12.4271 300.635 14.9829 229.641 15.2032 202.54C16.0846 192.184 18.3769 186.411 28.4243 182.709C38.4718 179.008 37.0176 235.37 35.0346 264.014C34.5939 294.201 49.9736 356.821 115.018 365.811C196.323 377.048 213.508 316.896 221.44 304.997C229.372 293.099 227.39 264.014 228.712 222.37C229.77 189.055 232.238 182.489 233.339 183.37C238.187 176.76 248.278 174.116 249.865 216.421C251.451 258.726 248.542 286.048 246.559 295.743C246.339 303.455 238.231 328.794 210.204 357.879Z"
      fill="white"
    />
    <Path
      d="M74.0382 328.137C48.9196 306.985 48.9176 261.374 49.5786 227.002C48.6974 197.917 50.9719 91.5258 51.5594 80.9131C52.2181 69.0145 61.4679 4.06973 134.187 4.896C192.356 5.55694 206.68 49.1883 212.85 70.3408C216.155 92.1544 214.172 156.934 214.173 234.273C214.175 313.771 185.089 334.747 170.547 342.68C130.885 361.188 88.1399 341.357 74.0382 328.137Z"
      stroke="white"
    />
    <Path
      d="M210.204 357.879C182.177 386.963 131.543 388.946 109.729 386.302C50.8989 369.116 35.0338 338.709 22.4745 317.557C12.4271 300.635 14.9829 229.641 15.2032 202.54C16.0846 192.184 18.3769 186.411 28.4243 182.709C38.4718 179.008 37.0176 235.37 35.0346 264.014C34.5939 294.201 49.9736 356.821 115.018 365.811C196.323 377.048 213.508 316.896 221.44 304.997C229.372 293.099 227.39 264.014 228.712 222.37C229.77 189.055 232.238 182.489 233.339 183.37C238.187 176.76 248.278 174.116 249.865 216.421C251.451 258.726 248.542 286.048 246.559 295.743C246.339 303.455 238.231 328.794 210.204 357.879Z"
      stroke="white"
    />
    <Rect x="228.712" y="178.743" width="22.4746" height="67.4237" rx="6" fill="white" />
    <Rect x="43.6289" y="175.43" width="38.3389" height="26.4406" rx="4" fill="#2373F4" />
    <Rect x="183.763" y="175.43" width="38.3389" height="26.4406" rx="4" fill="#2373F4" />
    {/* Crosshatch lines (\ direction) */}
    <Rect x="74.9697" y="173.665" width="180.404" height="6.61016" transform="rotate(-44.5186 74.9697 173.665)" fill="#2373F4" />
    <Rect x="46.999" y="170.057" width="201.632" height="6.61016" transform="rotate(-44.5186 46.999 170.057)" fill="#2373F4" />
    <Rect x="42.292" y="141.015" width="179.067" height="6.61016" transform="rotate(-44.5186 42.292 141.015)" fill="#2373F4" />
    <Rect x="47.5664" y="103.314" width="140.676" height="6.61016" transform="rotate(-44.5186 47.5664 103.314)" fill="#2373F4" />
    <Rect x="46.1094" y="70.2307" width="94.6058" height="6.61016" transform="rotate(-44.5186 46.1094 70.2307)" fill="#2373F4" />
    {/* Crosshatch lines (/ direction) */}
    <Rect x="213.013" y="72.9766" width="92.5999" height="6.61016" transform="rotate(-135.694 213.013 72.9766)" fill="#2373F4" />
    <Rect x="216.246" y="108.456" width="148.5" height="6.61016" transform="rotate(-135.694 216.246 108.456)" fill="#2373F4" />
    <Rect x="216.804" y="142.771" width="183.39" height="6.61016" transform="rotate(-135.694 216.804 142.771)" fill="#2373F4" />
    <Rect x="215.543" y="176.699" width="211.359" height="6.61016" transform="rotate(-135.694 215.543 176.699)" fill="#2373F4" />
    <Rect x="169.272" y="195.208" width="171.853" height="6.61016" transform="rotate(-135.694 169.272 195.208)" fill="#2373F4" />
    <Rect x="125.916" y="185.188" width="111.295" height="6.61016" transform="rotate(-135.694 125.916 185.188)" fill="#2373F4" />
    <Rect x="95.5098" y="191.798" width="71.8925" height="6.61016" transform="rotate(-135.694 95.5098 191.798)" fill="#2373F4" />
    <Rect x="204.967" y="196.53" width="214.179" height="6.61016" transform="rotate(-135.694 204.967 196.53)" fill="#2373F4" />
    <Rect x="99.208" y="183.146" width="161.841" height="6.61016" transform="rotate(-44.5186 99.208 183.146)" fill="#2373F4" />
    <Rect x="133.07" y="182.843" width="113.787" height="6.61016" transform="rotate(-44.5186 133.07 182.843)" fill="#2373F4" />
    <Rect x="159.851" y="191.35" width="78.676" height="6.61016" transform="rotate(-44.5186 159.851 191.35)" fill="#2373F4" />
    {/* Mic body outline (thick) */}
    <Path
      d="M71.8979 330.278C45.795 308.899 45.7929 262.8 46.4798 228.059C45.564 198.663 47.9277 91.132 48.5383 80.4055C49.2228 68.3795 58.835 2.73894 134.404 3.57406C194.852 4.24209 209.737 48.3409 216.149 69.72C219.583 91.7672 217.522 157.241 217.524 235.408C217.526 315.758 187.3 336.959 172.188 344.976C130.973 363.683 86.5522 343.64 71.8979 330.278Z"
      stroke="white"
      strokeWidth="5"
    />
    <Rect x="79.3232" y="175.43" width="105.763" height="26.4406" rx="4" fill="#578EF5" />
    {/* Stand base */}
    <Path
      d="M62.8884 430.986C64.1028 427.948 67.045 425.955 70.317 425.955H193.308C196.285 425.955 199.017 427.609 200.397 430.248L211.407 451.302C214.18 456.602 210.366 462.959 204.385 463.009L61.494 464.195C55.807 464.243 51.8882 458.507 53.999 453.226L62.8884 430.986Z"
      fill="white"
    />
    {/* Lower body details */}
    <Rect x="83.2881" y="220.38" width="99.1524" height="18.5085" rx="8" fill="#F2F2F2" />
    <Rect x="83.2881" y="250.786" width="99.1524" height="31.7288" rx="8" fill="#F2F2F2" />
    <Path
      d="M182.441 273.922C182.441 291.81 154.542 313.583 131.542 313.583C108.543 313.583 83.2881 289.827 83.2881 271.939C83.2881 254.05 108.543 253.43 131.542 253.43C154.542 253.43 182.441 256.033 182.441 273.922Z"
      fill="#F2F2F2"
    />
  </Svg>
);

// ─── Sound Wave Icon (from assets/images/sound.svg) ──────────────────
const SoundWaveIcon: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <Svg width={width} height={height} viewBox="0 0 68 93" fill="none">
    <Path
      d="M42.2084 4.91951C29.4934 13.3483 5.57288 40.5321 11.6108 81.8366"
      stroke="#FFB433"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Path
      d="M47.7085 17.58C38.0901 23.956 19.9951 44.5195 24.5625 75.7647"
      stroke="#FFB433"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Path
      d="M52.2402 31.513C46.1377 35.5583 34.6573 48.6049 37.5551 68.4286"
      stroke="#FFB433"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Path
      d="M56.3027 42.8225C53.4317 45.021 47.9188 51.9426 48.8348 62.0413"
      stroke="#FFB433"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </Svg>
);

// ─── Animated Dual Sound Waves (Left & Right) ────────────────────────
const AnimatedSoundWaves: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      waveAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(waveAnim);
      waveAnim.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(waveAnim);
  }, [isActive]);

  const rightWaveStyle = useAnimatedStyle(() => {
    const scale = interpolate(waveAnim.value, [0, 0.5, 1], [0.75, 1.15, 0.95], Extrapolation.CLAMP);
    const opacity = interpolate(waveAnim.value, [0, 0.2, 0.8, 1], [0, 0.9, 1, 0.2], Extrapolation.CLAMP);
    const translateX = interpolate(waveAnim.value, [0, 1], [0, 8], Extrapolation.CLAMP);
    const translateY = interpolate(waveAnim.value, [0, 1], [0, -6], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { scale },
        { translateX },
        { translateY },
      ],
    };
  });

  const leftWaveStyle = useAnimatedStyle(() => {
    const scale = interpolate(waveAnim.value, [0, 0.5, 1], [0.75, 1.15, 0.95], Extrapolation.CLAMP);
    const opacity = interpolate(waveAnim.value, [0, 0.2, 0.8, 1], [0, 0.9, 1, 0.2], Extrapolation.CLAMP);
    const translateX = interpolate(waveAnim.value, [0, 1], [0, -8], Extrapolation.CLAMP);
    const translateY = interpolate(waveAnim.value, [0, 1], [0, -6], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { scaleX: -1 }, // Mirror wave for left side
        { scale },
        { translateX },
        { translateY },
      ],
    };
  });

  const WAVE_HEIGHT = MIC_HEIGHT * 0.23;
  const WAVE_WIDTH = WAVE_HEIGHT * (68 / 93);

  if (!isActive) return null;

  return (
    <>
      {/* Right Sound Wave */}
      <Animated.View style={[styles.rightWavePos, rightWaveStyle]}>
        <SoundWaveIcon width={WAVE_WIDTH} height={WAVE_HEIGHT} />
      </Animated.View>

      {/* Left Sound Wave (Mirrored) */}
      <Animated.View style={[styles.leftWavePos, leftWaveStyle]}>
        <SoundWaveIcon width={WAVE_WIDTH} height={WAVE_HEIGHT} />
      </Animated.View>
    </>
  );
};

// ─── Individual Pulsing Dot (Clean Hook usage) ───────────────────────
const PulsingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const progress = useSharedValue(0.2);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.2, 1],
          [0.75, 1.2],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

// ─── Pulsing Dots Container ──────────────────────────────────────────
const PulsingDots: React.FC = () => (
  <View style={styles.dotsRow}>
    <PulsingDot delay={0} />
    <PulsingDot delay={180} />
    <PulsingDot delay={360} />
  </View>
);

// ─── Result Card ─────────────────────────────────────────────────────
const ResultCard: React.FC<{
  status: 'healthy' | 'moderate' | 'warning';
  score: number;
  message: string;
}> = ({ status, score, message }) => {
  const slideY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 550 });
    slideY.value = withSpring(0, { damping: 20, stiffness: 80 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const color =
    status === 'healthy'
      ? '#10B981'
      : status === 'moderate'
      ? '#F59E0B'
      : '#EF4444';
  const icon =
    status === 'healthy'
      ? 'checkmark-circle'
      : status === 'moderate'
      ? 'alert-circle'
      : 'warning';
  const label =
    status === 'healthy'
      ? 'Sehat'
      : status === 'moderate'
      ? 'Cukup Baik'
      : 'Perlu Perhatian';

  return (
    <Animated.View style={[styles.resultCard, cardStyle]}>
      <Ionicons name={icon as any} size={58} color={color} />
      <Text style={styles.resultScore}>{score}%</Text>
      <Text style={[styles.resultLabel, { color }]}>{label}</Text>
      <View style={[styles.resultDivider, { backgroundColor: color + '30' }]} />
      <Text style={styles.resultMessage}>{message}</Text>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ─── Main Screen ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════
export default function LungCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<DetectionState>('idle');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultData, setResultData] = useState<{
    status: 'healthy' | 'moderate' | 'warning';
    score: number;
    message: string;
  } | null>(null);

  // Safe navigation back
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  // ── Mic pulse animation ──
  const micScale = useSharedValue(1);

  useEffect(() => {
    if (state === 'listening') {
      micScale.value = withRepeat(
        withSequence(
          withTiming(1.035, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else if (state === 'analyzing') {
      micScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 450 }),
          withTiming(0.95, { duration: 450 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(micScale);
      micScale.value = withSpring(1, { damping: 14 });
    }
  }, [state]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  // ── Button press animation ──
  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // ── Timer in listening state ──
  useEffect(() => {
    if (state === 'listening') {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer((p) => {
          if (p >= 5) return p;
          return p + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // Transition from listening to analyzing after 5s
  useEffect(() => {
    if (state === 'listening' && timer >= 5) {
      setState('analyzing');
    }
  }, [timer, state]);

  // Transition from analyzing to result after 2.5s
  useEffect(() => {
    if (state !== 'analyzing') return;
    const t = setTimeout(() => {
      const score = Math.floor(Math.random() * 25) + 75; // 75 - 99%
      const status: 'healthy' | 'moderate' | 'warning' =
        score >= 85 ? 'healthy' : score >= 75 ? 'moderate' : 'warning';
      const message =
        status === 'healthy'
          ? 'Paru-paru Anda dalam kondisi prima! Pola pernapasan jernih dan kapasitas paru normal.'
          : status === 'moderate'
          ? 'Kondisi paru-paru terdeteksi cukup baik. Kurangi paparan polusi dan perbanyak minum air hangat.'
          : 'Pola batuk menunjukkan adanya sedikit iritasi saluran pernapasan. Istirahat yang cukup dan konsultasi ke dokter bila berlanjut.';
      setResultData({ status, score, message });
      setState('result');
    }, 2500);
    return () => clearTimeout(t);
  }, [state]);

  const handleStart = () => {
    btnScale.value = withSequence(
      withTiming(0.93, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 220 })
    );
    setState('listening');
  };

  const handleStop = () => setState('analyzing');

  const handleRetry = () => {
    setResultData(null);
    setState('idle');
  };

  return (
    <View style={styles.root}>
      {/* Background Gradient matching reference */}
      <LinearGradient
        colors={['#57B9F8', '#40A3F5', '#2B80F4', '#1B65DD']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={handleBack}
        hitSlop={14}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>

      {/* Top Header / Title */}
      <View style={[styles.titleWrap, { paddingTop: insets.top + 50 }]}>
        <Text style={styles.title}>
          {state === 'idle' && 'Deteksi Kesehatan Paru'}
          {state === 'listening' && 'Mendengarkan...'}
          {state === 'analyzing' && 'Menganalisis...'}
          {state === 'result' && 'Hasil Deteksi Paru'}
        </Text>
        {state !== 'result' && (
          <Text style={styles.subtitle}>
            {state === 'idle' && 'Batukkan ke mikrofon untuk analisis kesehatan paru-paru Anda'}
            {state === 'listening' &&
              `Silakan batuk ke arah mikrofon (${timer}/5 detik)`}
            {state === 'analyzing' && 'Memproses frekuensi & data suara batuk...'}
          </Text>
        )}
      </View>

      {/* Center Interactive Microphone Area */}
      {state !== 'result' ? (
        <View style={styles.centerArea}>
          <Animated.View style={micAnimStyle}>
            <View style={styles.micContainer}>
              {/* Animated Sound Waves (Left & Right) active during listening */}
              <AnimatedSoundWaves isActive={state === 'listening'} />

              {/* Microphone SVG */}
              <MicrophoneIcon width={MIC_WIDTH} height={MIC_HEIGHT} />
            </View>
          </Animated.View>

          {state === 'analyzing' && <PulsingDots />}
        </View>
      ) : (
        <View style={styles.centerArea}>
          {resultData && (
            <ResultCard
              status={resultData.status}
              score={resultData.score}
              message={resultData.message}
            />
          )}
        </View>
      )}

      {/* Bottom Button Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 36 }]}>
        {state === 'idle' && (
          <Animated.View style={[styles.startBtnWrap, btnAnimStyle]}>
            <Pressable style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnTxt}>Mulai</Text>
            </Pressable>
          </Animated.View>
        )}

        {state === 'listening' && (
          <Pressable style={styles.stopBtn} onPress={handleStop}>
            <Ionicons name="stop" size={18} color="#EF4444" />
            <Text style={styles.stopBtnTxt}>Selesai Batuk</Text>
          </Pressable>
        )}

        {state === 'result' && (
          <View style={styles.resultBtns}>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#2373F4" />
              <Text style={styles.retryBtnTxt}>Cek Ulang</Text>
            </Pressable>
            <Pressable style={styles.homeBtn} onPress={handleBack}>
              <Text style={styles.homeBtnTxt}>Kembali</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1 },

  backBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 25,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 320,
  },

  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Mic + waves layout */
  micContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightWavePos: {
    position: 'absolute',
    top: MIC_HEIGHT * 0.05,
    right: -MIC_WIDTH * 0.25,
    zIndex: 10,
  },
  leftWavePos: {
    position: 'absolute',
    top: MIC_HEIGHT * 0.05,
    left: -MIC_WIDTH * 0.25,
    zIndex: 10,
  },

  /* Analyzing dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  /* Result card */
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '86%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  resultScore: {
    fontSize: 54,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 10,
    letterSpacing: -1,
  },
  resultLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  resultDivider: {
    width: '55%',
    height: 3,
    borderRadius: 2,
    marginVertical: 16,
  },
  resultMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },

  /* Bottom buttons */
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  startBtnWrap: {
    width: '85%',
    maxWidth: 360,
  },
  startBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 17,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnTxt: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2373F4',
    textAlign: 'center',
  },

  stopBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  stopBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
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
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  retryBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2373F4',
  },
  homeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
