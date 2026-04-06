import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase';
import { authAPI, wardrobeAPI, outfitAPI, weatherAPI } from '../services/api';

// ==================== AUTH STORE ====================
let _authSubscription = null;

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    // Önceki listener varsa temizle (duplicate listener önleme)
    if (_authSubscription) {
      _authSubscription.unsubscribe();
      _authSubscription = null;
    }

    // Oturum değişikliklerini ÖNCE dinlemeye başla
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        user: session?.user || null,
        session,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });
    _authSubscription = subscription;

    // SecureStore'dan cached session'ı al (ağ çağrısı yapmaz)
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      set({
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    set({
      user: data.user,
      session: data.session,
      isAuthenticated: true,
    });
  },

  register: async ({ email, password, fullName, city }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, city: city || 'Istanbul' },
      },
    });
    if (error) throw error;
    set({
      user: data.user,
      session: data.session,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, isAuthenticated: false });
  },

  updateUser: (profileData) => set((state) => ({
    user: state.user ? { ...state.user, ...profileData } : profileData,
  })),
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

  addClothing: async (imageBase64, options = {}) => {
    const { data } = await wardrobeAPI.addClothing(imageBase64, options);
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

  updateClothing: async (id, updates) => {
    const { data } = await wardrobeAPI.updateClothing(id, updates);
    set((state) => ({
      clothes: state.clothes.map((c) => (c.id === id ? { ...c, ...data.clothing } : c)),
    }));
    return data;
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

  addOutfitItem: (clothing) => {
    set((state) => {
      if (!state.currentOutfit) return state;
      const items = [...(state.currentOutfit.items || [])];
      items.push({
        clothing_id: clothing.id,
        clothing,
        reason: 'Senin eklediğin',
      });
      return { currentOutfit: { ...state.currentOutfit, items } };
    });
  },

  updateOutfitItems: (index, newItem) => {
    set((state) => {
      if (!state.currentOutfit?.items) return state;
      const items = [...state.currentOutfit.items];
      items[index] = { ...items[index], ...newItem };
      return { currentOutfit: { ...state.currentOutfit, items } };
    });
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
  weatherError: null,

  fetchWeather: async (city) => {
    try {
      set({ weatherError: null });
      const { data } = await weatherAPI.get(city);
      set({ weather: data.weather, clothingAdvice: data.clothing_advice });
    } catch (err) {
      console.error('fetchWeather failed:', err);
      set({ weatherError: err.message });
    }
  },
}));
