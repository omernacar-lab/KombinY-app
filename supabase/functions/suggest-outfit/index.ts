import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUser, getServiceClient } from '../_shared/supabase.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY')!;

// ==================== WEATHER SERVICE ====================

async function getWeather(city = 'Istanbul') {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},TR&units=metric&lang=tr&appid=${WEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Hava durumu alınamadı');

  const data = await response.json();
  const conditionMap: Record<string, string> = {
    Clear: 'gunesli', Clouds: 'bulutlu', Rain: 'yagmurlu',
    Drizzle: 'ciseleme', Thunderstorm: 'firtinali', Snow: 'karli',
    Mist: 'sisli', Fog: 'sisli', Haze: 'puslu',
  };

  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    wind_speed: data.wind.speed,
    condition: conditionMap[data.weather[0].main] || 'normal',
  };
}

// ==================== PREFERENCE SERVICE ====================

async function getUserPreferenceProfile(serviceClient: any, userId: string) {
  const { data: preferences } = await serviceClient
    .from('user_preferences')
    .select('preference_type, preference_key, score, interaction_count')
    .eq('user_id', userId)
    .gte('interaction_count', 2) // En az 2 etkileşim olan tercihleri al
    .order('score', { ascending: false });

  if (!preferences || preferences.length === 0) return null;

  // Tercihleri anlamlı metin haline getir
  const liked: string[] = [];
  const disliked: string[] = [];

  const typeLabels: Record<string, string> = {
    color: 'renk', category: 'kategori', subcategory: 'tür',
    style: 'stil', color_combo: 'renk kombinasyonu',
  };

  for (const pref of preferences) {
    const label = typeLabels[pref.preference_type] || pref.preference_type;
    if (pref.score >= 0.65) {
      liked.push(`${pref.preference_key} (${label})`);
    } else if (pref.score <= 0.35) {
      disliked.push(`${pref.preference_key} (${label})`);
    }
  }

  if (liked.length === 0 && disliked.length === 0) return null;

  return { liked, disliked };
}

// ==================== AI SERVICE ====================

