const jwt = require('jsonwebtoken');
const config = require('../config');
const supabase = require('../config/supabase');

// Basit in-memory user cache (TTL: 5 dakika)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.user;
  }
  userCache.delete(userId);
  return null;
}

function setCachedUser(userId, user) {
  userCache.set(userId, { user, timestamp: Date.now() });
  // Cache boyutunu sınırla
  if (userCache.size > 10000) {
    const oldest = userCache.keys().next().value;
    userCache.delete(oldest);
  }
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Önce cache'e bak
    let user = getCachedUser(decoded.userId);
    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, is_premium, daily_outfit_count, last_outfit_date, city')
        .eq('id', decoded.userId)
        .single();

      if (error || !data) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı' });
      }
      user = data;
      setCachedUser(decoded.userId, user);
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
};

// Cache'i dışarıdan temizlemek için export
function invalidateUserCache(userId) {
  if (userId) {
    userCache.delete(userId);
  } else {
    userCache.clear();
  }
}

module.exports = { authenticate, invalidateUserCache };
