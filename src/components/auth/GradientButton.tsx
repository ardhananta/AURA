import React from 'react';
import {
  Text,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuraColors } from '@/constants/aura-theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  isLoading = false,
  disabled = false,
  className = '',
  style,
  textStyle,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.buttonWrapper,
        pressed && styles.buttonPressed,
        (disabled || isLoading) && styles.buttonDisabled,
        style,
      ]}
      className={className}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
    >
      <LinearGradient
        colors={['#53CEF8', '#2373F4']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        {isLoading ? (
          <ActivityIndicator color={AuraColors.white} size="small" />
        ) : (
          <Text style={[styles.text, textStyle]}>
            {title}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    width: '100%',
    borderRadius: 9999,
    shadowColor: '#2373F4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
    elevation: 1,
  },
  gradient: {
    height: 54,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
