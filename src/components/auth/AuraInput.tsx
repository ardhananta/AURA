import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  TextInputProps,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { AuraColors } from '@/constants/aura-theme';

interface AuraInputProps extends TextInputProps {
  labelPlaceholder: string;
  isPassword?: boolean;
  error?: string;
  containerClassName?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Animated Eye Icon ───────────────────────────────────────────────
const AnimatedEyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => {
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 14,
      stiffness: 160,
      mass: 0.8,
    });
  }, [visible]);

  const animatedIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [1, 0.85, 1],
      Extrapolation.CLAMP
    );
    const rotate = interpolate(
      progress.value,
      [0, 1],
      [0, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View style={animatedIconStyle}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        {/* Eye outline */}
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke={AuraColors.primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pupil */}
        <Circle
          cx="12"
          cy="12"
          r="3.5"
          fill={visible ? AuraColors.primary : 'transparent'}
          stroke={AuraColors.primary}
          strokeWidth={visible ? 0 : 1.5}
        />
        {/* Strike-through line when hidden */}
        {!visible && (
          <Line
            x1="4"
            y1="4"
            x2="20"
            y2="20"
            stroke={AuraColors.primary}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
};

// ─── AuraInput Component ─────────────────────────────────────────────
export const AuraInput: React.FC<AuraInputProps> = ({
  labelPlaceholder,
  isPassword = false,
  error,
  value,
  onChangeText,
  containerClassName = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Bounce scale for toggle button
  const toggleScale = useSharedValue(1);

  const handleToggle = () => {
    toggleScale.value = withSequence(
      withTiming(0.8, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    setShowPassword(!showPassword);
  };

  const animatedToggleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: toggleScale.value }],
  }));

  const getBorderColor = () => {
    if (error) return 'border-red-500';
    if (isFocused) return 'border-aura-primary';
    return 'border-aura-secondary';
  };

  const borderClass = getBorderColor();

  if (isPassword) {
    return (
      <View className={`w-full mb-3.5 ${containerClassName}`}>
        <View className="flex-row items-center gap-2.5 w-full">
          {/* Main Password Input Box */}
          <View
            className={`flex-1 h-[52px] border-[1.5px] rounded-[14px] bg-white px-4 justify-center ${borderClass}`}
          >
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={labelPlaceholder}
              placeholderTextColor={AuraColors.secondary}
              secureTextEntry={!showPassword}
              className={`text-[15px] p-0 m-0 ${
                value ? 'text-aura-charcoal font-medium' : 'text-aura-secondary font-semibold'
              }`}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              {...props}
            />
          </View>

          {/* Animated Visibility Toggle Box */}
          <AnimatedPressable
            onPress={handleToggle}
            className={`w-[52px] h-[52px] border-[1.5px] rounded-[14px] bg-white items-center justify-center active:bg-blue-50 ${borderClass}`}
            style={animatedToggleStyle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            <AnimatedEyeIcon visible={showPassword} />
          </AnimatedPressable>
        </View>

        {error ? <Text className="text-red-500 text-xs mt-1 ml-1.5">{error}</Text> : null}
      </View>
    );
  }

  return (
    <View className={`w-full mb-3.5 ${containerClassName}`}>
      <View
        className={`h-[52px] border-[1.5px] rounded-[14px] bg-white px-4 justify-center ${borderClass}`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={labelPlaceholder}
          placeholderTextColor={AuraColors.secondary}
          className={`text-[15px] p-0 m-0 ${
            value ? 'text-aura-charcoal font-medium' : 'text-aura-secondary font-semibold'
          }`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error ? <Text className="text-red-500 text-xs mt-1 ml-1.5">{error}</Text> : null}
    </View>
  );
};
