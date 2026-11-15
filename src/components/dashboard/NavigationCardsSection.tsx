/**
 * Navigation Cards Section
 * Two cards for new Navigation & Journey History features
 * Insert this after the 4 main feature buttons in dashboard.tsx
 */

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export const NavigationCardsSection: React.FC = () => {
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 12,
      }}
      style={{
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      {/* Journey History Card */}
      <Pressable
        onPress={() => router.push('/daily-journey')}
        style={({ pressed }) => [
          {
            width: 196,
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 16,
            minHeight: 140,
            justifyContent: 'space-between',
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <View>
            <Ionicons name="map" size={32} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: '#FFFFFF',
                marginTop: 8,
              }}
            >
              Tracking Harian
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 16,
            }}
          >
            Lihat perjalanan dan paparan polusi Anda hari ini
          </Text>
        </LinearGradient>
      </Pressable>

      {/* Navigation Card */}
      <Pressable
        onPress={() => router.push('/universal-navigation')}
        style={({ pressed }) => [
          {
            width: 196,
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 16,
            minHeight: 140,
            justifyContent: 'space-between',
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <View>
            <Ionicons name="navigate" size={32} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: '#FFFFFF',
                marginTop: 8,
              }}
            >
              Navigasi
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 16,
            }}
          >
            Navigasi dengan peringatan kesehatan real-time
          </Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
};
