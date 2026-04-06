import { supabase } from './supabase';

// ==================== EDGE FUNCTION HELPER ====================

async function callEdgeFunction(functionName, { method = 'POST', body, params } = {}) {
  // supabase.functions.invoke kullan — ES256 token'ları doğru şekilde yönetir
  // Raw fetch + apikey ile Supabase gateway HS256 bekliyor ama auth ES256 üretiyor → 401

  // GET isteklerinde query params ekle
  let fnName = functionName;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fnName = `${functionName}?${qs}`;
  }

  const options = { method };

  if (body && method !== 'GET') {
    options.body = body;
  }

  const { data, error, response } = await supabase.functions.invoke(fnName, options);

  if (error) {
    // FunctionsHttpError durumunda response body'den detaylı hata al
    let errorData = null;
    let errorMessage = error.message || 'Bir hata oluştu';
    let status = 500;

    // error.context Response objesi olabilir (FunctionsHttpError)
    const errResponse = response || error.context;
    if (errResponse) {
      status = errResponse.status || 500;
      try {
        const text = await errResponse.text();
        // debug log removed
        try {
          errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
      } catch (e) {
        // silent
      }
    } else {
      // silent
    }

    const wrappedError = new Error(errorMessage);
    wrappedError.status = status;
    wrappedError.data = errorData;
    throw wrappedError;
  }

  return { data };
}

// ==================== AUTH ====================
// Auth artık doğrudan Supabase Auth ile yapılıyor (supabase.js)
export const authAPI = {
  register: async ({ email, password, fullName, gender, birthYear, city }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    // Profil bilgilerini güncelle
    if (data.user && (gender || birthYear || city)) {
      await supabase.from('profiles').update({
        gender: gender || null,
        birth_year: birthYear || null,
        city: city || 'Istanbul',
      }).eq('id', data.user.id);
    }

    return { data };
  },

  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getMe: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, gender, birth_year, city, style_preferences, is_premium')
      .eq('id', user.id)
      .single();

    return { data: { user: profile } };
  },
};

