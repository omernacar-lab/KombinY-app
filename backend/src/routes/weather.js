const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getWeather, getClothingAdvice } = require('../services/weatherService');

const router = express.Router();

// ==================== HAVA DURUMU AL ====================
router.get('/', authenticate, async (req, res, next) => {
  try {
    const city = req.query.city || req.user.city || 'Istanbul';
    const weather = await getWeather(city);
    const clothingAdvice = getClothingAdvice(weather);

    res.json({ weather, clothing_advice: clothingAdvice });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
