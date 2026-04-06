const jwt = require('jsonwebtoken');
const { mockSupabase, createChain } = require('../helpers/mockSupabase');
const { createMockUser, TEST_JWT_SECRET } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);

const { authenticate, invalidateUserCache } = require('../../middleware/auth');

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    mockSupabase.from.mockReset();
    // Clear auth module's internal user cache between tests
    invalidateUserCache();
  });

  describe('authenticate', () => {
    it('should return 401 when no Authorization header', async () => {
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Yetkilendirme gerekli' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when header missing Bearer prefix', async () => {
      req.headers.authorization = 'Token abc123';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Yetkilendirme gerekli' });
    });

    it('should return 401 on invalid JWT token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Geçersiz veya süresi dolmuş token' });
    });

    it('should return 401 when user not found in DB', async () => {
      const token = jwt.sign({ userId: 'not-found' }, TEST_JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      const chain = createChain({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValue(chain);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Geçersiz kullanıcı' });
    });

    it('should set req.user and call next() on success', async () => {
      const mockUser = createMockUser();
      const token = jwt.sign({ userId: mockUser.id }, TEST_JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      const chain = createChain({ data: mockUser, error: null });
      mockSupabase.from.mockReturnValue(chain);

      await authenticate(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use cache for subsequent requests with same user', async () => {
      const mockUser = createMockUser();
      const token = jwt.sign({ userId: mockUser.id }, TEST_JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      const chain = createChain({ data: mockUser, error: null });
      mockSupabase.from.mockReturnValue(chain);

      // First request - hits DB
      await authenticate(req, res, next);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second request - should use cache
      const req2 = { headers: { authorization: `Bearer ${token}` } };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      const next2 = jest.fn();

      await authenticate(req2, res2, next2);
      expect(req2.user).toEqual(mockUser);
      expect(next2).toHaveBeenCalled();
      // Still only 1 call because cached
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateUserCache', () => {
    it('should allow subsequent requests to hit DB after invalidation', async () => {
      const mockUser = createMockUser();
      const token = jwt.sign({ userId: mockUser.id }, TEST_JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      const chain = createChain({ data: mockUser, error: null });
      mockSupabase.from.mockReturnValue(chain);

      // First call caches
      await authenticate(req, res, next);

      // Invalidate
      invalidateUserCache(mockUser.id);

      // Second call should hit DB again
      const req2 = { headers: { authorization: `Bearer ${token}` } };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      await authenticate(req2, res2, jest.fn());

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache when no userId provided', async () => {
      invalidateUserCache();
      // No error thrown
    });
  });
});