// ==================== GARDIROB ====================
export const wardrobeAPI = {
  getClothes: async (params = {}) => {
    let query = supabase
      .from('clothes')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (params.category) query = query.eq('category', params.category);
    if (params.status) query = query.eq('status', params.status);
    if (params.season) query = query.contains('season', [params.season]);
    if (params.occasion) query = query.contains('occasion', [params.occasion]);

    const { data, error } = await query;
    if (error) throw error;
    return { data: { clothes: data, total: data.length } };
  },

  getGrouped: async () => {
    const { data, error } = await supabase
      .from('clothes')
      .select('*')
      .eq('is_archived', false)
      .order('category')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const grouped = {};
    for (const item of data) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    return { data: { grouped, total: data.length } };
  },

  getStats: async () => {
    const { data: clothes, error } = await supabase
      .from('clothes')
      .select('category, color, status, times_worn, is_favorite')
      .eq('is_archived', false);

    if (error) throw error;

    const stats = {
      total: clothes.length,
      by_category: {},
      by_color: {},
      by_status: {},
      favorites: clothes.filter((c) => c.is_favorite).length,
      never_worn: clothes.filter((c) => c.times_worn === 0).length,
      most_worn: [...clothes].sort((a, b) => b.times_worn - a.times_worn).slice(0, 5),
    };

    for (const c of clothes) {
      stats.by_category[c.category] = (stats.by_category[c.category] || 0) + 1;
      stats.by_color[c.color] = (stats.by_color[c.color] || 0) + 1;
      stats.by_status[c.status] = (stats.by_status[c.status] || 0) + 1;
    }

    return { data: { stats } };
  },

  // Edge Function — AI analiz + storage upload + DB insert
  addClothing: async (imageBase64, { name, brand, category } = {}) => {
    return callEdgeFunction('analyze-clothing', {
      body: { imageBase64, name, brand, category },
    });
  },

  updateClothing: async (id, updates) => {
    const allowedFields = [
      'name', 'category', 'subcategory', 'color', 'secondary_color',
      'pattern', 'season', 'occasion', 'fabric', 'brand', 'status',
      'warmth_level', 'formality_level', 'is_favorite', 'is_archived',
    ];

    const safeUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field];
    }
    safeUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('clothes')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data: { clothing: data } };
  },

  updateStatus: async (id, status) => {
    const { data, error } = await supabase
      .from('clothes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data: { clothing: data } };
  },

  bulkUpdateStatus: async (ids, status) => {
    const { data, error } = await supabase
      .from('clothes')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select();

    if (error) throw error;
    return { data: { updated: data.length, clothes: data } };
  },

  deleteClothing: async (id) => {
    const { error } = await supabase
      .from('clothes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { data: { message: 'Kıyafet silindi' } };
  },

  uploadPhoto: async (id, imageBase64) => {
    const { data: { user } } = await supabase.auth.getUser();
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const imagePath = `${user.id}/${fileId}.jpg`;
    const thumbPath = `${user.id}/${fileId}_thumb.jpg`;

    // Base64 → ArrayBuffer
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Storage'a yükle
    const [imageUpload] = await Promise.all([
      supabase.storage.from('clothes-images').upload(imagePath, bytes, { contentType: 'image/jpeg' }),
      supabase.storage.from('clothes-images').upload(thumbPath, bytes, { contentType: 'image/jpeg' }),
    ]);

    if (imageUpload.error) throw imageUpload.error;

    const { data: imageUrlData } = supabase.storage.from('clothes-images').getPublicUrl(imagePath);
    const { data: thumbUrlData } = supabase.storage.from('clothes-images').getPublicUrl(thumbPath);

    const { data, error } = await supabase
      .from('clothes')
      .update({
        image_url: imageUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data: { clothing: data } };
  },

  // Edge Function — multi-frame AI analiz
  scanVideo: async (framesBase64) => {
    return callEdgeFunction('scan-video', {
      body: { frames: framesBase64 },
    });
  },

  bulkAddClothing: async (items) => {
    const VALID_PATTERNS = ['duz', 'cizgili', 'kareli', 'cicekli', 'puantiyeli', 'desenli', 'kamuflaj', 'diger'];
    const VALID_CATEGORIES = ['ust_giyim', 'alt_giyim', 'dis_giyim', 'elbise', 'ayakkabi', 'aksesuar', 'canta', 'ic_giyim'];

    const { data: { user } } = await supabase.auth.getUser();

    const clothingData = items.map((item) => ({
      user_id: user.id,
      name: item.suggested_name || item.name || 'Kıyafet',
      category: VALID_CATEGORIES.includes(item.category) ? item.category : 'ust_giyim',
      subcategory: item.subcategory,
      color: item.color,
      secondary_color: item.secondary_color || null,
      pattern: VALID_PATTERNS.includes(item.pattern) ? item.pattern : 'duz',
      season: item.season || ['ilkbahar', 'yaz', 'sonbahar', 'kis'],
      occasion: item.occasion || ['gunluk'],
      fabric: item.fabric || null,
      ai_tags: item.style_tags || [],
      warmth_level: item.warmth_level || 3,
      formality_level: item.formality_level || 3,
      status: 'temiz',
      image_url: '',
      thumbnail_url: '',
    }));

    const { data, error } = await supabase
      .from('clothes')
      .insert(clothingData)
      .select();

    if (error) throw error;
    return { data: { added: data, count: data.length, message: `${data.length} kıyafet gardıroba eklendi!` } };
  },
};

// ==================== KOMBİN ====================
export const outfitAPI = {
  // Edge Function — AI + Weather + Preferences
  suggest: async (data) => {
    return callEdgeFunction('suggest-outfit', { body: data });
  },

  // Edge Function — preference learning
  feedback: async (id, data) => {
    return callEdgeFunction('outfit-feedback', {
      body: { outfitId: id, ...data },
    });
  },

  wear: async (id) => {
    const today = new Date().toISOString().split('T')[0];

    // Kombin'i giyildi olarak işaretle
    await supabase
      .from('outfits')
      .update({ is_worn: true, worn_date: today })
      .eq('id', id);

    // Kıyafetleri al
    const { data: items } = await supabase
      .from('outfit_items')
      .select('clothing_id')
      .eq('outfit_id', id);

    if (items && items.length > 0) {
      const clothingIds = items.map((i) => i.clothing_id);
      const { data: { user } } = await supabase.auth.getUser();

      // Giyim geçmişi kayıtları
      const historyRecords = clothingIds.map((cid) => ({
        user_id: user.id,
        clothing_id: cid,
        outfit_id: id,
        worn_date: today,
      }));

      await supabase.from('wear_history').insert(historyRecords);

      // Giyim sayacını güncelle (RPC)
      for (const cid of clothingIds) {
        await supabase.rpc('increment_wear_count', {
          cloth_id: cid,
          wear_date: today,
        });
      }
    }

    return { data: { message: 'Kombin giyildi olarak işaretlendi!' } };
  },

  history: async (params = {}) => {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    const { data, error } = await supabase
      .from('outfits')
      .select(`
        *,
        outfit_items(
          clothing_id,
          layer_order,
          clothes(id, name, category, color, thumbnail_url)
        )
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;
    return { data: { outfits: data } };
  },
};

// ==================== HAVA DURUMU ====================
export const weatherAPI = {
  // Edge Function — OpenWeatherMap
  get: async (city) => {
    return callEdgeFunction('weather', {
      method: 'GET',
      params: city ? { city } : undefined,
    });
  },
};

// ==================== KULLANICI ====================
export const userAPI = {
  updateProfile: async (updates) => {
    const allowedFields = ['full_name', 'gender', 'birth_year', 'city', 'style_preferences'];
    const safeUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field];
    }
    safeUpdates.updated_at = new Date().toISOString();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id)
      .select('id, email, full_name, gender, birth_year, city, style_preferences, is_premium')
      .single();

    if (error) throw error;
    return { data: { user: data } };
  },

  addEvent: async ({ title, eventDate, occasion, dressCode, notes }) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        title,
        event_date: eventDate,
        occasion,
        dress_code: dressCode,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return { data: { event: data } };
  },

  getEvents: async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, outfits(*)')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true });

    if (error) throw error;
    return { data: { events: data } };
  },
};
