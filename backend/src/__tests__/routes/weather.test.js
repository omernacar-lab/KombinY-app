const request = require('supertest');
const { mockSupabase, createChain } = require('../helpers/mockSupabase');
const { createMockUser, createValidToken, createMockWeather } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);
jest.mock('../../services/weatherService');

const app = require('../../server');
const weatherService = require('../../services/weatherService');
const { invalidateUserCache } = require('../../middleware/auth');

describe('Weather Routes', () => {
  let token;
  const mockUser = createMockUser();

  beforeEach(() => {
    mockSupabase.from.mockReset();
    invalidateUserCache();
    token = createValidToken(mockUser.id);

    // Auth middleware
    const authChain = createChain({ data: mockUser, error: null });
    mockSupabase.from.mockReturnValue(authChain);

    // Default weather mock
    weatherService.getWeather.mockResolvedValue(createMockWeather());
    weatherService.getClothingAdvice.mockReturnValue({
      warmth_min: 1,
      warmth_max: 3,
      needs_outerwear: false,
      rain_gear: false,
    });
  });

  describe('GET /api/weather', () => {
    it('should return weather and clothing advice', async () => {
      const res = await request(app)
        .get('/api/weather')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.weather).toBeDefined();
      expect(res.body.clothing_advice).toBeDefined();
    });

    it('should use city from query param', async () => {
      await request(app)
        .get('/api/weather?city=Ankara')
        .set('Authorization', `Bearer ${token}`);

      expect(weatherService.getWeather).toHaveBeenCalledWith('Ankara');
    });

    it('should fallback to user city when no query param', async () => {
      await request(app)
        .get('/api/weather')
        .set('Authorization', `Bearer ${token}`);

      expect(weatherService.getWeather).toHaveBeenCalledWith('Istanbul');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/weather');

      expect(res.status).toBe(401);
    });
  });
});
