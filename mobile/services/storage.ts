import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const getAuthToken = () => storage.getItem(AUTH_TOKEN_KEY);
export const setAuthToken = (token: string) => storage.setItem(AUTH_TOKEN_KEY, token);
export const removeAuthToken = () => storage.removeItem(AUTH_TOKEN_KEY);
export const getRefreshToken = () => storage.getItem(REFRESH_TOKEN_KEY);
export const setRefreshToken = (token: string) => storage.setItem(REFRESH_TOKEN_KEY, token);
export const removeRefreshToken = () => storage.removeItem(REFRESH_TOKEN_KEY);

export async function clearAuthTokens() {
  await Promise.all([removeAuthToken(), removeRefreshToken()]);
}
