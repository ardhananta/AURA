import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuraInput } from '@/components/auth/AuraInput';
import { GradientButton } from '@/components/auth/GradientButton';
import { SocialDivider } from '@/components/auth/SocialDivider';
import { AuthTransition, AnimatedAuthHeader, AnimatedAuthBody } from '@/components/auth/AuthTransition';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/utils/error-mapper';
import { isProfileComplete } from '@/types/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Alamat email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (!password) {
      newErrors.password = 'Password wajib diisi';
    } else if (password.length < 8) {
      newErrors.password = 'Password minimal 8 karakter';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setServerError(null);
    if (!validate()) return;

    try {
      setIsLoading(true);
      const res = await login(email.trim(), password);
      // Jika profil belum lengkap (usia/tinggi/waktu di jalan), wajib lengkapi dulu
      if (isProfileComplete(res.user)) {
        router.replace('/dashboard');
      } else {
        router.replace('/complete-profile');
      }
    } catch (err: any) {
      const message = getErrorMessage(err);
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    Alert.alert('Google Sign-In', 'Fitur Google Sign-In akan segera hadir.');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="bg-white"
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Curved Organic Header with swap animation */}
        <AnimatedAuthHeader>
          <AuthHeader
            title="Masuk"
          />
        </AnimatedAuthHeader>

        {/* Form Body with slide-up animation */}
        <AnimatedAuthBody delay={180}>
        <View className="px-7 pt-6 pb-12">
          {/* Server Error Alert Banner */}
          {serverError ? (
            <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text className="text-[13px] text-red-700 flex-1 font-medium">
                {serverError}
              </Text>
            </View>
          ) : null}

          {/* Active Session Notification (if already logged in) */}
          {isAuthenticated && user ? (
            <View className="flex-row items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-xs text-aura-primary font-semibold">
                  Sesi Aktif: {user.name}
                </Text>
                <Text className="text-[11px] text-slate-500">{user.email}</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (isProfileComplete(user)) {
                    router.replace('/dashboard');
                  } else {
                    router.replace('/complete-profile');
                  }
                }}
                className="bg-aura-primary py-1 px-3 rounded-lg"
              >
                <Text className="text-white text-xs font-bold">
                  {isProfileComplete(user) ? 'Buka App' : 'Lengkapi Profil'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Email Input */}
          <AuraInput
            labelPlaceholder="Alamat Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (serverError) setServerError(null);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          {/* Password Input with Eye Box */}
          <AuraInput
            labelPlaceholder="Password"
            isPassword
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (serverError) setServerError(null);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />

          {/* Forgot Password Link */}
          <Pressable
            onPress={() => router.push('/forgot-password')}
            className="self-start mt-0.5 mb-6 active:opacity-70"
            hitSlop={8}
          >
            <Text className="text-aura-primary text-sm font-medium">
              Lupa password kamu?
            </Text>
          </Pressable>

          {/* Action Button */}
          <GradientButton
            title="Masuk"
            onPress={handleLogin}
            isLoading={isLoading}
            className="mt-1"
          />

          {/* Belum punya akun? Buat akun */}
          <Pressable
            onPress={() => router.push('/register')}
            className="self-center mt-4 mb-5 py-1 active:opacity-70"
            hitSlop={8}
          >
            <Text className="text-sm text-slate-500">
              Belum punya akun?{' '}
              <Text className="text-aura-primary font-bold">Buat akun</Text>
            </Text>
          </Pressable>

          {/* Social Divider & Google Button */}
          <SocialDivider onGooglePress={handleGoogleLogin} />
        </View>
        </AnimatedAuthBody>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