async function generateOutfitSuggestion({
  clothes, weather, occasion, recentlyWorn, userPreferences, avoidColors,
}: any) {
  // UUID yerine basit numara kullan — GPT numaraları çok daha güvenilir döndürür
  const availableClothes = clothes
    .filter((c: any) => c.status === 'temiz' && !c.is_archived);

  // Numara → gerçek kıyafet map'i
  const idMap = new Map<number, any>();
  const numberedClothes = availableClothes.map((c: any, index: number) => {
    const num = index + 1;
    idMap.set(num, c);
    return {
      no: num,
      name: c.name,
      category: c.category,
      subcategory: c.subcategory,
      color: c.color,
      secondary_color: c.secondary_color,
      pattern: c.pattern,
      warmth_level: c.warmth_level,
      formality_level: c.formality_level,
      occasion: c.occasion,
      season: c.season,
      style_tags: c.ai_tags,
    };
  });

  // Son giyilenlerin numaralarını bul
  const recentRealIds = new Set(recentlyWorn.map((w: any) => w.clothing_id));
  const recentNos = availableClothes
    .map((c: any, i: number) => recentRealIds.has(c.id) ? i + 1 : null)
    .filter(Boolean);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sen Türkiye'de yaşayan bir kullanıcının kişisel moda asistanısın.
Kullanıcının gardırobundaki TEMİZ kıyafetlerden uygun bir kombin öner.

ÖNEMLİ KURALLAR:
1. Her kıyafetin bir "no" numarası var. Seçimlerinde SADECE bu numaraları kullan.
2. Aynı numarayı birden fazla KULLANMA — her parça farklı olmalı.
3. Sadece verilenler arasından seç, olmayan kıyafet önerme.
4. Renk uyumu önemli — zıt veya tamamlayıcı renkler kullan.
5. Mevsim ve hava durumuna uygun seç.
6. Ortama (occasion) uygunluk önemli.
7. Son günlerde giyilen kıyafetleri TEKRAR ÖNERME (numaraları verilecek).
8. Formality seviyeleri birbiriyle uyumlu olmalı.
9. Kombin mantığı: üst giyim + alt giyim (veya elbise) + ayakkabı + opsiyonel dış giyim + opsiyonel aksesuar.
10. Her kategoriden EN FAZLA 1 parça seç (2 üst giyim veya 2 alt giyim OLMAZ).
11. KULLANICI TERCİHLERİ verilmişse ÇOK ÖNEMLİ: sevdiği şeyleri ÖNCEL, sevmediği şeylerden KAÇIN. Bu veriler kullanıcının geçmiş beğeni/beğenmeme geçmişinden öğrenilmiştir.

JSON formatında döndür:
{
  "items": [{"no": 3, "reason": "neden seçildi"}],
  "styling_tip": "Kombin hakkında kısa Türkçe stil önerisi",
  "confidence": 0.85,
  "alternative_swap": {"no": 5, "reason": "neden değiştirilebilir"}
}

Sadece JSON döndür, başka metin ekleme.`,
        },
        {
          role: 'user',
          content: `GARDIROB:
${JSON.stringify(numberedClothes, null, 1)}

HAVA DURUMU: ${weather ? `${weather.temp}°C, ${weather.description}` : 'Bilinmiyor'}
ORTAM: ${occasion || 'gunluk'}
SON GİYİLENLER (bu numaraları önerme): ${JSON.stringify(recentNos)}
${userPreferences ? `
KULLANICI SEVDİĞİ: ${userPreferences.liked.length > 0 ? userPreferences.liked.join(', ') : 'Henüz yeterli veri yok'}
KULLANICI SEVMEDİĞİ: ${userPreferences.disliked.length > 0 ? userPreferences.disliked.join(', ') : 'Henüz yeterli veri yok'}` : ''}
${avoidColors ? `KAÇINILACAK RENKLER: ${avoidColors.join(', ')}` : ''}

Bu bilgilere göre harika bir kombin öner!`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data?.error) || 'OpenAI API hatası';
    throw new Error(`AI servisi hatası: ${errMsg}`);
  }

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('AI yanıtı boş döndü');
  }

  const content = data.choices[0].message.content;
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI yanıtı geçerli JSON değil');
  }

  // Numaraları gerçek clothing_id'lere çevir + tekrar eden ve geçersiz numaraları filtrele
  const usedIds = new Set<string>();
  const mappedItems = [];

  for (const item of parsed.items) {
    const clothing = idMap.get(item.no);
    if (clothing && !usedIds.has(clothing.id)) {
      usedIds.add(clothing.id);
      mappedItems.push({
        clothing_id: clothing.id,
        reason: item.reason,
      });
    }
  }

  // alternative_swap'ı da map'le
  let alternativeSwap = null;
  if (parsed.alternative_swap?.no) {
    const altClothing = idMap.get(parsed.alternative_swap.no);
    if (altClothing) {
      alternativeSwap = {
        clothing_id: altClothing.id,
        reason: parsed.alternative_swap.reason,
      };
    }
  }

  return {
    items: mappedItems,
    styling_tip: parsed.styling_tip,
    confidence: parsed.confidence,
    alternative_swap: alternativeSwap,
  };
}

// ==================== MEVSIM YARDIMCI ====================

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'ilkbahar';
  if (month >= 6 && month <= 8) return 'yaz';
  if (month >= 9 && month <= 11) return 'sonbahar';
  return 'kis';
}

// ==================== MAIN HANDLER ====================

// GELEN HEADER LOGU
Deno.serve(async (req) => {
  console.log('GELEN HEADER:', Object.fromEntries(req.headers.entries()));
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await getUser(req);
    const serviceClient = getServiceClient();

    const body = await req.json();
    const { occasion, city } = body;

    // Freemium kontrol
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_premium, daily_outfit_count, last_outfit_date, city')
      .eq('id', user.id)
      .single();

    if (!profile?.is_premium) {
      const today = new Date().toISOString().split('T')[0];
      if (profile?.last_outfit_date === today && profile?.daily_outfit_count >= 10) {
        return new Response(
          JSON.stringify({
            error: 'Günlük ücretsiz kombin hakkınız doldu',
            upgrade: true,
            message: "Premium'a geçerek sınırsız kombin önerisi alın!",
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Kullanıcının temiz kıyafetlerini al
    const { data: clothes, error: clothesError } = await serviceClient
      .from('clothes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false);

    if (clothesError) throw clothesError;

    if (!clothes || clothes.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Kombin önerisi için en az 3 kıyafet gerekli', current: clothes?.length || 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Son 7 günde giyilenler
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: recentlyWorn } = await serviceClient
      .from('wear_history')
      .select('clothing_id')
      .eq('user_id', user.id)
      .gte('worn_date', weekAgo.toISOString().split('T')[0]);

    // Hava durumu
    let weather = null;
    try {
      weather = await getWeather(city || profile?.city || 'Istanbul');
    } catch (err) {
      console.error('Weather fetch failed:', err.message);
    }

    // Kullanıcı tercihleri
    const userPreferences = await getUserPreferenceProfile(serviceClient, user.id);

    // AI kombin önerisi
    const suggestion = await generateOutfitSuggestion({
      clothes,
      weather,
      occasion: occasion || 'gunluk',
      recentlyWorn: recentlyWorn || [],
      userPreferences,
    });

    // Kombin'i kaydet
    const { data: outfit, error: outfitError } = await serviceClient
      .from('outfits')
      .insert({
        user_id: user.id,
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
      const outfitItems = suggestion.items.map((item: any, index: number) => ({
        outfit_id: outfit.id,
        clothing_id: item.clothing_id,
        layer_order: index,
      }));
      await serviceClient.from('outfit_items').insert(outfitItems);
    }

    // Günlük sayacı güncelle
    const today = new Date().toISOString().split('T')[0];
    await serviceClient
      .from('profiles')
      .update({
        daily_outfit_count: profile?.last_outfit_date === today
          ? (profile?.daily_outfit_count || 0) + 1
          : 1,
        last_outfit_date: today,
      })
      .eq('id', user.id);

    // Kıyafet detaylarını ekle
    const clothingDetails = suggestion.items.map((item: any) => {
      const clothing = clothes.find((c: any) => c.id === item.clothing_id);
      return { ...item, clothing };
    });

    return new Response(
      JSON.stringify({
        outfit_id: outfit.id,
        items: clothingDetails,
        styling_tip: suggestion.styling_tip,
        confidence: suggestion.confidence,
        alternative_swap: suggestion.alternative_swap,
        weather,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('suggest-outfit error:', err.message, err.stack);
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
