const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@test.com',
    full_name: 'Test User',
    is_premium: false,
    city: 'Istanbul',
    daily_outfit_count: 0,
    last_outfit_date: null,
    gender: 'male',
    birth_year: 1995,
    ...overrides,
  };
}

function createMockClothing(overrides = {}) {
  return {
    id: 'cloth-1',
    user_id: 'user-123',
    name: 'Mavi Tişört',
    category: 'ust_giyim',
    subcategory: 'tshirt',
    color: 'mavi',
    secondary_color: null,
    pattern: 'duz',
    fabric: 'pamuk',
    season: ['ilkbahar', 'yaz'],
    occasion: ['gunluk', 'spor'],
    warmth_level: 2,
    formality_level: 2,
    status: 'temiz',
    is_archived: false,
    is_favorite: false,
    ai_tags: ['minimal', 'sportif'],
    times_worn: 5,
    last_worn_date: null,
    image_url: 'https://test.supabase.co/storage/v1/object/public/clothes-images/user-123/img.jpg',
    thumbnail_url: 'https://test.supabase.co/storage/v1/object/public/clothes-images/user-123/img_thumb.jpg',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockWeather(overrides = {}) {
  return {
    temp: 22,
    feels_like: 21,
    humidity: 55,
    description: 'açık',
    icon: '01d',
    wind_speed: 3.5,
    condition: 'gunesli',
    ...overrides,
  };
}

function createMockAiAnalysis(overrides = {}) {
  return {
    category: 'ust_giyim',
    subcategory: 'tshirt',
    color: 'mavi',
    secondary_color: null,
    pattern: 'duz',
    fabric: 'pamuk',
    season: ['ilkbahar', 'yaz'],
    occasion: ['gunluk', 'spor'],
    warmth_level: 2,
    formality_level: 2,
    style_tags: ['minimal', 'sportif'],
    suggested_name: 'Mavi Tişört',
    ...overrides,
  };
}

function createMockOutfitSuggestion(overrides = {}) {
  return {
    items: [
      { clothing_id: 'cloth-1', reason: 'Hava sıcak, ince tişört uygun' },
      { clothing_id: 'cloth-2', reason: 'Rahat bir alt giyim' },
      { clothing_id: 'cloth-3', reason: 'Spor ayakkabı tamamlıyor' },
    ],
    styling_tip: 'Rahat ve şık bir günlük kombin!',
    confidence: 0.85,
    alternative_swap: { clothing_id: 'cloth-4', reason: 'Daha resmi bir alternatif' },
    ...overrides,
  };
}

function createValidToken(userId = 'user-123') {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
  TEST_JWT_SECRET,
  createMockUser,
  createMockClothing,
  createMockWeather,
  createMockAiAnalysis,
  createMockOutfitSuggestion,
  createValidToken,
};
