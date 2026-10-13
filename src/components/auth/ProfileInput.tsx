import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { AuraColors } from '@/constants/aura-theme';

interface ProfileInputProps extends TextInputProps {
  label: string;
  unit: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const ProfileInput: React.FC<ProfileInputProps> = ({
  label,
  unit,
  error,
  helperText,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'numeric',
  containerClassName = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return '#EF4444';
    if (isFocused) return AuraColors.primary;
    return AuraColors.secondary;
  };

  return (
    <View className={`w-full mb-4 ${containerClassName}`}>
      {/* Label above input */}
      <Text className="text-[15px] font-bold text-aura-primary mb-2">
        {label}
      </Text>

      {/* Input container with right unit badge */}
      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          style={styles.textInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>

      {/* Helper text or Error message */}
      {error ? (
        <Text className="text-red-500 text-xs mt-1.5 ml-1">{error}</Text>
      ) : helperText ? (
        <Text className="text-slate-500 text-[12.5px] mt-1.5 ml-0.5 leading-4">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#363636',
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  unitText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: AuraColors.primary,
    marginLeft: 8,
  },
});
