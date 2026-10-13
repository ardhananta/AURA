import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/services/api';
import { AuraColors } from '@/constants/aura-theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [apiResponseInfo, setApiResponseInfo] = useState<string | null>(null);

  const handleTestGetMe = async () => {
    try {
      setIsRefreshing(true);
      setApiResponseInfo(null);
      const profile = await authApi.getMe();
      setApiResponseInfo(`Profil berhasil diverifikasi via GET /api/auth/me:\n${JSON.stringify(profile, null, 2)}`);
      await checkAuth();
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal memanggil /api/auth/me');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar dari akun Aura?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Top Banner with Aura Gradient */}
      <View className="bg-aura-primary pt-14 pb-8 px-6 rounded-b-[32px] shadow-lg shadow-aura-primary/30">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-blue-100 text-sm font-medium">Selamat Datang di Aura,</Text>
            <Text className="text-white text-2xl font-bold">
              {user?.name || 'Pengguna Aura'}
            </Text>
          </View>
          <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center border border-white/40">
            <Ionicons name="person" size={24} color="#FFFFFF" />
          </View>
        </View>

        {/* Status Badge */}
        <View className="self-start flex-row items-center gap-1.5 bg-emerald-500/20 border border-emerald-300/40 px-3 py-1 rounded-full">
          <View className="w-2 h-2 rounded-full bg-emerald-400" />
          <Text className="text-white text-xs font-semibold">
            Status: Terautentikasi (JWT Aktif)
          </Text>
        </View>
      </View>

      <View className="px-6 mt-6">
        {/* User Profile Card */}
        <View className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-5">
          <Text className="text-slate-800 text-base font-bold mb-3 flex-row items-center">
            Informasi Akun
          </Text>

          <View className="space-y-3">
            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <Text className="text-slate-500 text-sm">Nama Lengkap</Text>
              <Text className="text-slate-800 text-sm font-semibold">{user?.name || '-'}</Text>
            </View>

            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <Text className="text-slate-500 text-sm">Email Terdaftar</Text>
              <Text className="text-slate-800 text-sm font-semibold">{user?.email || '-'}</Text>
            </View>

            <View className="flex-row justify-between py-2 border-b border-slate-100">
              <Text className="text-slate-500 text-sm">User ID (UID)</Text>
              <Text className="text-slate-600 text-xs font-mono max-w-[200px]" numberOfLines={1}>
                {user?.uid || '-'}
              </Text>
            </View>

            {user?.lastLoginAt && (
              <View className="flex-row justify-between py-2">
                <Text className="text-slate-500 text-sm">Login Terakhir</Text>
                <Text className="text-slate-700 text-xs">{user.lastLoginAt}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Testing Card */}
        <View className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-5">
          <Text className="text-slate-800 text-base font-bold mb-2">
            Pengujian Endpoint Backend
          </Text>
          <Text className="text-slate-500 text-xs mb-4">
            Uji otentikasi Bearer token dengan memanggil endpoint GET /api/auth/me secara langsung.
          </Text>

          <Pressable
            onPress={handleTestGetMe}
            disabled={isRefreshing}
            className="flex-row items-center justify-center gap-2 bg-aura-primary/10 border border-aura-primary/30 py-3 rounded-xl active:bg-aura-primary/20"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={AuraColors.primary} />
            ) : (
              <>
                <Ionicons name="refresh-circle" size={20} color={AuraColors.primary} />
                <Text className="text-aura-primary text-sm font-bold">
                  Panggil GET /api/auth/me
                </Text>
              </>
            )}
          </Pressable>

          {apiResponseInfo ? (
            <View className="mt-3 p-3 bg-slate-900 rounded-xl">
              <Text className="text-emerald-400 font-mono text-[11px]">
                {apiResponseInfo}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          disabled={isLoggingOut}
          className="flex-row items-center justify-center gap-2 bg-red-50 border border-red-200 py-3.5 rounded-xl active:bg-red-100 mb-6"
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text className="text-red-600 text-sm font-bold">
                Keluar dari Akun (Logout)
              </Text>
            </>
          )}
        </Pressable>

        {/* Shortcut to switch back to Login/Register screens */}
        <View className="items-center">
          <Pressable
            onPress={() => router.push('/')}
            className="py-2 px-4 rounded-full bg-slate-200 active:opacity-70"
          >
            <Text className="text-xs text-slate-600 font-semibold">
              ← Kembali ke Layar Login
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
