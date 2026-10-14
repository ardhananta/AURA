import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

const FONT_MAP: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  normal: 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
};

function getFontFamily(fontWeight?: string | number): string {
  if (!fontWeight) return 'PlusJakartaSans_400Regular';
  const weightStr = String(fontWeight);
  return FONT_MAP[weightStr] || 'PlusJakartaSans_400Regular';
}

let isApplied = false;

export function applyGlobalFont() {
  if (isApplied) return;
  isApplied = true;

  // Patch Text component
  const TextComponent = Text as any;
  const originalTextRender = TextComponent.render;

  if (originalTextRender) {
    TextComponent.render = function (...args: any[]) {
      const origin = originalTextRender.apply(this, args);
      const flattenedStyle = StyleSheet.flatten(origin.props.style) || {};
      const fontFamily = flattenedStyle.fontFamily || getFontFamily(flattenedStyle.fontWeight);

      return React.cloneElement(origin, {
        style: [{ fontFamily }, origin.props.style],
      });
    };
  }

  // Patch TextInput component
  const TextInputComponent = TextInput as any;
  const originalTextInputRender = TextInputComponent.render;

  if (originalTextInputRender) {
    TextInputComponent.render = function (...args: any[]) {
      const origin = originalTextInputRender.apply(this, args);
      const flattenedStyle = StyleSheet.flatten(origin.props.style) || {};
      const fontFamily = flattenedStyle.fontFamily || getFontFamily(flattenedStyle.fontWeight);

      return React.cloneElement(origin, {
        style: [{ fontFamily }, origin.props.style],
      });
    };
  }
}
