const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { analyzeClothing, analyzeFrameForClothingItems, deduplicateDetectedItems } = require('../services/aiService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları kabul edilir'));
    }
  },
});

// ==================== KIYAFETLERİ LİSTELE ====================
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category, status, season, occasion } = req.query;

    let query = supabase
      .from('clothes')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (season) query = query.contains('season', [season]);
    if (occasion) query = query.contains('occasion', [occasion]);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ clothes: data, total: data.length });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFETLERİ KATEGORİYE GÖRE GRUPLA ====================
router.get('/grouped', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clothes')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_archived', false)
      .order('category')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const grouped = {};
    for (const item of data) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    res.json({ grouped, total: data.length });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFET EKLE (FOTOĞRAF + AI ANALİZ) ====================
router.post('/', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fotoğraf gerekli' });
    }

    // Resmi optimize et
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Thumbnail oluştur
    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const fileId = uuidv4();
    const imagePath = `${req.user.id}/${fileId}.jpg`;
    const thumbPath = `${req.user.id}/${fileId}_thumb.jpg`;

    // Supabase Storage'a yükle
    const [imageUpload, thumbUpload] = await Promise.all([
      supabase.storage.from('clothes-images').upload(imagePath, optimizedBuffer, {
        contentType: 'image/jpeg',
      }),
      supabase.storage.from('clothes-images').upload(thumbPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
      }),
    ]);

    if (imageUpload.error) throw imageUpload.error;

    const { data: imageUrlData } = supabase.storage
      .from('clothes-images')
      .getPublicUrl(imagePath);

    const { data: thumbUrlData } = supabase.storage
      .from('clothes-images')
      .getPublicUrl(thumbPath);

    // AI ile kıyafet analizi
    const base64Image = optimizedBuffer.toString('base64');
    const aiAnalysis = await analyzeClothing(base64Image);

    // Veritabanına kaydet
    const clothingData = {
      user_id: req.user.id,
      name: req.body.name || aiAnalysis.suggested_name || 'Kıyafet',
      category: req.body.category || aiAnalysis.category,
      subcategory: aiAnalysis.subcategory,
      color: aiAnalysis.color,
      secondary_color: aiAnalysis.secondary_color,
      pattern: aiAnalysis.pattern || 'duz',
      season: aiAnalysis.season || ['ilkbahar', 'yaz', 'sonbahar', 'kis'],
      occasion: aiAnalysis.occasion || ['gunluk'],
      fabric: aiAnalysis.fabric,
      brand: req.body.brand || null,
      image_url: imageUrlData.publicUrl,
      thumbnail_url: thumbUrlData?.publicUrl || null,
      ai_tags: aiAnalysis.style_tags || [],
      warmth_level: aiAnalysis.warmth_level || 3,
      formality_level: aiAnalysis.formality_level || 3,
      status: 'temiz',
    };

    const { data: clothing, error } = await supabase
      .from('clothes')
      .insert(clothingData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      clothing,
      ai_analysis: aiAnalysis,
      message: 'Kıyafet başarıyla eklendi!',
    });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFET FOTOĞRAFI EKLE/GÜNCELLE ====================
