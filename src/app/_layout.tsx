import '@/global.css';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth-context';
import { AuraColors } from '@/constants/aura-theme';

SplashScreen.preventAutoHideAsync();

const AuraNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: AuraColors.background,
    primary: AuraColors.primary,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={AuraNavigationTheme}>
          <StatusBar style="light" />
          <View style={styles.container}>
            <AnimatedSplashOverlay />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: AuraColors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  animation: 'fade',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="login"
                options={{
                  animation: 'fade',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="register"
                options={{
                  animation: 'ios_from_right',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen
                name="complete-profile"
                options={{
                  animation: 'ios_from_right',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen name="complete-register" />
              <Stack.Screen
                name="forgot-password"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen name="dashboard" />
              <Stack.Screen name="explore" />
            </Stack>
          </View>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuraColors.background,
  },
});
