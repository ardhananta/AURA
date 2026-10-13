import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ID_TOKEN_KEY = 'aura_id_token';
const REFRESH_TOKEN_KEY = 'aura_refresh_token';

// In-memory fallback if storage is unavailable (e.g. SSR or incognito)
const memoryStore = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to memory
    }
    memoryStore.set(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`[SecureStore] Failed to write key ${key}:`, err);
    memoryStore.set(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback to memory
    }
    return memoryStore.get(key) || null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] Failed to read key ${key}:`, err);
    return memoryStore.get(key) || null;
  }
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback
    }
    memoryStore.delete(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] Failed to delete key ${key}:`, err);
    memoryStore.delete(key);
  }
}

export const TokenStorage = {
  getIdToken: () => getItem(ID_TOKEN_KEY),
  setIdToken: (token: string) => setItem(ID_TOKEN_KEY, token),
  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setItem(REFRESH_TOKEN_KEY, token),
  saveTokens: async (tokens: { idToken: string; refreshToken: string }) => {
    await Promise.all([
      setItem(ID_TOKEN_KEY, tokens.idToken),
      setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },
  clearTokens: async () => {
    await Promise.all([
      removeItem(ID_TOKEN_KEY),
      removeItem(REFRESH_TOKEN_KEY),
    ]);
  },
};
