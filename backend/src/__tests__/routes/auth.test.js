const request = require('supertest');
const { mockSupabase, createChain } = require('../helpers/mockSupabase');
const { createMockUser, createValidToken } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);

const app = require('../../server');
const { invalidateUserCache } = require('../../middleware/auth');

describe('Auth Routes', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
    invalidateUserCache();
  });

  // ==================== POST /api/auth/register ====================
  describe('POST /api/auth/register', () => {
    const validBody = {
      email: 'new@test.com',
      password: '123456',
      fullName: 'New User',
    };

    it('should return 201 with user and token on success', async () => {
      // First call: check existing email -> not found
      const existingChain = createChain({ data: null, error: { code: 'PGRST116' } });
      mockSupabase.from.mockReturnValueOnce(existingChain);

      // Second call: insert user
      const newUser = { id: 'new-user-id', email: 'new@test.com', full_name: 'New User', is_premium: false };
      const insertChain = createChain({ data: newUser, error: null });
      mockSupabase.from.mockReturnValueOnce(insertChain);

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    });

    it('should return 409 when email already exists', async () => {
      const existingChain = createChain({ data: { id: 'existing-id' }, error: null });
      mockSupabase.from.mockReturnValueOnce(existingChain);

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Bu email zaten kayıtlı');
    });

    it('should return 400 on validation failure', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Geçersiz veri');
    });
  });

  // ==================== POST /api/auth/login ====================
  describe('POST /api/auth/login', () => {
    it('should return 200 with user (without password_hash) and token', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('123456', 4); // Use low cost for test speed

      const userWithHash = {
        id: 'user-123',
        email: 'test@test.com',
        full_name: 'Test User',
        is_premium: false,
        password_hash: hash,
      };

      const chain = createChain({ data: userWithHash, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.token).toBeDefined();
    });

    it('should return 401 when user not found', async () => {
      const chain = createChain({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValue(chain);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: '123456' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Geçersiz email veya şifre');
    });

    it('should return 401 on wrong password', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 4);

      const chain = createChain({
        data: { id: 'user-123', email: 'test@test.com', password_hash: hash },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chain);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Geçersiz email veya şifre');
    });
  });

  // ==================== GET /api/auth/me ====================
  describe('GET /api/auth/me', () => {
    it('should return 200 with user profile', async () => {
      const mockUser = createMockUser();
      const token = createValidToken(mockUser.id);

      // Auth middleware DB lookup
      const chain = createChain({ data: mockUser, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(mockUser.id);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });
});
