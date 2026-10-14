import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';

/**
 * Wraps each auth page in an elegant entrance animation.
 * Smooth overall page fade-in with a gentle curve.
 */
export const AuthTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // CSS ease equivalent
    });
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity, flex: 1 };
  });

  return <Animated.View style={containerStyle}>{children}</Animated.View>;
};

/**
 * Animates the header section with a smooth "descend and settle" effect.
 * Gentle translateY with very soft spring — no abrupt bounce.
 */
export const AnimatedAuthHeader: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const translateY = useSharedValue(-30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Smooth fade in
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    // Gentle slide down with very soft spring (no bounce)
    translateY.value = withSpring(0, {
      damping: 28,       // high damping = no overshoot
      stiffness: 80,     // lower stiffness = gentler movement
      mass: 1,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

/**
 * Animates the form body with a staggered "rise + fade in" effect.
 * Uses timing with bezier curve for butter-smooth motion.
 */
export const AnimatedAuthBody: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 200,
}) => {
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Smooth opacity fade
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );
    // Gentle slide up with soft spring (no bounce)
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 26,
        stiffness: 70,
        mass: 1,
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};
