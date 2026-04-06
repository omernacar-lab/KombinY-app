/**
 * Chainable Supabase mock factory.
 * Usage:
 *   const { mockSupabase, createChain } = require('./mockSupabase');
 *   jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);
 *
 *   // In test:
 *   const chain = createChain({ data: [...], error: null });
 *   mockSupabase.from.mockReturnValue(chain);
 */

function createChain(response = { data: null, error: null }) {
  let _response = { ...response };

  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),

    // Make it thenable so `await` resolves to { data, error }
    then: jest.fn((resolve) => resolve(_response)),

    // Allow tests to override response
    __setResponse(data, error = null) {
      _response = { data, error };
    },
  };

  return chain;
}

const mockStorageBucket = {
  upload: jest.fn().mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null }),
  getPublicUrl: jest.fn().mockReturnValue({
    data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/test/path.jpg' },
  }),
  remove: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabase = {
  from: jest.fn(() => createChain()),
  storage: {
    from: jest.fn(() => mockStorageBucket),
  },
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

module.exports = { mockSupabase, createChain, mockStorageBucket };
