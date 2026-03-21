-- ============================================
-- KOMBİN - Veritabanı Şeması (Supabase/PostgreSQL)
-- ============================================

-- Kullanıcılar tablosu
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female', 'male', 'other')),
  birth_year INTEGER,
  city TEXT DEFAULT 'Istanbul',
  style_preferences JSONB DEFAULT '[]'::jsonb,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  daily_outfit_count INTEGER DEFAULT 0,
  last_outfit_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kıyafetler tablosu
CREATE TABLE clothes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'ust_giyim', 'alt_giyim', 'dis_giyim', 'elbise',
    'ayakkabi', 'aksesuar', 'canta', 'ic_giyim'
  )),
  subcategory TEXT, -- tshirt, gomlek, pantolon, etek, vb.
  color TEXT NOT NULL,
  secondary_color TEXT,
  pattern TEXT DEFAULT 'duz' CHECK (pattern IN (
    'duz', 'cizgili', 'kareli', 'cicekli', 'puantiyeli',
    'desenli', 'kamuflaj', 'diger'
  )),
  season TEXT[] DEFAULT ARRAY['ilkbahar', 'yaz', 'sonbahar', 'kis'],
  occasion TEXT[] DEFAULT ARRAY['gunluk'], -- gunluk, is, ozel, spor, gece
  fabric TEXT, -- pamuk, polyester, denim, deri, vb.
  brand TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Gerçek hayat durumu (USP!)
  status TEXT DEFAULT 'temiz' CHECK (status IN (
    'temiz', 'kirli', 'utusuz', 'tamir_gerekli', 'kuru_temizleme'
  )),
  
  -- AI tarafından tespit edilen özellikler
  ai_tags JSONB DEFAULT '[]'::jsonb,
  ai_style_score FLOAT, -- 0-1 arası
  warmth_level INTEGER DEFAULT 3 CHECK (warmth_level BETWEEN 1 AND 5),
  formality_level INTEGER DEFAULT 3 CHECK (formality_level BETWEEN 1 AND 5),
  
  -- Kullanım takibi
  times_worn INTEGER DEFAULT 0,
  last_worn_date DATE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kombinler tablosu
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  occasion TEXT DEFAULT 'gunluk',
  season TEXT,
  weather_temp FLOAT,
  weather_condition TEXT,
  is_ai_generated BOOLEAN DEFAULT TRUE,
  
  -- Feedback
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  is_liked BOOLEAN,
  is_worn BOOLEAN DEFAULT FALSE,
  worn_date DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kombin-Kıyafet ilişkisi
CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_id UUID REFERENCES clothes(id) ON DELETE CASCADE,
  layer_order INTEGER DEFAULT 0 -- katman sırası (iç, orta, dış)
);

-- Giyim geçmişi
CREATE TABLE wear_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clothing_id UUID REFERENCES clothes(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id),
  worn_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI öğrenme - kullanıcı tercihleri
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL, -- 'color_combo', 'style', 'brand', 'category_combo'
  preference_key TEXT NOT NULL,
  score FLOAT DEFAULT 0.5, -- 0 = sevmez, 1 = çok sever
  interaction_count INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preference_type, preference_key)
);

-- Etkinlikler / özel günler
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  occasion TEXT NOT NULL, -- is, dugun, parti, bulusma, toplanti, vb.
  dress_code TEXT,
  notes TEXT,
  outfit_id UUID REFERENCES outfits(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kıyafet giyim sayacı RPC fonksiyonu
CREATE OR REPLACE FUNCTION increment_wear_count(cloth_id UUID, wear_date DATE)
RETURNS VOID AS $$
BEGIN
  UPDATE clothes
  SET times_worn = times_worn + 1,
      last_worn_date = wear_date,
      updated_at = NOW()
  WHERE id = cloth_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- İndeksler
CREATE INDEX idx_clothes_user ON clothes(user_id);
CREATE INDEX idx_clothes_status ON clothes(user_id, status);
CREATE INDEX idx_clothes_category ON clothes(user_id, category);
CREATE INDEX idx_outfits_user ON outfits(user_id);
CREATE INDEX idx_outfits_date ON outfits(user_id, created_at);
CREATE INDEX idx_wear_history_user ON wear_history(user_id, worn_date);
CREATE INDEX idx_user_preferences ON user_preferences(user_id, preference_type);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wear_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can manage own clothes" ON clothes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own outfits" ON outfits FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own outfit items" ON outfit_items FOR ALL 
  USING (outfit_id IN (SELECT id FROM outfits WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own wear history" ON wear_history FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own events" ON events FOR ALL USING (user_id = auth.uid());

-- Storage bucket (Supabase Dashboard'dan da yapılabilir)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('clothes-images', 'clothes-images', true);