router.post('/:id/photo', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fotoğraf gerekli' });
    }

    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const fileId = uuidv4();
    const imagePath = `${req.user.id}/${fileId}.jpg`;
    const thumbPath = `${req.user.id}/${fileId}_thumb.jpg`;

    const [imageUpload] = await Promise.all([
      supabase.storage.from('clothes-images').upload(imagePath, optimizedBuffer, {
        contentType: 'image/jpeg',
      }),
      supabase.storage.from('clothes-images').upload(thumbPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
      }),
    ]);

    if (imageUpload.error) throw imageUpload.error;

    const { data: imageUrlData } = supabase.storage.from('clothes-images').getPublicUrl(imagePath);
    const { data: thumbUrlData } = supabase.storage.from('clothes-images').getPublicUrl(thumbPath);

    const { data, error } = await supabase
      .from('clothes')
      .update({
        image_url: imageUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ clothing: data });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFET GÜNCELLE ====================
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'category', 'subcategory', 'color', 'secondary_color',
      'pattern', 'season', 'occasion', 'fabric', 'brand', 'status',
      'warmth_level', 'formality_level', 'is_favorite', 'is_archived',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('clothes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Kıyafet bulunamadı' });

    res.json({ clothing: data });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFET DURUMU DEĞİŞTİR (KİRLİ/TEMİZ/ÜTÜSÜZ) ====================
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['temiz', 'kirli', 'utusuz', 'tamir_gerekli', 'kuru_temizleme'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Geçersiz durum. Geçerli değerler: ${validStatuses.join(', ')}`,
      });
    }

    const { data, error } = await supabase
      .from('clothes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Kıyafet bulunamadı' });

    res.json({ clothing: data });
  } catch (err) {
    next(err);
  }
});

// ==================== TOPLU DURUM DEĞİŞTİR (Çamaşır yıkandı!) ====================
router.patch('/bulk/status', authenticate, async (req, res, next) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Kıyafet ID listesi gerekli' });
    }

    const { data, error } = await supabase
      .from('clothes')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;

    res.json({ updated: data.length, clothes: data });
  } catch (err) {
    next(err);
  }
});

// ==================== KIYAFET SİL ====================
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('clothes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Kıyafet silindi' });
  } catch (err) {
    next(err);
  }
});

// ==================== GARDIROB İSTATİSTİKLERİ ====================
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const { data: clothes, error } = await supabase
      .from('clothes')
      .select('category, color, status, times_worn, is_favorite')
      .eq('user_id', req.user.id)
      .eq('is_archived', false);

    if (error) throw error;

    const stats = {
      total: clothes.length,
      by_category: {},
      by_color: {},
      by_status: {},
      favorites: clothes.filter((c) => c.is_favorite).length,
      never_worn: clothes.filter((c) => c.times_worn === 0).length,
      most_worn: clothes.sort((a, b) => b.times_worn - a.times_worn).slice(0, 5),
    };

    for (const c of clothes) {
      stats.by_category[c.category] = (stats.by_category[c.category] || 0) + 1;
      stats.by_color[c.color] = (stats.by_color[c.color] || 0) + 1;
      stats.by_status[c.status] = (stats.by_status[c.status] || 0) + 1;
    }

    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// ==================== VİDEO İLE DOLAP TARAMA ====================
router.post('/scan-video', authenticate, upload.array('frames', 20), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'En az bir frame gerekli' });
    }

    // Frame'leri paralel analiz et (max 3 concurrent)
    const concurrency = 3;
    const allItems = [];
    const frames = req.files;

    for (let i = 0; i < frames.length; i += concurrency) {
      const batch = frames.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const resized = await sharp(file.buffer)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          const base64 = resized.toString('base64');
          return analyzeFrameForClothingItems(base64);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allItems.push(...result.value);
        }
      }
    }

    const totalBeforeDedup = allItems.length;
    const uniqueItems = deduplicateDetectedItems(allItems);

    res.json({
      detected_items: uniqueItems,
      frame_count: frames.length,
      total_before_dedup: totalBeforeDedup,
      total_after_dedup: uniqueItems.length,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== TOPLU KIYAFET EKLE ====================
router.post('/bulk-add', authenticate, async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Kıyafet listesi gerekli' });
    }

    const clothingData = items.map((item) => ({
      user_id: req.user.id,
      name: item.suggested_name || item.name || 'Kıyafet',
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      secondary_color: item.secondary_color || null,
      pattern: item.pattern || 'duz',
      season: item.season || ['ilkbahar', 'yaz', 'sonbahar', 'kis'],
      occasion: item.occasion || ['gunluk'],
      fabric: item.fabric || null,
      ai_tags: item.style_tags || [],
      warmth_level: item.warmth_level || 3,
      formality_level: item.formality_level || 3,
      status: 'temiz',
      image_url: '',
      thumbnail_url: '',
    }));

    const { data, error } = await supabase
      .from('clothes')
      .insert(clothingData)
      .select();

    if (error) throw error;

    res.status(201).json({
      added: data,
      count: data.length,
      message: `${data.length} kıyafet gardıroba eklendi!`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
