const config = require('../config');

// Şehir bazlı hava durumu cache (TTL: 30 dakika)
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 30 * 60 * 1000;

/**
 * OpenWeatherMap API'den hava durumu bilgisi alır (cache destekli).
 */
async function getWeather(city = 'Istanbul') {
  const cacheKey = city.toLowerCase().trim();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
    return cached.data;
  }

  const url = `${config.weather.baseUrl}/weather?q=${encodeURIComponent(city)},TR&units=metric&lang=tr&appid=${config.weather.apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Hava durumu alınamadı');
  }

  const data = await response.json();

  const result = {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    wind_speed: data.wind.speed,
    condition: mapWeatherCondition(data.weather[0].main),
  };

  // Cache'e kaydet
  weatherCache.set(cacheKey, { data: result, timestamp: Date.now() });
  // Cache boyutunu sınırla
  if (weatherCache.size > 500) {
    const oldest = weatherCache.keys().next().value;
    weatherCache.delete(oldest);
  }

  return result;
}

/**
 * Hava durumu koşulunu Türkçe haritalandırır.
 */
function mapWeatherCondition(main) {
  const map = {
    Clear: 'gunesli',
    Clouds: 'bulutlu',
    Rain: 'yagmurlu',
    Drizzle: 'ciseleme',
    Thunderstorm: 'firtinali',
    Snow: 'karli',
    Mist: 'sisli',
    Fog: 'sisli',
    Haze: 'puslu',
  };
  return map[main] || 'normal';
}

/**
 * Hava durumuna göre giyim önerisi verir.
 */
function getClothingAdvice(weather) {
  const temp = weather.temp;
  let advice = { warmth_min: 1, warmth_max: 5, needs_outerwear: false, rain_gear: false };

  if (temp >= 30) {
    advice = { warmth_min: 1, warmth_max: 2, needs_outerwear: false, rain_gear: false };
  } else if (temp >= 20) {
    advice = { warmth_min: 1, warmth_max: 3, needs_outerwear: false, rain_gear: false };
  } else if (temp >= 10) {
    advice = { warmth_min: 2, warmth_max: 4, needs_outerwear: true, rain_gear: false };
  } else if (temp >= 0) {
    advice = { warmth_min: 3, warmth_max: 5, needs_outerwear: true, rain_gear: false };
  } else {
    advice = { warmth_min: 4, warmth_max: 5, needs_outerwear: true, rain_gear: false };
  }

  if (['yagmurlu', 'ciseleme', 'firtinali'].includes(weather.condition)) {
    advice.rain_gear = true;
  }

  return advice;
}

module.exports = {
  getWeather,
  getClothingAdvice,
};
