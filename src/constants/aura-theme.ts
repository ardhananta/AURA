/**
 * Aura Design System & Color Palette
 * Based on the reference specifications:
 * - Primary Blue: #2373F4
 * - Secondary Blue: #578EF5
 * - Cyan / Sky Blue: #65D0F4
 * - Pale Yellow Accent: #F2F7A0
 * - Pure White: #FFFFFF
 * - Charcoal Dark: #363636
 */

export const AuraColors = {
  // Brand Palette
  primary: '#2373F4',
  secondary: '#578EF5',
  cyan: '#65D0F4',
  accentYellow: '#F2F7A0',
  white: '#FFFFFF',
  charcoal: '#363636',

  // UI Derived Colors
  background: '#FFFFFF',
  inputBorder: '#578EF5',
  inputFocusBorder: '#2373F4',
  inputPlaceholder: '#578EF5',
  inputText: '#2373F4',
  inputFilledText: '#363636',
  dividerLine: '#BFDBFE',
  dividerText: '#2373F4',
  linkText: '#2373F4',
  headerText: '#FFFFFF',
  headerSubtext: '#EBF4FF',

  // Gradient definitions
  gradientHeader: ['#4A9CF4', '#2D7DF6', '#2373F4'] as const,
  gradientButton: ['#2373F4', '#2373F4'] as const,
  gradientButtonHover: ['#1B5ECC', '#1B5ECC'] as const,

  // Status
  error: '#EF4444',
  success: '#10B981',
} as const;

export const AuraSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const AuraRadius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
} as const;
