const { supabase } = require('../config/supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Geçersiz token' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name,
      is_premium: false,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token doğrulanamadı' });
  }
};

module.exports = { authenticate };
