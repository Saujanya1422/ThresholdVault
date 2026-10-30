import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { DemoAccount, UserProfile, UserRole } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  demoAccounts: DemoAccount[];
  login: (email: string, password: string) => Promise<void>;
  switchPersona: (email: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tv_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const { success, error } = useToast();

  const loadDemoAccounts = async () => {
    try {
      const accounts = await api.getDemoAccounts();
      setDemoAccounts(accounts);
    } catch (e) {
      console.error('Failed to load demo accounts', e);
    }
  };

  const refreshProfile = useCallback(async () => {
    const curToken = localStorage.getItem('tv_token');
    if (!curToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch (e) {
      console.warn('Session expired or invalid', e);
      localStorage.removeItem('tv_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemoAccounts();
    // Default to security officer if not authenticated for seamless demo experience
    const existing = localStorage.getItem('tv_token');
    if (!existing) {
      api.switchDemo('officer@thresholdvault.io')
        .then((res) => {
          localStorage.setItem('tv_token', res.access_token);
          setToken(res.access_token);
          return refreshProfile();
        })
        .catch(() => setIsLoading(false));
    } else {
      refreshProfile();
    }
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('tv_token', res.access_token);
      setToken(res.access_token);
      await refreshProfile();
      success('Authentication Successful', `Welcome, ${res.full_name} (${res.role})`);
    } catch (err: any) {
      error('Authentication Failed', err.message || 'Invalid credentials');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchPersona = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await api.switchDemo(email);
      localStorage.setItem('tv_token', res.access_token);
      setToken(res.access_token);
      await refreshProfile();
      success('Role Switched', `Active identity: ${res.full_name} [${res.role}]`);
    } catch (err: any) {
      error('Failed to Switch Identity', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('tv_token');
    setToken(null);
    setUser(null);
    success('Session Terminated', 'You have been securely logged out.');
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        demoAccounts,
        login,
        switchPersona,
        logout,
        hasRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
