const express = require('express');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { generateOutfitSuggestion } = require('../services/aiService');
const { getWeather, getClothingAdvice } = require('../services/weatherService');
const { processOutfitFeedback, getUserPreferenceProfile } = require('../services/preferenceService');
const { validate, outfitSuggestSchema, outfitFeedbackSchema } = require('../middleware/validate');

const router = express.Router();

// ==================== KOMBİN ÖNERİSİ AL ====================
router.post('/suggest', authenticate, validate(outfitSuggestSchema), async (req, res, next) => {
  try {
    const { occasion, city } = req.body;

    // Freemium kontrol
    if (!req.user.is_premium) {
      const today = new Date().toISOString().split('T')[0];

      const { data: user } = await supabase
        .from('users')
        .select('daily_outfit_count, last_outfit_date')
        .eq('id', req.user.id)
        .single();

      if (user.last_outfit_date === today && user.daily_outfit_count >= 1) {
        return res.status(403).json({
          error: 'Günlük ücretsiz kombin hakkınız doldu',
          upgrade: true,
          message: 'Premium\'a geçerek sınırsız kombin önerisi alın!',
        });
      }
    }

    // Kullanıcının temiz kıyafetlerini al
    const { data: clothes, error: clothesError } = await supabase
      .from('clothes')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_archived', false);

    if (clothesError) throw clothesError;

    if (!clothes || clothes.length < 3) {
      return res.status(400).json({
        error: 'Kombin önerisi için en az 3 kıyafet gerekli',
        current: clothes?.length || 0,
      });
    }

    // Son 7 günde giyilenleri al
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: recentlyWorn } = await supabase
      .from('wear_history')
      .select('clothing_id')
      .eq('user_id', req.user.id)
      .gte('worn_date', weekAgo.toISOString().split('T')[0]);

    // Hava durumu
    let weather = null;
    try {
      weather = await getWeather(city || req.user.city || 'Istanbul');
    } catch (err) {
      console.error('Weather fetch failed:', err.message);
    }

    // Kullanıcı tercihleri
    const userPreferences = await getUserPreferenceProfile(req.user.id);

    // AI kombin önerisi
    const suggestion = await generateOutfitSuggestion({
      clothes,
      weather,
      occasion: occasion || 'gunluk',
      recentlyWorn: recentlyWorn || [],
      userPreferences,
    });

    // Kombin'i kaydet
    const { data: outfit, error: outfitError } = await supabase
      .from('outfits')
      .insert({
        user_id: req.user.id,
        occasion: occasion || 'gunluk',
        season: getCurrentSeason(),
        weather_temp: weather?.temp,
        weather_condition: weather?.condition,
        is_ai_generated: true,
      })
      .select()
      .single();

    if (outfitError) throw outfitError;

    // Kombin kıyafetlerini kaydet
    if (suggestion.items && suggestion.items.length > 0) {
      const outfitItems = suggestion.items.map((item, index) => ({
        outfit_id: outfit.id,
        clothing_id: item.clothing_id,
        layer_order: index,
      }));

      await supabase.from('outfit_items').insert(outfitItems);
    }

    // Günlük sayacı güncelle
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('users')
      .update({
        daily_outfit_count: req.user.last_outfit_date === today
          ? (req.user.daily_outfit_count || 0) + 1
          : 1,
        last_outfit_date: today,
      })
      .eq('id', req.user.id);

    // Kıyafet detaylarını ekle
    const clothingDetails = suggestion.items.map((item) => {
      const clothing = clothes.find((c) => c.id === item.clothing_id);
      return { ...item, clothing };
    });

    res.json({
      outfit_id: outfit.id,
      items: clothingDetails,
      styling_tip: suggestion.styling_tip,
      confidence: suggestion.confidence,
      alternative_swap: suggestion.alternative_swap,
      weather,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== KOMBİN BEĞEN/BEĞENME ====================
router.post('/:id/feedback', authenticate, validate(outfitFeedbackSchema), async (req, res, next) => {
  try {
    const { liked, rating } = req.body;

    const updates = {};
    if (liked !== undefined) updates.is_liked = liked;
    if (rating !== undefined) updates.user_rating = rating;

    const { data, error } = await supabase
      .from('outfits')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Kombin bulunamadı' });

    // AI öğrenme: tercihleri güncelle
    if (liked !== undefined) {
      await processOutfitFeedback(req.user.id, req.params.id, liked);
    }

    res.json({ outfit: data, message: liked ? 'Beğeni kaydedildi! 👍' : 'Tercih kaydedildi 👎' });
  } catch (err) {
    next(err);
  }
});

// ==================== KOMBİNİ GİY (WEAR) ====================
router.post('/:id/wear', authenticate, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Kombin'i giyildi olarak işaretle
    const { error: outfitError } = await supabase
      .from('outfits')
      .update({ is_worn: true, worn_date: today })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (outfitError) throw outfitError;

    // Kıyafetleri al
    const { data: items } = await supabase
      .from('outfit_items')
      .select('clothing_id')
      .eq('outfit_id', req.params.id);

    if (items && items.length > 0) {
      const clothingIds = items.map((i) => i.clothing_id);

      // Her kıyafet için giyim kaydı
      const historyRecords = clothingIds.map((cid) => ({
        user_id: req.user.id,
        clothing_id: cid,
        outfit_id: req.params.id,
        worn_date: today,
      }));

      await supabase.from('wear_history').insert(historyRecords);

      // Kıyafetlerin giyim sayısını ve son giyim tarihini güncelle
      for (const cid of clothingIds) {
        await supabase.rpc('increment_wear_count', {
          cloth_id: cid,
          wear_date: today,
        });
      }
    }

    res.json({ message: 'Kombin giyildi olarak işaretlendi! 👗' });
  } catch (err) {
    next(err);
  }
});

// ==================== KOMBİN GEÇMİŞİ ====================
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

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
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({ outfits: data });
  } catch (err) {
    next(err);
  }
});

// Mevsim yardımcı fonksiyonu
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'ilkbahar';
  if (month >= 6 && month <= 8) return 'yaz';
  if (month >= 9 && month <= 11) return 'sonbahar';
  return 'kis';
}

module.exports = router;
