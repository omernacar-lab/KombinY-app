const request = require('supertest');
const { mockSupabase, createChain, mockStorageBucket } = require('../helpers/mockSupabase');
const { createMockUser, createMockClothing, createValidToken, createMockAiAnalysis } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);
jest.mock('../../services/aiService');
jest.mock('sharp', () => jest.fn(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
})));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const app = require('../../server');
const aiService = require('../../services/aiService');
const { invalidateUserCache } = require('../../middleware/auth');

describe('Wardrobe Routes', () => {
  let token;
  const mockUser = createMockUser();

  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockStorageBucket.upload.mockReset();
    mockStorageBucket.getPublicUrl.mockReset();
    invalidateUserCache();

    token = createValidToken(mockUser.id);

    mockStorageBucket.upload.mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/storage/test/path.jpg' },
    });

    aiService.analyzeClothing.mockResolvedValue(createMockAiAnalysis());
    aiService.analyzeFrameForClothingItems.mockResolvedValue([]);
    aiService.deduplicateDetectedItems.mockReturnValue([]);
  });

  // ==================== GET /api/wardrobe ====================
  describe('GET /api/wardrobe', () => {
    it('should return list of clothes', async () => {
      const clothes = [createMockClothing(), createMockClothing({ id: 'cloth-2' })];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: clothes, error: null }));

      const res = await request(app)
        .get('/api/wardrobe')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.clothes).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should apply category filter', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }));

      const res = await request(app)
        .get('/api/wardrobe?category=ust_giyim')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/wardrobe');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /api/wardrobe/grouped ====================
  describe('GET /api/wardrobe/grouped', () => {
    it('should return clothes grouped by category', async () => {
      const clothes = [
        createMockClothing({ id: 'c1', category: 'ust_giyim' }),
        createMockClothing({ id: 'c2', category: 'alt_giyim' }),
        createMockClothing({ id: 'c3', category: 'ust_giyim' }),
      ];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: clothes, error: null }));

      const res = await request(app)
        .get('/api/wardrobe/grouped')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.grouped).toBeDefined();
      expect(res.body.total).toBe(3);
    });
  });

  // ==================== POST /api/wardrobe ====================
  describe('POST /api/wardrobe', () => {
    it('should add clothing with photo and AI analysis', async () => {
      const newClothing = createMockClothing({ id: 'new-cloth' });
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: newClothing, error: null }));

      const res = await request(app)
        .post('/api/wardrobe')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', Buffer.from('fake-image'), 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.clothing).toBeDefined();
      expect(res.body.ai_analysis).toBeDefined();
      expect(aiService.analyzeClothing).toHaveBeenCalled();
    });

    it('should return 400 when no file uploaded', async () => {
      mockSupabase.from.mockReturnValue(createChain({ data: mockUser, error: null }));

      const res = await request(app)
        .post('/api/wardrobe')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Fotoğraf gerekli');
    });
  });

  // ==================== PATCH /api/wardrobe/:id ====================
  describe('PATCH /api/wardrobe/:id', () => {
    it('should update clothing metadata', async () => {
      const updated = createMockClothing({ name: 'Updated' });
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: updated, error: null }));

      const res = await request(app)
        .patch('/api/wardrobe/cloth-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.clothing).toBeDefined();
    });

    it('should return 404 when clothing not found', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }));

      const res = await request(app)
        .patch('/api/wardrobe/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ==================== PATCH /api/wardrobe/:id/status ====================
  describe('PATCH /api/wardrobe/:id/status', () => {
    it('should update status to valid value', async () => {
      const updated = createMockClothing({ status: 'kirli' });
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: updated, error: null }));

      const res = await request(app)
        .patch('/api/wardrobe/cloth-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'kirli' });

      expect(res.status).toBe(200);
    });

    it('should reject invalid status value', async () => {
      mockSupabase.from.mockReturnValue(createChain({ data: mockUser, error: null }));

      const res = await request(app)
        .patch('/api/wardrobe/cloth-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Geçersiz durum');
    });

    it('should accept all valid status values', async () => {
      const statuses = ['temiz', 'kirli', 'utusuz', 'tamir_gerekli', 'kuru_temizleme'];

      for (const status of statuses) {
        mockSupabase.from.mockReset();
        mockSupabase.from
          .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
          .mockReturnValueOnce(createChain({ data: createMockClothing({ status }), error: null }));

        const res = await request(app)
          .patch('/api/wardrobe/cloth-1/status')
          .set('Authorization', `Bearer ${token}`)
          .send({ status });

        expect(res.status).toBe(200);
      }
    });
  });

  // ==================== DELETE /api/wardrobe/:id ====================
  describe('DELETE /api/wardrobe/:id', () => {
    it('should delete clothing', async () => {
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }));

      const res = await request(app)
        .delete('/api/wardrobe/cloth-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Kıyafet silindi');
    });
  });

  // ==================== GET /api/wardrobe/stats ====================
  describe('GET /api/wardrobe/stats', () => {
    it('should return wardrobe statistics', async () => {
      const clothes = [
        createMockClothing({ times_worn: 10, is_favorite: true }),
        createMockClothing({ id: 'c2', times_worn: 0, category: 'alt_giyim' }),
        createMockClothing({ id: 'c3', times_worn: 5, status: 'kirli' }),
      ];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: clothes, error: null }));

      const res = await request(app)
        .get('/api/wardrobe/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.total).toBe(3);
      expect(res.body.stats.favorites).toBe(1);
      expect(res.body.stats.never_worn).toBe(1);
    });
  });

  // ==================== POST /api/wardrobe/bulk-add ====================
  describe('POST /api/wardrobe/bulk-add', () => {
    it('should add multiple items', async () => {
      const items = [
        { category: 'ust_giyim', color: 'mavi', suggested_name: 'Tişört' },
        { category: 'alt_giyim', color: 'siyah', suggested_name: 'Jean' },
      ];
      const addedData = items.map((item, i) => createMockClothing({ id: `added-${i}`, ...item }));

      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: addedData, error: null }));

      const res = await request(app)
        .post('/api/wardrobe/bulk-add')
        .set('Authorization', `Bearer ${token}`)
        .send({ items });

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(2);
    });

    it('should return 400 with empty items array', async () => {
      mockSupabase.from.mockReturnValue(createChain({ data: mockUser, error: null }));

      const res = await request(app)
        .post('/api/wardrobe/bulk-add')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });
  });
});
