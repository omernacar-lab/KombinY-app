const request = require('supertest');
const { mockSupabase, createChain } = require('../helpers/mockSupabase');
const { createMockUser, createMockClothing, createValidToken, createMockOutfitSuggestion, createMockWeather } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);
jest.mock('../../services/aiService');
jest.mock('../../services/weatherService');
jest.mock('../../services/preferenceService');

const app = require('../../server');
const aiService = require('../../services/aiService');
const weatherService = require('../../services/weatherService');
const preferenceService = require('../../services/preferenceService');
const { invalidateUserCache } = require('../../middleware/auth');

describe('Outfit Routes', () => {
  let token;
  const mockUser = createMockUser();

  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();
    invalidateUserCache();
    token = createValidToken(mockUser.id);

    // Default service mocks
    aiService.generateOutfitSuggestion.mockResolvedValue(createMockOutfitSuggestion());
    weatherService.getWeather.mockResolvedValue(createMockWeather());
    weatherService.getClothingAdvice.mockReturnValue({ warmth_min: 1, warmth_max: 3, needs_outerwear: false, rain_gear: false });
    preferenceService.getUserPreferenceProfile.mockResolvedValue({});
    preferenceService.processOutfitFeedback.mockResolvedValue();
  });

  // ==================== POST /api/outfit/suggest ====================
  describe('POST /api/outfit/suggest', () => {
    function setupSuggestMocks(userOverrides = {}) {
      const user = createMockUser(userOverrides);
      const clothes = [
        createMockClothing({ id: 'c1' }),
        createMockClothing({ id: 'c2', category: 'alt_giyim' }),
        createMockClothing({ id: 'c3', category: 'ayakkabi' }),
      ];
      const outfit = { id: 'outfit-1', user_id: user.id };

      // Auth middleware
      mockSupabase.from.mockReturnValueOnce(createChain({ data: user, error: null }));

      // Freemium check (only for non-premium users)
      if (!user.is_premium) {
        mockSupabase.from.mockReturnValueOnce(
          createChain({ data: { daily_outfit_count: 0, last_outfit_date: null }, error: null })
        );
      }

      // Clothes, recently worn, insert outfit, insert items, update daily count
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: clothes, error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: outfit, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }));

      return { user, clothes };
    }

    it('should return outfit suggestion with items and styling tip', async () => {
      setupSuggestMocks();

      const res = await request(app)
        .post('/api/outfit/suggest')
        .set('Authorization', `Bearer ${token}`)
        .send({ occasion: 'gunluk' });

      expect(res.status).toBe(200);
      expect(res.body.outfit_id).toBeDefined();
      expect(res.body.items).toBeDefined();
      expect(res.body.styling_tip).toBeDefined();
      expect(res.body.confidence).toBeDefined();
    });

    it('should block free users who exceeded daily limit', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Auth middleware
      mockSupabase.from.mockReturnValueOnce(
        createChain({ data: createMockUser({ is_premium: false }), error: null })
      );
      // Freemium check - already used today
      mockSupabase.from.mockReturnValueOnce(
        createChain({ data: { daily_outfit_count: 1, last_outfit_date: today }, error: null })
      );

      const res = await request(app)
        .post('/api/outfit/suggest')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Günlük ücretsiz kombin hakkınız doldu');
      expect(res.body.upgrade).toBe(true);
    });

    it('should allow premium users unlimited suggestions', async () => {
      setupSuggestMocks({ is_premium: true });

      const res = await request(app)
        .post('/api/outfit/suggest')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should return 400 when less than 3 clothes', async () => {
      // Auth
      mockSupabase.from.mockReturnValueOnce(
        createChain({ data: createMockUser(), error: null })
      );
      // Freemium
      mockSupabase.from.mockReturnValueOnce(
        createChain({ data: { daily_outfit_count: 0, last_outfit_date: null }, error: null })
      );
      // Only 2 clothes
      mockSupabase.from.mockReturnValueOnce(
        createChain({ data: [createMockClothing(), createMockClothing({ id: 'c2' })], error: null })
      );

      const res = await request(app)
        .post('/api/outfit/suggest')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('en az 3 kıyafet');
    });

    it('should handle weather failure gracefully', async () => {
      weatherService.getWeather.mockRejectedValue(new Error('Weather API down'));
      setupSuggestMocks();

      const res = await request(app)
        .post('/api/outfit/suggest')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      // Should still succeed, weather is optional
      expect(res.status).toBe(200);
    });
  });

  // ==================== POST /api/outfit/:id/feedback ====================
  describe('POST /api/outfit/:id/feedback', () => {
    it('should update outfit with like feedback', async () => {
      const outfitData = { id: 'outfit-1', is_liked: true, user_rating: null };
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: createMockUser(), error: null }))
        .mockReturnValueOnce(createChain({ data: outfitData, error: null }));

      const res = await request(app)
        .post('/api/outfit/outfit-1/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ liked: true });

      expect(res.status).toBe(200);
      expect(res.body.outfit).toBeDefined();
      expect(preferenceService.processOutfitFeedback).toHaveBeenCalled();
    });

    it('should return 404 when outfit not found', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: createMockUser(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }));

      const res = await request(app)
        .post('/api/outfit/invalid-id/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ liked: true });

      expect(res.status).toBe(404);
    });
  });

  // ==================== POST /api/outfit/:id/wear ====================
  describe('POST /api/outfit/:id/wear', () => {
    it('should mark outfit as worn and update history', async () => {
      const items = [{ clothing_id: 'c1' }, { clothing_id: 'c2' }];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: createMockUser(), error: null }))  // auth
        .mockReturnValueOnce(createChain({ data: null, error: null }))  // update outfit
        .mockReturnValueOnce(createChain({ data: items, error: null })) // get items
        .mockReturnValueOnce(createChain({ data: null, error: null })); // insert history

      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const res = await request(app)
        .post('/api/outfit/outfit-1/wear')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('giyildi');
    });
  });

  // ==================== GET /api/outfit/history ====================
  describe('GET /api/outfit/history', () => {
    it('should return paginated outfit history', async () => {
      const outfits = [
        { id: 'o1', occasion: 'gunluk', outfit_items: [] },
        { id: 'o2', occasion: 'is', outfit_items: [] },
      ];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: createMockUser(), error: null }))
        .mockReturnValueOnce(createChain({ data: outfits, error: null }));

      const res = await request(app)
        .get('/api/outfit/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.outfits).toBeDefined();
      expect(res.body.outfits).toHaveLength(2);
    });
  });
});
