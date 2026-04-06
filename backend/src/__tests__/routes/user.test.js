const request = require('supertest');
const { mockSupabase, createChain } = require('../helpers/mockSupabase');
const { createMockUser, createValidToken } = require('../helpers/mockData');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);

const app = require('../../server');
const { invalidateUserCache } = require('../../middleware/auth');

describe('User Routes', () => {
  let token;
  const mockUser = createMockUser();

  beforeEach(() => {
    mockSupabase.from.mockReset();
    invalidateUserCache();
    token = createValidToken(mockUser.id);

    // Auth middleware
    const authChain = createChain({ data: mockUser, error: null });
    mockSupabase.from.mockReturnValue(authChain);
  });

  // ==================== PATCH /api/user/profile ====================
  describe('PATCH /api/user/profile', () => {
    it('should update profile successfully', async () => {
      const updatedUser = { ...mockUser, full_name: 'Updated Name', city: 'Ankara' };
      const updateChain = createChain({ data: updatedUser, error: null });
      // First call: auth middleware, second call: profile update
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Updated Name', city: 'Ankara' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('should accept empty body (all fields optional)', async () => {
      mockSupabase.from.mockReturnValue(createChain({ data: mockUser, error: null }));

      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should reject invalid gender value', async () => {
      const res = await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ gender: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== POST /api/user/events ====================
  describe('POST /api/user/events', () => {
    const validEvent = {
      title: 'Düğün',
      eventDate: '2024-06-15',
      occasion: 'ozel',
    };

    it('should create event successfully', async () => {
      const eventData = { id: 'event-1', ...validEvent, user_id: mockUser.id };
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: eventData, error: null }));

      const res = await request(app)
        .post('/api/user/events')
        .set('Authorization', `Bearer ${token}`)
        .send(validEvent);

      expect(res.status).toBe(201);
      expect(res.body.event).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/user/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== GET /api/user/events ====================
  describe('GET /api/user/events', () => {
    it('should return list of upcoming events', async () => {
      const events = [
        { id: 'e1', title: 'Düğün', event_date: '2024-12-01' },
        { id: 'e2', title: 'Toplantı', event_date: '2024-12-15' },
      ];
      mockSupabase.from
        .mockReturnValueOnce(createChain({ data: mockUser, error: null }))
        .mockReturnValueOnce(createChain({ data: events, error: null }));

      const res = await request(app)
        .get('/api/user/events')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toBeDefined();
    });
  });
});
