import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { ProfileInput } from '@/components/auth/ProfileInput';
import { GradientButton } from '@/components/auth/GradientButton';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/utils/error-mapper';
import { isProfileComplete } from '@/types/auth';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    email?: string;
    password?: string;
  }>();

  const { register, updateProfile, isAuthenticated, user } = useAuth();

  const [usia, setUsia] = useState('');
  const [tinggiBadan, setTinggiBadan] = useState('');
  const [beratBadan, setBeratBadan] = useState('');
  const [waktuDiJalan, setWaktuDiJalan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    usia?: string;
    tinggiBadan?: string;
    beratBadan?: string;
    waktuDiJalan?: string;
  }>({});

  // Prepopulate if user already exists
  useEffect(() => {
    if (user) {
      if (user.usia && !usia) setUsia(String(user.usia));
      if (user.tinggi_badan && !tinggiBadan) setTinggiBadan(String(user.tinggi_badan));
      if (user.berat_badan && !beratBadan) setBeratBadan(String(user.berat_badan));
      if (user.waktu_di_jalan !== undefined && user.waktu_di_jalan !== null && !waktuDiJalan) {
        setWaktuDiJalan(String(user.waktu_di_jalan));
      }
    }
  }, [user]);

  const validate = () => {
    const newErrors: {
      usia?: string;
      tinggiBadan?: string;
      beratBadan?: string;
      waktuDiJalan?: string;
    } = {};

    // 1. Validasi Usia (1 - 150, int)
    const trimmedUsia = usia.trim();
    if (!trimmedUsia) {
      newErrors.usia = 'Usia wajib diisi';
    } else {
      const parsedUsia = parseInt(trimmedUsia, 10);
      if (isNaN(parsedUsia) || parsedUsia < 1 || parsedUsia > 150 || !/^\d+$/.test(trimmedUsia)) {
        newErrors.usia = 'Usia harus berupa angka bulat antara 1 - 150 tahun';
      }
    }

    // 2. Validasi Tinggi Badan (1 - 300, float)
    const normalizedTinggi = tinggiBadan.trim().replace(',', '.');
    if (!normalizedTinggi) {
      newErrors.tinggiBadan = 'Tinggi badan wajib diisi';
    } else {
      const parsedTinggi = parseFloat(normalizedTinggi);
      if (isNaN(parsedTinggi) || parsedTinggi < 1 || parsedTinggi > 300) {
        newErrors.tinggiBadan = 'Tinggi badan harus antara 1 - 300 cm';
      }
    }

    // 3. Validasi Berat Badan (1 - 500, float)
    const normalizedBerat = beratBadan.trim().replace(',', '.');
    if (!normalizedBerat) {
      newErrors.beratBadan = 'Berat badan wajib diisi';
    } else {
      const parsedBerat = parseFloat(normalizedBerat);
      if (isNaN(parsedBerat) || parsedBerat < 1 || parsedBerat > 500) {
        newErrors.beratBadan = 'Berat badan harus antara 1 - 500 kg';
      }
    }

    // 4. Validasi Waktu di Jalan (0 - 24, float)
    const normalizedWaktu = waktuDiJalan.trim().replace(',', '.');
    if (!normalizedWaktu) {
      newErrors.waktuDiJalan = 'Waktu di jalan wajib diisi';
    } else {
      const parsedWaktu = parseFloat(normalizedWaktu);
      if (isNaN(parsedWaktu) || parsedWaktu < 0 || parsedWaktu > 24) {
        newErrors.waktuDiJalan = 'Waktu di jalan harus antara 0 - 24 jam/hari (0 jika WFH)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    setServerError(null);
    if (!validate()) return;

    const parsedUsia = parseInt(usia.trim(), 10);
    const parsedTinggi = parseFloat(tinggiBadan.trim().replace(',', '.'));
    const parsedBerat = parseFloat(beratBadan.trim().replace(',', '.'));
    const parsedWaktu = parseFloat(waktuDiJalan.trim().replace(',', '.'));

    try {
      setIsLoading(true);

      if (params.name && params.email && params.password) {
        // Alur registrasi baru dari register screen
        await register({
          name: params.name,
          email: params.email,
          password: params.password,
          usia: parsedUsia,
          tinggi_badan: parsedTinggi,
          berat_badan: parsedBerat,
          waktu_di_jalan: parsedWaktu,
        });
        router.replace('/dashboard');
      } else if (isAuthenticated) {
        // Alur update profil (misal setelah login Google atau akun yang belum lengkap datanya)
        await updateProfile({
          usia: parsedUsia,
          tinggi_badan: parsedTinggi,
          berat_badan: parsedBerat,
          waktu_di_jalan: parsedWaktu,
        });
        router.replace('/dashboard');
      } else {
        // Jika sedang diuji langsung tanpa parameter registrasi
        router.replace('/dashboard');
      }
    } catch (err: any) {
      const message = getErrorMessage(err);
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    if (params.name && params.email) {
      router.back();
    } else if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
        className="bg-white"
        keyboardShouldPersistTaps="handled"
        bounces={true}
        showsVerticalScrollIndicator={true}
      >
        {/* Curved Organic Header (Compact so form fits nicely) */}
        <AuthHeader
          title="Tentang kamu"
          simpleSubtitle="Yuk, lengkapi profilmu dulu."
          compact={true}
          showBackButton={true}
          onBackPress={handleBackPress}
        />

        {/* Form Body */}
        <View className="px-7 pt-3 pb-8">
          {/* Server Error Alert Banner */}
          {serverError ? (
            <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text className="text-[13px] text-red-700 flex-1 font-medium">
                {serverError}
              </Text>
            </View>
          ) : null}

          {/* Usia Input */}
          <ProfileInput
            label="Usia"
            placeholder="Contoh: 25"
            unit="tahun"
            value={usia}
            onChangeText={(text) => {
              setUsia(text);
              if (serverError) setServerError(null);
              if (errors.usia) setErrors((prev) => ({ ...prev, usia: undefined }));
            }}
            keyboardType="number-pad"
            error={errors.usia}
          />

          {/* Tinggi Badan Input */}
          <ProfileInput
            label="Tinggi badan"
            placeholder="Contoh: 170"
            unit="cm"
            value={tinggiBadan}
            onChangeText={(text) => {
              setTinggiBadan(text);
              if (serverError) setServerError(null);
              if (errors.tinggiBadan) {
                setErrors((prev) => ({ ...prev, tinggiBadan: undefined }));
              }
            }}
            keyboardType="decimal-pad"
            error={errors.tinggiBadan}
          />

          {/* Berat Badan Input */}
          <ProfileInput
            label="Berat badan"
            placeholder="Contoh: 65"
            unit="kg"
            value={beratBadan}
            onChangeText={(text) => {
              setBeratBadan(text);
              if (serverError) setServerError(null);
              if (errors.beratBadan) {
                setErrors((prev) => ({ ...prev, beratBadan: undefined }));
              }
            }}
            keyboardType="decimal-pad"
            error={errors.beratBadan}
          />

          {/* Waktu di Jalan Input */}
          <ProfileInput
            label="Waktu di jalan setiap hari"
            placeholder="Contoh: 2"
            unit="jam/hari"
            value={waktuDiJalan}
            onChangeText={(text) => {
              setWaktuDiJalan(text);
              if (serverError) setServerError(null);
              if (errors.waktuDiJalan) {
                setErrors((prev) => ({ ...prev, waktuDiJalan: undefined }));
              }
            }}
            keyboardType="decimal-pad"
            helperText="Hitung total waktu perjalananmu dalam sehari, termasuk pergi dan pulang."
            error={errors.waktuDiJalan}
          />

          {/* Action Button: Lanjut ke Dashboard */}
          <GradientButton
            title="Lanjut ke Dashboard"
            onPress={handleContinue}
            isLoading={isLoading}
            className="mt-4"
          />

          {/* Optional Direct Navigation if profile is already complete */}
          {isAuthenticated && isProfileComplete(user) ? (
            <Pressable
              onPress={() => router.replace('/dashboard')}
              className="mt-3.5 py-2 items-center justify-center active:opacity-70"
            >
              <Text className="text-aura-primary text-sm font-semibold">
                Kembali ke Dashboard
              </Text>
            </Pressable>
          ) : null}

          {/* Footer Explanation Note */}
          <Text className="text-center text-slate-500 text-[13.5px] mt-4 font-normal">
            Agar rekomendasi Aura lebih sesuai untukmu.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
