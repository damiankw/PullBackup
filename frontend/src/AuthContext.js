import React, { createContext, useState, useContext, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('[AuthContext] Initializing, token:', !!token);
    if (token) {
      fetchUserProfile();
    } else {
      console.log('[AuthContext] No token, setting loading false');
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    console.log('[AuthContext] Fetching user profile...');
    try {
      const response = await api.get('/users/me');
      console.log('[AuthContext] User profile fetched:', response.data);
      setUser(response.data);
      return true;
    } catch (error) {
      console.error('[AuthContext] Failed to fetch user profile:', error);
      localStorage.removeItem('token');
      setUser(null);
      return false;
    } finally {
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    console.log('[AuthContext] Login attempt for:', username);
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      console.log('[AuthContext] Login response:', response.data);
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      console.log('[AuthContext] Token saved, fetching profile...');
      await fetchUserProfile();
      console.log('[AuthContext] Login complete, user:', user);
      return response.data;
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (username, email, password) => {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      role: 'user'
    });
    return response.data;
  };

  const value = {
    user,
    login,
    logout,
    register,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
