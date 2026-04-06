# Supabase Edge Functions Deploy Rehberi

## 1. Supabase CLI Kur

```bash
npm install -g supabase
```

## 2. Projeyi Bağla

```bash
cd c:\Users\omer_\Desktop\Kombin
supabase login
supabase link --project-ref kkplxeksklwarvvnkatx
```

## 3. Secrets (API Anahtarları) Ayarla

Edge Functions'ların kullanacağı gizli anahtarları ayarla:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
supabase secrets set WEATHER_API_KEY=your-weather-api-key-here
```

> NOT: SUPABASE_URL, SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY otomatik olarak mevcuttur.

## 4. Edge Functions Deploy

Tüm fonksiyonları deploy et:

```bash
supabase functions deploy analyze-clothing
supabase functions deploy suggest-outfit
supabase functions deploy weather
supabase functions deploy scan-video
supabase functions deploy outfit-feedback
```

Veya hepsini tek seferde:

```bash
supabase functions deploy --all
```

## 5. Test Et

```bash
# Weather test
curl -X GET "https://kkplxeksklwarvvnkatx.supabase.co/functions/v1/weather?city=Istanbul" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>"
```

## Edge Function Listesi

| Fonksiyon | Metod | Açıklama |
|-----------|-------|----------|
| `analyze-clothing` | POST | Kıyafet fotoğrafı analizi (OpenAI Vision) + Storage upload + DB insert |
| `suggest-outfit` | POST | AI kombin önerisi (OpenAI + Weather + Preferences) |
| `weather` | GET | Hava durumu (OpenWeatherMap) |
| `scan-video` | POST | Video frame'lerinden toplu kıyafet tespiti |
| `outfit-feedback` | POST | Kombin beğeni/beğenmeme + AI öğrenme |

## Mimari

```
Mobile App
  ├── Supabase Client (direkt) → Wardrobe CRUD, Outfit History/Wear, User Profile, Events
  └── Edge Functions → AI Analiz, Kombin Önerisi, Hava Durumu, Video Tarama, Feedback
```

Artık local Express backend'e gerek yok!
