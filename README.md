# 👗 KOMBİN - AI Gardırop Asistanı

Kombin, kullanıcıların gardırobunu dijitalleştirerek yapay zeka ile her gün kişiye özel kombin önerileri sunan bir mobil uygulamadır.

## ✨ Özellikler

- **📸 AI Kıyafet Tanıma**: Fotoğraf çek, AI otomatik olarak renk, kategori, kumaş, mevsim ve ortam belirler
- **🤖 Akıllı Kombin Önerisi**: Hava durumu, ortam ve kişisel tercihlere göre AI destekli kombin önerileri
- **🧺 Gerçek Hayat Filtreleri**: Kirli, ütüsüz, tamir gerekli - kıyafet durumlarını takip et
- **📊 Öğrenen AI**: Beğen/beğenme feedback loop ile her gün daha iyi öneriler
- **🔄 Tekrar Engelleme**: Son günlerde giyilenleri takip edip tekrar önermeme
- **🌤️ Hava Durumu Entegrasyonu**: OpenWeatherMap ile otomatik hava durumu bazlı öneriler
- **📅 Etkinlik Planlama**: Özel günler için kombin planla
- **📈 Gardırop İstatistikleri**: Giyim alışkanlıkları analizi

## 🏗️ Proje Yapısı

```
Kombin/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/            # Konfigürasyon & Supabase
│   │   ├── middleware/        # Auth middleware
│   │   ├── routes/            # API endpoint'leri
│   │   │   ├── auth.js        # Kayıt, giriş, profil
│   │   │   ├── wardrobe.js    # Kıyafet CRUD + durum yönetimi
│   │   │   ├── outfit.js      # Kombin önerisi + feedback
│   │   │   ├── weather.js     # Hava durumu
│   │   │   └── user.js        # Profil + etkinlikler
│   │   └── services/          # İş mantığı
│   │       ├── aiService.js   # OpenAI Vision + kombin AI
│   │       ├── weatherService.js
│   │       └── preferenceService.js  # Öğrenen AI tercih motoru
│   ├── package.json
│   └── .env.example
├── mobile/                    # React Native (Expo) App
│   ├── app/
│   │   ├── _layout.js         # Root layout + auth guard
│   │   ├── (auth)/            # Giriş / Kayıt ekranları
│   │   └── (tabs)/            # Ana tab ekranları
│   │       ├── index.js       # Ana sayfa (kombin önerisi)
│   │       ├── wardrobe.js    # Gardırop
│   │       ├── add.js         # Kıyafet ekle
│   │       ├── history.js     # Kombin geçmişi
│   │       └── profile.js     # Profil & ayarlar
│   ├── constants/theme.js     # Renkler, fontlar, sabitler
│   ├── services/api.js        # Axios API katmanı
│   ├── store/index.js         # Zustand state yönetimi
│   └── package.json
└── supabase/
    └── migrations/            # Veritabanı şeması
        └── 001_initial_schema.sql
```

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase hesabı (ücretsiz tier yeterli)
- OpenAI API anahtarı
- OpenWeatherMap API anahtarı

### 1. Backend Kurulumu

```bash
cd backend
cp .env.example .env
# .env dosyasını kendi API anahtarlarınızla doldurun
npm install
npm run dev
```

### 2. Supabase Kurulumu

1. [supabase.com](https://supabase.com) üzerinden yeni proje oluşturun
2. SQL Editor'da `supabase/migrations/001_initial_schema.sql` dosyasını çalıştırın
3. Storage'da `clothes-images` bucket'ı oluşturun (public)
4. Proje URL ve anahtarlarını `.env` dosyasına ekleyin

### 3. Mobil Uygulama Kurulumu

```bash
cd mobile
npm install
npx expo start
```

Expo Go uygulamasıyla telefonunuzda test edebilirsiniz.

## 📡 API Endpoint'leri

| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/auth/register` | Yeni kullanıcı kaydı |
| POST | `/api/auth/login` | Giriş |
| GET | `/api/auth/me` | Kullanıcı bilgisi |
| GET | `/api/wardrobe` | Kıyafetleri listele |
| GET | `/api/wardrobe/grouped` | Kategoriye göre grupla |
| GET | `/api/wardrobe/stats` | Gardırop istatistikleri |
| POST | `/api/wardrobe` | Kıyafet ekle (fotoğraf + AI analiz) |
| PATCH | `/api/wardrobe/:id` | Kıyafet güncelle |
| PATCH | `/api/wardrobe/:id/status` | Durum değiştir (kirli/temiz/ütüsüz) |
| PATCH | `/api/wardrobe/bulk/status` | Toplu durum değiştir |
| DELETE | `/api/wardrobe/:id` | Kıyafet sil |
| POST | `/api/outfit/suggest` | AI kombin önerisi |
| POST | `/api/outfit/:id/feedback` | Beğeni/beğenmeme |
| POST | `/api/outfit/:id/wear` | Kombini giyildi olarak işaretle |
| GET | `/api/outfit/history` | Kombin geçmişi |
| GET | `/api/weather` | Hava durumu |
| PATCH | `/api/user/profile` | Profil güncelle |
| POST | `/api/user/events` | Etkinlik ekle |
| GET | `/api/user/events` | Etkinlikleri listele |

## 💰 Gelir Modeli

- **Freemium**: Temel gardırop + günde 1 kombin önerisi ücretsiz
- **Premium** (aylık): Sınırsız kombin, etkinlik bazlı öneriler, istatistikler
- **Marka ortaklıkları**: Eksik parça önerisi ile marka/mağaza yönlendirmesi

## 🛡️ Güvenlik

- JWT tabanlı kimlik doğrulama
- Rate limiting (15 dakikada 100 istek)
- Helmet.js güvenlik başlıkları
- Row Level Security (Supabase RLS)
- Dosya boyutu limiti (10MB)
- Input validasyonu

## 🗺️ Yol Haritası

### MVP (Faz 1) ✅
- [x] Kullanıcı kayıt/giriş
- [x] Kıyafet fotoğraf yükleme + AI tanıma
- [x] Gardırop listeleme ve filtreleme
- [x] Kıyafet durumu yönetimi (kirli/temiz/ütüsüz)
- [x] AI kombin önerisi
- [x] Hava durumu entegrasyonu
- [x] Beğen/beğenme feedback sistemi
- [x] Giyim geçmişi takibi

### Faz 2
- [ ] Push bildirimler (sabah kombin hatırlatması)
- [ ] Etkinlik bazlı kombin planlama
- [ ] Premium abonelik sistemi (RevenueCat)
- [ ] Paylaşma özelliği (Instagram story)
- [ ] Çoklu fotoğraf yükleme

### Faz 3
- [ ] Aile/arkadaş dolabı paylaşımı
- [ ] Marka entegrasyonları (Trendyol, Dolap)
- [ ] Kıyafet alım önerileri (eksik parça analizi)
- [ ] Stil çarkı / günlük challenge
- [ ] AR deneme (sanal giyim)

## 📄 Lisans

MIT
