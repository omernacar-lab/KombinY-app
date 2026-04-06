const {
  validate,
  registerSchema,
  loginSchema,
  outfitSuggestSchema,
  outfitFeedbackSchema,
  eventSchema,
  profileUpdateSchema,
} = require('../../middleware/validate');

describe('validate middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validate() function', () => {
    it('should call next() on valid body', () => {
      req.body = { email: 'test@test.com', password: '123456' };
      validate(loginSchema)(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 with error details on invalid body', () => {
      req.body = {};
      validate(loginSchema)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Geçersiz veri',
          details: expect.any(Array),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should strip unknown fields', () => {
      req.body = { email: 'test@test.com', password: '123456', unknown: 'field' };
      validate(loginSchema)(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should collect all errors (abortEarly: false)', () => {
      req.body = {};
      validate(registerSchema)(req, res, next);

      const details = res.json.mock.calls[0][0].details;
      expect(details.length).toBeGreaterThan(1);
    });
  });

  // ==================== registerSchema ====================
  describe('registerSchema', () => {
    const validBody = {
      email: 'test@test.com',
      password: '123456',
      fullName: 'Test User',
    };

    it('should pass with valid required fields', () => {
      req.body = validBody;
      validate(registerSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with all optional fields', () => {
      req.body = { ...validBody, gender: 'female', birthYear: 1990, city: 'Ankara' };
      validate(registerSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid email', () => {
      req.body = { ...validBody, email: 'invalid' };
      validate(registerSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject short password (< 6 chars)', () => {
      req.body = { ...validBody, password: '12345' };
      validate(registerSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing fullName', () => {
      req.body = { email: 'test@test.com', password: '123456' };
      validate(registerSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid gender', () => {
      req.body = { ...validBody, gender: 'invalid' };
      validate(registerSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should accept valid gender values', () => {
      for (const gender of ['female', 'male', 'other']) {
        req.body = { ...validBody, gender };
        next.mockClear();
        validate(registerSchema)(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  // ==================== loginSchema ====================
  describe('loginSchema', () => {
    it('should pass with valid credentials', () => {
      req.body = { email: 'test@test.com', password: '123456' };
      validate(loginSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing email', () => {
      req.body = { password: '123456' };
      validate(loginSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing password', () => {
      req.body = { email: 'test@test.com' };
      validate(loginSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== outfitSuggestSchema ====================
  describe('outfitSuggestSchema', () => {
    it('should pass with empty body (all optional)', () => {
      req.body = {};
      validate(outfitSuggestSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with valid occasion', () => {
      req.body = { occasion: 'is' };
      validate(outfitSuggestSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid occasion', () => {
      req.body = { occasion: 'invalid' };
      validate(outfitSuggestSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should accept all valid occasion values', () => {
      for (const occasion of ['gunluk', 'is', 'ozel', 'spor', 'gece']) {
        req.body = { occasion };
        next.mockClear();
        res.status.mockClear();
        validate(outfitSuggestSchema)(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  // ==================== outfitFeedbackSchema ====================
  describe('outfitFeedbackSchema', () => {
    it('should pass with liked boolean', () => {
      req.body = { liked: true };
      validate(outfitFeedbackSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with rating in range', () => {
      req.body = { rating: 3 };
      validate(outfitFeedbackSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject rating out of range', () => {
      req.body = { rating: 6 };
      validate(outfitFeedbackSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject rating below minimum', () => {
      req.body = { rating: 0 };
      validate(outfitFeedbackSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== eventSchema ====================
  describe('eventSchema', () => {
    const validEvent = {
      title: 'Düğün',
      eventDate: '2024-06-15',
      occasion: 'ozel',
    };

    it('should pass with valid required fields', () => {
      req.body = validEvent;
      validate(eventSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with optional fields', () => {
      req.body = { ...validEvent, dressCode: 'Resmi', notes: 'Akşam 7' };
      validate(eventSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing title', () => {
      req.body = { eventDate: '2024-06-15', occasion: 'ozel' };
      validate(eventSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid date format', () => {
      req.body = { ...validEvent, eventDate: 'not-a-date' };
      validate(eventSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== profileUpdateSchema ====================
  describe('profileUpdateSchema', () => {
    it('should pass with empty body (all optional)', () => {
      req.body = {};
      validate(profileUpdateSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with valid profile fields', () => {
      req.body = { full_name: 'New Name', city: 'Ankara', gender: 'female' };
      validate(profileUpdateSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass with style_preferences array', () => {
      req.body = { style_preferences: ['minimal', 'klasik'] };
      validate(profileUpdateSchema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid gender', () => {
      req.body = { gender: 'invalid' };
      validate(profileUpdateSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject too short full_name', () => {
      req.body = { full_name: 'A' };
      validate(profileUpdateSchema)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
