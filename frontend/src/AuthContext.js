import React, { createContext, useState, useContext, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/users/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    await fetchUserProfile();
    return response.data;
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
    isAuthenticated: !!localStorage.getItem('token')
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
