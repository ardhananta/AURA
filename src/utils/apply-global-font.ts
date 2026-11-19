import React from 'react';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';

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

  // Di platform Web, react-native-web merender elemen DOM (<span>, <input>).
  // Melakukan monkey-patching pada Component.render menyebabkan error CSSStyleDeclaration
  // karena DOM tidak mendukung setter array berindeks [0].
  // Sebagai gantinya, pada Web kita terapkan font global melalui CSS document root.
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      try {
        const style = document.createElement('style');
        style.textContent = `
          body, input, textarea, select, button {
            font-family: 'PlusJakartaSans_400Regular', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
        `;
        document.head.appendChild(style);
      } catch (e) {
        console.warn('[applyGlobalFont] Gagal menyuntikkan CSS font pada web:', e);
      }
    }
    return;
  }

  // Patch Text component khusus Native (iOS / Android)
  const TextComponent = Text as any;
  const originalTextRender = TextComponent.render;

  if (originalTextRender) {
    TextComponent.render = function (...args: any[]) {
      const origin = originalTextRender.apply(this, args);
      if (!origin || !origin.props) return origin;

      const flattenedStyle = StyleSheet.flatten(origin.props.style) || {};
      const fontFamily = flattenedStyle.fontFamily || getFontFamily(flattenedStyle.fontWeight);

      return React.cloneElement(origin, {
        style: StyleSheet.flatten([{ fontFamily }, origin.props.style]),
      });
    };
  }

  // Patch TextInput component khusus Native (iOS / Android)
  const TextInputComponent = TextInput as any;
  const originalTextInputRender = TextInputComponent.render;

  if (originalTextInputRender) {
    TextInputComponent.render = function (...args: any[]) {
      const origin = originalTextInputRender.apply(this, args);
      if (!origin || !origin.props) return origin;

      const flattenedStyle = StyleSheet.flatten(origin.props.style) || {};
      const fontFamily = flattenedStyle.fontFamily || getFontFamily(flattenedStyle.fontWeight);

      return React.cloneElement(origin, {
        style: StyleSheet.flatten([{ fontFamily }, origin.props.style]),
      });
    };
  }
}
