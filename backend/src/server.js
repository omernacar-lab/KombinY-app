const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const authRoutes = require('./routes/auth');
const wardrobeRoutes = require('./routes/wardrobe');
const outfitRoutes = require('./routes/outfit');
const weatherRoutes = require('./routes/weather');
const userRoutes = require('./routes/user');

const app = express();

// Güvenlik middleware'leri
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/outfit', outfitRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Hata yakalama
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'development' ? err.message : 'Sunucu hatası',
  });
});

if (config.nodeEnv !== 'test') {
  app.listen(config.port, () => {
    console.log(`Kombin API çalışıyor: http://localhost:${config.port}`);
  });
}

module.exports = app;
