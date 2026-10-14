'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { api, getToken, setToken, removeToken } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isCoordinator: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = getToken();
    const storedUser = localStorage.getItem('techx_user');

    if (storedToken && storedUser) {
      try {
        setTokenState(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        removeToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const data = await api.login({ email, password: pass });
      setToken(data.access_token);
      setTokenState(data.access_token);
      const userObj: User = {
        id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };
      setUser(userObj);
      localStorage.setItem('techx_user', JSON.stringify(userObj));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setTokenState(null);
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isCoordinator = user?.role === 'COORDINATOR' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAdmin,
        isCoordinator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
