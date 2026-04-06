import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUser, getServiceClient } from '../_shared/supabase.ts';

// ==================== PREFERENCE SERVICE ====================

async function updatePreference(
  serviceClient: any, userId: string, type: string, key: string, liked: boolean
) {
  const scoreChange = liked ? 0.1 : -0.1;

  const { data: existing } = await serviceClient
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('preference_type', type)
    .eq('preference_key', key)
    .single();

  if (existing) {
    const newScore = Math.max(0, Math.min(1, existing.score + scoreChange));
    await serviceClient
      .from('user_preferences')
      .update({
        score: newScore,
        interaction_count: existing.interaction_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await serviceClient.from('user_preferences').insert({
      user_id: userId,
      preference_type: type,
      preference_key: key,
      score: 0.5 + scoreChange,
      interaction_count: 1,
    });
  }
}

async function processOutfitFeedback(
  serviceClient: any, userId: string, outfitId: string, liked: boolean
) {
  // Kombin'deki kıyafetleri al
  const { data: items } = await serviceClient
    .from('outfit_items')
    .select('clothing_id, clothes(category, color, subcategory, ai_tags)')
    .eq('outfit_id', outfitId);

  if (!items || items.length === 0) return;

  // Her kıyafet için tercihleri güncelle
  for (const item of items) {
    const clothing = item.clothes;
    if (!clothing) continue;

    await updatePreference(serviceClient, userId, 'color', clothing.color, liked);
    await updatePreference(serviceClient, userId, 'category', clothing.category, liked);

    if (clothing.subcategory) {
      await updatePreference(serviceClient, userId, 'subcategory', clothing.subcategory, liked);
    }

    if (clothing.ai_tags && Array.isArray(clothing.ai_tags)) {
      for (const tag of clothing.ai_tags) {
        await updatePreference(serviceClient, userId, 'style', tag, liked);
      }
    }
  }

  // Renk kombinasyonu tercihi
  const colors = items
    .map((i: any) => i.clothes?.color)
    .filter(Boolean)
    .sort()
    .join('+');

  if (colors) {
    await updatePreference(serviceClient, userId, 'color_combo', colors, liked);
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await getUser(req);
    const serviceClient = getServiceClient();

    const url = new URL(req.url);
    const body = await req.json();
    const { outfitId, liked, rating } = body;

    if (!outfitId) {
      return new Response(
        JSON.stringify({ error: 'outfitId gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kombin'i güncelle
    const updates: any = {};
    if (liked !== undefined) updates.is_liked = liked;
    if (rating !== undefined) updates.user_rating = rating;

    const { data, error } = await serviceClient
      .from('outfits')
      .update(updates)
      .eq('id', outfitId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Kombin bulunamadı' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AI öğrenme: tercihleri güncelle
    if (liked !== undefined) {
      await processOutfitFeedback(serviceClient, user.id, outfitId, liked);
    }

    return new Response(
      JSON.stringify({
        outfit: data,
        message: liked ? 'Beğeni kaydedildi! 👍' : 'Tercih kaydedildi 👎',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
