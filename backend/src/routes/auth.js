const express = require('express');
const { supabase, supabaseAuth } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');

const router = express.Router();

// ==================== KAYIT ====================
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, gender, birthYear, city } = req.body;

    // Supabase Auth ile kullanıcı oluştur
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return res.status(409).json({ error: 'Bu email zaten kayıtlı' });
      }
      throw authError;
    }

    // Profil bilgilerini güncelle (trigger sadece full_name set ediyor)
    if (gender || birthYear || city) {
      await supabase
        .from('profiles')
        .update({
          gender: gender || null,
          birth_year: birthYear || null,
          city: city || 'Istanbul',
        })
        .eq('id', authData.user.id);
    }

    // Session oluştur (anon client ile - service client'ın state'ini kirletmemek için)
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) throw sessionError;

    // Profil bilgilerini al
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_premium')
      .eq('id', authData.user.id)
      .single();

    res.status(201).json({
      user: profile,
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== GİRİŞ ====================
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    // Profil bilgilerini al
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_premium')
      .eq('id', sessionData.user.id)
      .single();

    res.json({
      user: profile,
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== TOKEN YENİLE ====================
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token gerekli' });
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return res.status(401).json({ error: 'Geçersiz refresh token' });
    }

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== PROFİL ====================
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
