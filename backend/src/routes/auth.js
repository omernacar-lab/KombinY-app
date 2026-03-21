const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');

const router = express.Router();

// ==================== KAYIT ====================
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, gender, birthYear, city } = req.body;

    // Email kontrolü
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Bu email zaten kayıtlı' });
    }

    // Şifre hash'le
    const passwordHash = await bcrypt.hash(password, 12);

    // Kullanıcı oluştur
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        gender: gender || null,
        birth_year: birthYear || null,
        city: city || 'Istanbul',
      })
      .select('id, email, full_name, is_premium')
      .single();

    if (error) throw error;

    // Token oluştur
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

// ==================== GİRİŞ ====================
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, is_premium, password_hash')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

// ==================== PROFİL ====================
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
