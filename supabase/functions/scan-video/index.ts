import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const FRAME_ANALYSIS_PROMPT = `Sen bir moda uzmanısın. Bu fotoğraf bir gardıroba/dolaba/rafa bakış gösteriyor.
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

Sadece JSON dizisi döndür, başka metin ekleme.`;

async function analyzeFrame(imageBase64: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FRAME_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: 'Bu görüntüdeki tüm kıyafetleri tespit et.' },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const items = JSON.parse(cleaned);
  return Array.isArray(items) ? items : [items];
}

function deduplicateDetectedItems(allItems: any[]) {
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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await getUser(req); // auth check

    const body = await req.json();
    const { frames } = body; // Array of base64 strings

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response(
        JSON.stringify({ error: 'En az bir frame (base64) gerekli' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Frame'leri 3'erli batch halinde analiz et
    const concurrency = 3;
    const allItems: any[] = [];

    for (let i = 0; i < frames.length; i += concurrency) {
      const batch = frames.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((base64: string) => analyzeFrame(base64))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allItems.push(...result.value);
        }
      }
    }

    const totalBeforeDedup = allItems.length;
    const uniqueItems = deduplicateDetectedItems(allItems);

    return new Response(
      JSON.stringify({
        detected_items: uniqueItems,
        frame_count: frames.length,
        total_before_dedup: totalBeforeDedup,
        total_after_dedup: uniqueItems.length,
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
