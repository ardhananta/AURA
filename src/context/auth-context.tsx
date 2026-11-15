import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'expo-router';
import { authApi, setOnSessionExpired } from '@/services/api';
import { TokenStorage } from '@/services/storage';
import { User, AuthResponseData, RegisterPayload, UpdateProfilePayload } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResponseData>;
  register: (payload: RegisterPayload) => Promise<AuthResponseData>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await TokenStorage.getIdToken();
      if (!token) {
        setUser(null);
        return;
      }

      // 1. Cek profil cache lokal terlebih dahulu (agar instan & mendukung mode offline)
      const cached = await TokenStorage.getUserProfile();
      if (cached) {
        setUser(cached);
      }

      // 2. Verifikasi sesi ke backend dengan batas waktu maksimal 3.5 detik
      // Mencegah aplikasi stuck loading di splash jika koneksi lambat atau offline
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 3500)
      );

      const profile = (await Promise.race([
        authApi.getMe(),
        timeoutPromise,
      ])) as User;

      if (profile) {
        setUser(profile);
        await TokenStorage.setUserProfile(profile);
      }
    } catch (err: any) {
      console.warn('[AuthProvider] Session validation note:', err?.message || err);
      const isUnauthorized =
        err?.response?.status === 401 || err?.response?.status === 403;

      if (isUnauthorized) {
        // Hanya hapus token jika server secara eksplisit menolak kredensial
        await TokenStorage.clearTokens();
        setUser(null);
      } else {
        // Jika offline, timeout, atau gangguan jaringan:
        // Tetap pertahankan sesi lokal dari cache jika ada
        const cached = await TokenStorage.getUserProfile();
        if (cached) {
          setUser(cached);
        } else {
          setUser(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Register callback for session expiration from axios interceptor
    setOnSessionExpired(() => {
      setUser(null);
      router.replace('/');
    });
  }, [checkAuth, router]);

  const login = async (email: string, password: string): Promise<AuthResponseData> => {
    const data = await authApi.login({ email, password });
    await TokenStorage.saveTokens(data.tokens);
    await TokenStorage.setUserProfile(data.user);
    setUser(data.user);
    return data;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponseData> => {
    const data = await authApi.register(payload);
    await TokenStorage.saveTokens(data.tokens);
    await TokenStorage.setUserProfile(data.user);
    setUser(data.user);
    return data;
  };

  const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
    const updatedUser = await authApi.updateProfile(payload);
    const merged = (user ? { ...user, ...updatedUser } : updatedUser) as User;
    await TokenStorage.setUserProfile(merged);
    setUser(merged);
    return merged;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      await TokenStorage.clearTokens();
      setUser(null);
      router.replace('/');
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    updateProfile,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
