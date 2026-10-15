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
import { AnimatedAuthHeader, AnimatedAuthBody } from '@/components/auth/AuthTransition';
import { AuraColors } from '@/constants/aura-theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const validate = () => {
    if (!email.trim()) {
      setError('Alamat email wajib diisi');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Format email tidak valid');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleResetPassword = () => {
    if (!validate()) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
      Alert.alert(
        'Email Terkirim',
        `Tautan reset password telah dikirim ke ${email}. Silakan cek kotak masuk Anda.`,
        [{ text: 'OK' }]
      );
    }, 1200);
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
            title="Lupa Password?"
            simpleSubtitle="Tenang, kami bantu ya."
            showBackButton
            onBackPress={() => router.back()}
          />
        </AnimatedAuthHeader>

        {/* Form Body with slide-up animation */}
        <AnimatedAuthBody delay={180}>
        <View className="px-7 pt-8 pb-12">
          {/* Informative prompt matching reference mockup */}
          <Text className="text-[14.5px] font-medium text-aura-primary leading-5 mb-6">
            Masukkan email yang terhubung dengan akun Aura
          </Text>

          {/* Email Input */}
          <AuraInput
            labelPlaceholder="Alamat Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(undefined);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={error}
          />

          {/* Success Banner if email sent */}
          {isSent && (
            <View className="flex-row items-center gap-2 bg-emerald-50 p-3 rounded-xl mb-3 border border-emerald-200">
              <Ionicons name="checkmark-circle" size={20} color={AuraColors.success} />
              <Text className="text-[13px] text-emerald-800 flex-1">
                Email instruksi reset telah dikirim ke {email}
              </Text>
            </View>
          )}

          {/* Action Button */}
          <GradientButton
            title="Reset Password"
            onPress={handleResetPassword}
            isLoading={isLoading}
            className="mt-4"
          />

          {/* Back to Login link */}
          <Pressable
            onPress={() => router.push('/')}
            className="self-center mt-6 py-2 active:opacity-70"
            hitSlop={8}
          >
            <Text className="text-sm text-slate-500">
              Sudah ingat password?{' '}
              <Text style={{ color: '#2373F4', fontWeight: '700', textDecorationLine: 'underline' }}>Masuk</Text>
            </Text>
          </Pressable>
        </View>
        </AnimatedAuthBody>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
