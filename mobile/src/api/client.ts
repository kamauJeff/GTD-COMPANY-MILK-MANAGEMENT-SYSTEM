// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('gutoria_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (code: string, password: string) => api.post('/api/auth/login', { code, password }),
};

export const farmersApi = {
  list: (params?: any) => api.get('/api/farmers', { params }),
};

export const collectionsApi = {
  batchSync: (records: any[]) => api.post('/api/collections/batch', { records }),
};

