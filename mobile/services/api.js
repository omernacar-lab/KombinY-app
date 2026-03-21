import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/theme';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Token interceptor
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ==================== GARDIROB ====================
export const wardrobeAPI = {
  getClothes: (params) => api.get('/wardrobe', { params }),
  getGrouped: () => api.get('/wardrobe/grouped'),
  getStats: () => api.get('/wardrobe/stats'),
  addClothing: (formData) =>
    api.post('/wardrobe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // AI analiz uzun sürebilir
    }),
  updateClothing: (id, data) => api.patch(`/wardrobe/${id}`, data),
  updateStatus: (id, status) => api.patch(`/wardrobe/${id}/status`, { status }),
  bulkUpdateStatus: (ids, status) => api.patch('/wardrobe/bulk/status', { ids, status }),
  deleteClothing: (id) => api.delete(`/wardrobe/${id}`),
  uploadPhoto: (id, formData) =>
    api.post(`/wardrobe/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),
  scanVideo: (formData) =>
    api.post('/wardrobe/scan-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  bulkAddClothing: (items) =>
    api.post('/wardrobe/bulk-add', { items }, { timeout: 30000 }),
};

// ==================== KOMBİN ====================
export const outfitAPI = {
  suggest: (data) => api.post('/outfit/suggest', data),
  feedback: (id, data) => api.post(`/outfit/${id}/feedback`, data),
  wear: (id) => api.post(`/outfit/${id}/wear`),
  history: (params) => api.get('/outfit/history', { params }),
};

// ==================== HAVA DURUMU ====================
export const weatherAPI = {
  get: (city) => api.get('/weather', { params: { city } }),
};

// ==================== KULLANICI ====================
export const userAPI = {
  updateProfile: (data) => api.patch('/user/profile', data),
  addEvent: (data) => api.post('/user/events', data),
  getEvents: () => api.get('/user/events'),
};

export default api;
