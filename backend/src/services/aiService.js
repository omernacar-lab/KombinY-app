const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Kıyafet fotoğrafını analiz eder ve özelliklerini çıkarır.
 * OpenAI Vision API kullanır.
 */
async function analyzeClothing(imageBase64) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Sen bir moda uzmanı ve kıyafet analiz asistanısın. 
Verilen kıyafet fotoğrafını analiz et ve aşağıdaki bilgileri JSON formatında döndür:
- category: (ust_giyim, alt_giyim, dis_giyim, elbise, ayakkabi, aksesuar, canta, ic_giyim)
- subcategory: (tshirt, gomlek, bluz, kazak, hirka, mont, ceket, pantolon, jean, etek, sort, elbise, sneaker, topuklu, bot, vb.)
- color: Ana renk (turkce)
- secondary_color: İkincil renk varsa (turkce)
- pattern: (duz, cizgili, kareli, cicekli, puantiyeli, desenli, kamuflaj, diger)
- fabric: Tahmini kumaş türü
- season: Uygun mevsimler dizisi ["ilkbahar", "yaz", "sonbahar", "kis"]
- occasion: Uygun ortamlar dizisi ["gunluk", "is", "ozel", "spor", "gece"]
- warmth_level: 1-5 arası sıcaklık seviyesi (1=çok ince, 5=çok kalın)
- formality_level: 1-5 arası (1=çok casual, 5=çok resmi)
- style_tags: Stil etiketleri dizisi (minimal, boho, klasik, sportif, vb.)
- suggested_name: Kıyafet için önerilen kısa isim (Türkçe)

Sadece JSON döndür, başka metin ekleme.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: 'Bu kıyafeti analiz et.',
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  // JSON parse - markdown code block varsa temizle
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Kombin önerisi üretir.
 */
async function generateOutfitSuggestion({
  clothes,
  weather,
  occasion,
  recentlyWorn,
  userPreferences,
  avoidColors,
}) {
  const availableClothes = clothes
    .filter((c) => c.status === 'temiz' && !c.is_archived)
    .map((c) => ({
      id: c.id,
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
      last_worn_date: c.last_worn_date,
      times_worn: c.times_worn,
    }));

  const recentIds = recentlyWorn.map((w) => w.clothing_id);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Sen Türkiye'de yaşayan bir kullanıcının kişisel moda asistanısın.
Kullanıcının gardırobundaki TEMİZ kıyafetlerden uygun bir kombin öner.

KURALLAR:
1. Sadece verilenler arasından seç, olmayan kıyafet önerme
2. Renk uyumu önemli - zıt veya tamamlayıcı renkler kullan
3. Mevsim ve hava durumuna uygun seç
4. Ortama (occasion) uygunluk önemli
5. Son günlerde giyilen kıyafetleri TEKRAR ÖNERME (ID'leri verilecek)
6. Formality seviyeleri birbiriyle uyumlu olmalı
7. Kombin mantığı: üst + alt (veya elbise) + ayakkabı + opsiyonel dış giyim + opsiyonel aksesuar

JSON formatında döndür:
{
  "items": [{"clothing_id": "uuid", "reason": "neden seçildi"}],
  "styling_tip": "Kombin hakkında kısa Türkçe stil önerisi",
  "confidence": 0.85,
  "alternative_swap": {"clothing_id": "değiştirilebilecek parça id", "reason": "neden değiştirilebilir"}
}

Sadece JSON döndür.`,
      },
      {
        role: 'user',
        content: `GARDIROB: ${JSON.stringify(availableClothes)}

HAVA DURUMU: ${weather ? `${weather.temp}°C, ${weather.description}` : 'Bilinmiyor'}
ORTAM: ${occasion || 'gunluk'}
SON GİYİLENLER (bunları önerme): ${JSON.stringify(recentIds)}
KULLANICI TERCİHLERİ: ${JSON.stringify(userPreferences || {})}
${avoidColors ? `KAÇINILACAK RENKLER: ${avoidColors.join(', ')}` : ''}

Bu bilgilere göre harika bir kombin öner!`,
      },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Bir frame'deki TÜM kıyafetleri tespit eder (video tarama için).
 * Birden fazla kıyafet döndürebilir.
 */
async function analyzeFrameForClothingItems(imageBase64) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Sen bir moda uzmanısın. Bu fotoğraf bir gardıroba/dolaba/rafa bakış gösteriyor.
Görüntüde AYRI AYRI her bir kıyafet parçasını tespit et.

HER bir kıyafet için aşağıdaki bilgileri çıkart. Birden fazla kıyafet varsa JSON DİZİSİ olarak döndür.
Eğer hiç kıyafet göremiyorsan boş dizi [] döndür.

Her bir eleman:
- fingerprint: "kategori-altkategori-renk-desen" (küçük harf, boşluksuz, türkçe karakter olmadan, örn: "ust_giyim-tshirt-mavi-duz")
- category: (ust_giyim, alt_giyim, dis_giyim, elbise, ayakkabi, aksesuar, canta, ic_giyim)
- subcategory: (tshirt, gomlek, bluz, kazak, hirka, mont, ceket, pantolon, jean, etek, sort, elbise, sneaker, topuklu, bot, vb.)
- color: Ana renk (türkçe)
- secondary_color: İkincil renk varsa (türkçe), yoksa null
- pattern: (duz, cizgili, kareli, cicekli, puantiyeli, desenli, kamuflaj, diger)
- fabric: Tahmini kumaş türü
- season: Uygun mevsimler dizisi ["ilkbahar", "yaz", "sonbahar", "kis"]
- occasion: Uygun ortamlar dizisi ["gunluk", "is", "ozel", "spor", "gece"]
- warmth_level: 1-5 (1=çok ince, 5=çok kalın)
- formality_level: 1-5 (1=casual, 5=resmi)
- style_tags: Stil etiketleri dizisi
- suggested_name: Kısa isim (Türkçe, örn: "Mavi Çizgili Gömlek")
- position_hint: Kıyafetin görüntüdeki konumu (örn: "sol üstte katlanmış", "ortada askıda", "alt rafta")

Sadece JSON dizisi döndür, başka metin ekleme.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: 'Bu görüntüdeki tüm kıyafetleri tespit et.',
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const items = JSON.parse(cleaned);
  return Array.isArray(items) ? items : [items];
}

/**
 * Tespit edilen kıyafetleri fingerprint'e göre tekilleştirir.
 */
function deduplicateDetectedItems(allItems) {
  const seen = new Map();

  for (const item of allItems) {
    const fp = (item.fingerprint || '').toLowerCase().trim();
    if (!fp) continue;
    if (!seen.has(fp)) {
      seen.set(fp, item);
    }
  }

  return Array.from(seen.values());
}

module.exports = {
  analyzeClothing,
  generateOutfitSuggestion,
  analyzeFrameForClothingItems,
  deduplicateDetectedItems,
};
