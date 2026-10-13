import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  TextInputProps,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AuraColors } from '@/constants/aura-theme';

interface AuraInputProps extends TextInputProps {
  labelPlaceholder: string;
  isPassword?: boolean;
  error?: string;
  containerClassName?: string;
}

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

          {/* Visibility Toggle Box */}
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            className={`w-[52px] h-[52px] border-[1.5px] rounded-[14px] bg-white items-center justify-center active:bg-blue-50 ${borderClass}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                stroke={AuraColors.primary}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle
                cx="12"
                cy="12"
                r="3.5"
                fill={AuraColors.primary}
              />
            </Svg>
          </Pressable>
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
