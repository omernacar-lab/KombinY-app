-- =====================================================
-- Kombin: Custom Auth -> Supabase Auth Migration
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştır
-- =====================================================

-- 1. Mevcut foreign key'leri ve bağımlı tabloları temizle (test verisi)
TRUNCATE TABLE outfit_items CASCADE;
TRUNCATE TABLE outfits CASCADE;
TRUNCATE TABLE clothes CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE user_preferences CASCADE;

-- 2. Eski users tablosunu sil
DROP TABLE IF EXISTS public.users CASCADE;

-- 3. Profiles tablosu oluştur (auth.users'a bağlı)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female', 'male', 'other')),
  birth_year INTEGER,
  city TEXT DEFAULT 'Istanbul',
  style_preferences TEXT[],
  is_premium BOOLEAN DEFAULT FALSE,
  daily_outfit_count INTEGER DEFAULT 0,
  last_outfit_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS aktif et
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Kullanıcı kendi profilini okuyabilsin
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 6. Trigger: yeni kayıt olunca otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Bağımlı tablolardaki FK'leri profiles'a yönlendir
-- (clothes tablosu)
ALTER TABLE public.clothes
  DROP CONSTRAINT IF EXISTS clothes_user_id_fkey,
  ADD CONSTRAINT clothes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- (outfits tablosu)
ALTER TABLE public.outfits
  DROP CONSTRAINT IF EXISTS outfits_user_id_fkey,
  ADD CONSTRAINT outfits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- (events tablosu)
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_user_id_fkey,
  ADD CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- (user_preferences tablosu)
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey,
  ADD CONSTRAINT user_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
