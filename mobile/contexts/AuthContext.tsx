import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { getAuthToken, removeAuthToken } from '../services/storage';
import { login as apiLogin, signup as apiSignup, getMe } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; username: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          const me = await getMe();
          setUser(me);
          await connectSocket();
        }
      } catch {
        await removeAuthToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
    await connectSocket();
  }, []);

  const signup = useCallback(async (signupData: { email: string; username: string; password: string; displayName: string }) => {
    const data = await apiSignup(signupData);
    setUser(data.user);
    await connectSocket();
  }, []);

  const logout = useCallback(async () => {
    await removeAuthToken();
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
