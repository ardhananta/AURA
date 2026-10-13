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

      // Verify token with backend /api/auth/me
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('[AuthProvider] Session validation failed:', err);
      await TokenStorage.clearTokens();
      setUser(null);
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
    setUser(data.user);
    return data;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponseData> => {
    const data = await authApi.register(payload);
    await TokenStorage.saveTokens(data.tokens);
    setUser(data.user);
    return data;
  };

  const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
    const updatedUser = await authApi.updateProfile(payload);
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
    return updatedUser;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
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
