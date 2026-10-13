import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { AuraColors } from '@/constants/aura-theme';

interface AuthHeaderProps {
  title: string;
  subtitlePrefix?: string;
  subtitleActionText?: string;
  onSubtitleActionPress?: () => void;
  simpleSubtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  className?: string;
  compact?: boolean;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
  title,
  subtitlePrefix,
  subtitleActionText,
  onSubtitleActionPress,
  simpleSubtitle,
  showBackButton = false,
  onBackPress,
  className = '',
  compact = false,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive header dimensions
  const headerHeight = compact
    ? Math.max(180, insets.top + 120)
    : Math.max(250, insets.top + 190);
  const startY = headerHeight;
  const endY = compact ? headerHeight - 40 : headerHeight - 55;
  const controlX = width * 0.45;
  const controlY = compact ? headerHeight + 10 : headerHeight + 15;

  const pathData = `
    M 0,0
    L ${width},0
    L ${width},${endY}
    Q ${controlX},${controlY} 0,${startY}
    Z
  `;

  return (
    <View
      className={`w-full overflow-hidden ${className}`}
      style={{ height: headerHeight + 20 }}
    >
      {/* Background Curved SVG Gradient */}
      <Svg
        width={width}
        height={headerHeight + 20}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <SvgLinearGradient id="auraHeaderGradient" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={AuraColors.cyan} />
            <Stop offset="35%" stopColor={AuraColors.secondary} />
            <Stop offset="100%" stopColor={AuraColors.primary} />
          </SvgLinearGradient>
        </Defs>
        <Path d={pathData} fill="url(#auraHeaderGradient)" />
      </Svg>

      {/* Header Content Overlay */}
      <View
        className="px-7"
        style={{
          paddingTop: insets.top + (showBackButton ? 8 : 28),
        }}
      >
        {showBackButton && (
          <Pressable
            onPress={onBackPress}
            className="mb-3 self-start w-9 h-9 rounded-full bg-white/20 items-center justify-center active:opacity-70"
            hitSlop={12}
            accessibilityLabel="Kembali"
          >
            <Ionicons name="arrow-back" size={24} color={AuraColors.white} />
          </Pressable>
        )}

        <Text
          className={`${
            compact ? 'text-[27px] mb-1' : 'text-[34px] mb-2'
          } font-bold text-white tracking-tight`}
        >
          {title}
        </Text>

        {simpleSubtitle ? (
          <Text className="text-[14.5px] text-blue-100 font-normal">
            {simpleSubtitle}
          </Text>
        ) : (
          <View className="flex-row items-center flex-wrap">
            {subtitlePrefix ? (
              <Text className="text-[14.5px] text-blue-100 font-normal">
                {subtitlePrefix}{' '}
              </Text>
            ) : null}
            {subtitleActionText ? (
              <Pressable
                onPress={onSubtitleActionPress}
                hitSlop={8}
                className="active:opacity-80"
              >
                <Text className="text-[14.5px] text-white font-semibold underline">
                  {subtitleActionText}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};
