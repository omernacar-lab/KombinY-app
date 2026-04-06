const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, profileUpdateSchema, eventSchema } = require('../middleware/validate');

const router = express.Router();

// ==================== PROFİL GÜNCELLE ====================
router.patch('/profile', authenticate, validate(profileUpdateSchema), async (req, res, next) => {
  try {
    const allowedFields = [
      'full_name', 'gender', 'birth_year', 'city', 'style_preferences',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, email, full_name, gender, birth_year, city, style_preferences, is_premium')
      .single();

    if (error) throw error;

    res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

// ==================== ETKİNLİK EKLE ====================
router.post('/events', authenticate, validate(eventSchema), async (req, res, next) => {
  try {
    const { title, eventDate, occasion, dressCode, notes } = req.body;

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: req.user.id,
        title,
        event_date: eventDate,
        occasion,
        dress_code: dressCode,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ event: data });
  } catch (err) {
    next(err);
  }
});

// ==================== ETKİNLİKLERİ LİSTELE ====================
router.get('/events', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, outfits(*)')
      .eq('user_id', req.user.id)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true });

    if (error) throw error;

    res.json({ events: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
