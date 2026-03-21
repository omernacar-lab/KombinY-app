const supabase = require('../config/supabase');

/**
 * Kullanıcı tercihlerini günceller (beğen/beğenme feedback loop).
 */
async function updatePreference(userId, type, key, liked) {
  const scoreChange = liked ? 0.1 : -0.1;

  const { data: existing } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('preference_type', type)
    .eq('preference_key', key)
    .single();

  if (existing) {
    const newScore = Math.max(0, Math.min(1, existing.score + scoreChange));
    await supabase
      .from('user_preferences')
      .update({
        score: newScore,
        interaction_count: existing.interaction_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_preferences').insert({
      user_id: userId,
      preference_type: type,
      preference_key: key,
      score: 0.5 + scoreChange,
      interaction_count: 1,
    });
  }
}

/**
 * Kombin beğenildiğinde/beğenilmediğinde tercihleri günceller.
 */
async function processOutfitFeedback(userId, outfitId, liked) {
  // Kombin'deki kıyafetleri al
  const { data: items } = await supabase
    .from('outfit_items')
    .select('clothing_id, clothes(category, color, subcategory, ai_tags)')
    .eq('outfit_id', outfitId);

  if (!items || items.length === 0) return;

  // Her kıyafet için tercihleri güncelle
  for (const item of items) {
    const clothing = item.clothes;
    if (!clothing) continue;

    // Renk tercihi
    await updatePreference(userId, 'color', clothing.color, liked);

    // Kategori tercihi
    await updatePreference(userId, 'category', clothing.category, liked);

    // Alt kategori tercihi
    if (clothing.subcategory) {
      await updatePreference(userId, 'subcategory', clothing.subcategory, liked);
    }

    // Stil etiketleri tercihi
    if (clothing.ai_tags && Array.isArray(clothing.ai_tags)) {
      for (const tag of clothing.ai_tags) {
        await updatePreference(userId, 'style', tag, liked);
      }
    }
  }

  // Renk kombinasyonu tercihi
  const colors = items
    .map((i) => i.clothes?.color)
    .filter(Boolean)
    .sort()
    .join('+');
  if (colors) {
    await updatePreference(userId, 'color_combo', colors, liked);
  }
}

/**
 * Kullanıcının tercih profilini getirir.
 */
async function getUserPreferenceProfile(userId) {
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('preference_type, preference_key, score, interaction_count')
    .eq('user_id', userId)
    .order('score', { ascending: false });

  if (!preferences) return {};

  const profile = {};
  for (const pref of preferences) {
    if (!profile[pref.preference_type]) {
      profile[pref.preference_type] = [];
    }
    profile[pref.preference_type].push({
      key: pref.preference_key,
      score: pref.score,
      count: pref.interaction_count,
    });
  }

  return profile;
}

module.exports = {
  processOutfitFeedback,
  getUserPreferenceProfile,
};
