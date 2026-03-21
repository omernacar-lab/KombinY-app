import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI, wardrobeAPI, outfitAPI, weatherAPI } from '../services/api';

// ==================== AUTH STORE ====================
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const { data } = await authAPI.getMe();
        set({ user: data.user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  register: async (userData) => {
    const { data } = await authAPI.register(userData);
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (user) => set({ user }),
}));

// ==================== WARDROBE STORE ====================
export const useWardrobeStore = create((set, get) => ({
  clothes: [],
  grouped: {},
  stats: null,
  isLoading: false,
  selectedCategory: null,

  fetchClothes: async (params) => {
    set({ isLoading: true });
    try {
      const { data } = await wardrobeAPI.getClothes(params);
      set({ clothes: data.clothes, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchGrouped: async () => {
    set({ isLoading: true });
    try {
      const { data } = await wardrobeAPI.getGrouped();
      set({ grouped: data.grouped, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const { data } = await wardrobeAPI.getStats();
      set({ stats: data.stats });
    } catch (err) {
      console.error('fetchStats failed:', err);
    }
  },

  addClothing: async (formData) => {
    const { data } = await wardrobeAPI.addClothing(formData);
    set((state) => ({ clothes: [data.clothing, ...state.clothes] }));
    return data;
  },

  updateStatus: async (id, status) => {
    await wardrobeAPI.updateStatus(id, status);
    set((state) => ({
      clothes: state.clothes.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    }));
  },

  bulkWash: async (ids) => {
    await wardrobeAPI.bulkUpdateStatus(ids, 'temiz');
    set((state) => ({
      clothes: state.clothes.map((c) =>
        ids.includes(c.id) ? { ...c, status: 'temiz' } : c
      ),
    }));
  },

  deleteClothing: async (id) => {
    await wardrobeAPI.deleteClothing(id);
    set((state) => ({
      clothes: state.clothes.filter((c) => c.id !== id),
    }));
  },

  bulkAddClothing: async (items) => {
    const { data } = await wardrobeAPI.bulkAddClothing(items);
    set((state) => ({ clothes: [...data.added, ...state.clothes] }));
    return data;
  },

  setCategory: (category) => set({ selectedCategory: category }),
}));

// ==================== OUTFIT STORE ====================
export const useOutfitStore = create((set) => ({
  currentOutfit: null,
  history: [],
  isGenerating: false,

  generateOutfit: async (occasion, city) => {
    set({ isGenerating: true });
    try {
      const { data } = await outfitAPI.suggest({ occasion, city });
      set({ currentOutfit: data, isGenerating: false });
      return data;
    } catch (error) {
      set({ isGenerating: false });
      throw error;
    }
  },

  sendFeedback: async (outfitId, liked) => {
    await outfitAPI.feedback(outfitId, { liked });
    set((state) => ({
      currentOutfit: state.currentOutfit
        ? { ...state.currentOutfit, is_liked: liked }
        : null,
    }));
  },

  wearOutfit: async (outfitId) => {
    await outfitAPI.wear(outfitId);
  },

  fetchHistory: async () => {
    const { data } = await outfitAPI.history({ limit: 30 });
    set({ history: data.outfits });
  },

  clear: () => set({ currentOutfit: null }),
}));

// ==================== WEATHER STORE ====================
export const useWeatherStore = create((set) => ({
  weather: null,
  clothingAdvice: null,

  fetchWeather: async (city) => {
    try {
      const { data } = await weatherAPI.get(city);
      set({ weather: data.weather, clothingAdvice: data.clothing_advice });
    } catch (err) {
      console.error('fetchWeather failed:', err);
    }
  },
}));
