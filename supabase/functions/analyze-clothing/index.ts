import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUser, getServiceClient } from '../_shared/supabase.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const SYSTEM_PROMPT = `Sen bir moda uzmanı ve kıyafet analiz asistanısın.
Verilen kıyafet fotoğrafını DİKKATLİCE analiz et ve aşağıdaki bilgileri JSON formatında döndür.

KATEGORİ VE ALT KATEGORİ KURALLARI (ÇOK ÖNEMLİ):
- category: (ust_giyim, alt_giyim, dis_giyim, elbise, ayakkabi, aksesuar, canta, ic_giyim)
- subcategory seçenekleri:
  * ust_giyim: tshirt, gomlek, bluz, polo, atlet, crop_top, sweatshirt, hoodie, kazak, hirka, tunik
  * alt_giyim: pantolon, jean, kumasipantolon, esofman_alti, sort, etek, tayt, capri
  * dis_giyim: mont, kaban, parka, trenchkot, yagmurluk, blazer, ceket, deri_ceket, yelek, puf_yelek, denim_ceket, softshell, ruzgarlik, palto, kase_kaban
  * elbise: elbise, tulum, jile
  * ayakkabi: sneaker, topuklu, bot, cizme, sandalet, terlik, loafer, oxford, babet, spor_ayakkabi
  * aksesuar: saat, kolye, bileklik, yuzuk, sapka, bere, atki, sal, kemer, gunes_gozlugu, kravat, papyon, fular
  * canta: el_cantasi, sirt_cantasi, postaci_cantasi, clutch, bel_cantasi
  * ic_giyim: fanila, boxer, corap, termal

KIYAFET TANIMLAMA İPUÇLARI:
- YELEK (kolsuz, gövdeyi kapatan, fermuarlı/düğmeli) → dis_giyim / yelek veya puf_yelek
- MONT (kollu, kalın, kışlık) → dis_giyim / mont
- CEKET (kollu, daha ince, yapılandırılmış) → dis_giyim / ceket
- HIRKA (önü açık, örgü/triko) → ust_giyim / hirka
- HOODIE (kapüşonlu, sweatshirt) → ust_giyim / hoodie
- SWEATSHIRT (kapüşonsuz, kalın) → ust_giyim / sweatshirt
- KAZAK (triko/örgü, boğazlı/sıfır yaka) → ust_giyim / kazak
- BLAZER (resmi ceket, astar) → dis_giyim / blazer

Diğer alanlar:
- color: Ana renk (turkce)
- secondary_color: İkincil renk varsa (turkce), yoksa null
- pattern: (duz, cizgili, kareli, cicekli, puantiyeli, desenli, kamuflaj, diger)
- fabric: Tahmini kumaş türü (pamuk, polyester, deri, denim, yun, keten, ipek, kadife, naylon, vb.)
- season: Uygun mevsimler dizisi ["ilkbahar", "yaz", "sonbahar", "kis"]
- occasion: Uygun ortamlar dizisi ["gunluk", "is", "ozel", "spor", "gece"]
- warmth_level: 1-5 arası sıcaklık seviyesi (1=çok ince, 5=çok kalın)
- formality_level: 1-5 arası (1=çok casual, 5=çok resmi)
- style_tags: Stil etiketleri dizisi (minimal, boho, klasik, sportif, streetwear, vintage, preppy, vb.)
- suggested_name: Kıyafet için önerilen kısa isim (Türkçe, örn: "Bordo Puf Yelek", "Siyah Deri Ceket")

Sadece JSON döndür, başka metin ekleme.`;

const VALID_PATTERNS = ['duz', 'cizgili', 'kareli', 'cicekli', 'puantiyeli', 'desenli', 'kamuflaj', 'diger'];
const VALID_CATEGORIES = ['ust_giyim', 'alt_giyim', 'dis_giyim', 'elbise', 'ayakkabi', 'aksesuar', 'canta', 'ic_giyim'];

async function analyzeClothing(imageBase64: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: 'Bu kıyafeti analiz et.' },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user, supabase } = await getUser(req);
    const serviceClient = getServiceClient();

    const body = await req.json();
    const { imageBase64, name, brand, category: userCategory } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 gerekli' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Supabase Storage'a yükle
    const fileId = crypto.randomUUID();
    const imagePath = `${user.id}/${fileId}.jpg`;
    const thumbPath = `${user.id}/${fileId}_thumb.jpg`;

    // Base64'ü Uint8Array'e çevir
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    // Storage'a yükle (service client ile — storage RLS bypass)
    const [imageUpload, thumbUpload] = await Promise.all([
      serviceClient.storage.from('clothes-images').upload(imagePath, imageBytes, {
        contentType: 'image/jpeg',
      }),
      serviceClient.storage.from('clothes-images').upload(thumbPath, imageBytes, {
        contentType: 'image/jpeg',
      }),
    ]);

    if (imageUpload.error) throw imageUpload.error;

    const { data: imageUrlData } = serviceClient.storage
      .from('clothes-images')
      .getPublicUrl(imagePath);

    const { data: thumbUrlData } = serviceClient.storage
      .from('clothes-images')
      .getPublicUrl(thumbPath);

    // AI analiz
    const aiAnalysis = await analyzeClothing(imageBase64);

    const safePattern = VALID_PATTERNS.includes(aiAnalysis.pattern) ? aiAnalysis.pattern : 'duz';
    const safeCategory = VALID_CATEGORIES.includes(userCategory || aiAnalysis.category)
      ? (userCategory || aiAnalysis.category)
      : 'ust_giyim';

    // DB'ye kaydet (service client ile — güvenilir insert)
    const clothingData = {
      user_id: user.id,
      name: name || aiAnalysis.suggested_name || 'Kıyafet',
      category: safeCategory,
      subcategory: aiAnalysis.subcategory,
      color: aiAnalysis.color,
      secondary_color: aiAnalysis.secondary_color,
      pattern: safePattern,
      season: aiAnalysis.season || ['ilkbahar', 'yaz', 'sonbahar', 'kis'],
      occasion: aiAnalysis.occasion || ['gunluk'],
      fabric: aiAnalysis.fabric,
      brand: brand || null,
      image_url: imageUrlData.publicUrl,
      thumbnail_url: thumbUrlData?.publicUrl || null,
      ai_tags: aiAnalysis.style_tags || [],
      warmth_level: aiAnalysis.warmth_level || 3,
      formality_level: aiAnalysis.formality_level || 3,
      status: 'temiz',
    };

    const { data: clothing, error } = await serviceClient
      .from('clothes')
      .insert(clothingData)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ clothing, ai_analysis: aiAnalysis, message: 'Kıyafet başarıyla eklendi!' }),
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
