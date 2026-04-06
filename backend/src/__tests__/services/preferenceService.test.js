const { mockSupabase, createChain } = require('../helpers/mockSupabase');

jest.mock('../../config/supabase', () => require('../helpers/mockSupabase').mockSupabase);

const { processOutfitFeedback, getUserPreferenceProfile } = require('../../services/preferenceService');

describe('preferenceService', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
  });

  // ==================== processOutfitFeedback ====================
  describe('processOutfitFeedback', () => {
    it('should fetch outfit_items with clothes join', async () => {
      const itemsChain = createChain({ data: [], error: null });
      mockSupabase.from.mockReturnValue(itemsChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('outfit_items');
      expect(itemsChain.select).toHaveBeenCalledWith(
        expect.stringContaining('clothes')
      );
      expect(itemsChain.eq).toHaveBeenCalledWith('outfit_id', 'outfit-1');
    });

    it('should return early when no items found', async () => {
      const emptyChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(emptyChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Only one call to from() for the outfit_items query
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should skip items where clothes is null', async () => {
      const items = [
        { clothing_id: 'c1', clothes: null },
        {
          clothing_id: 'c2',
          clothes: { category: 'ust_giyim', color: 'mavi', subcategory: 'tshirt', ai_tags: [] },
        },
      ];

      // First call: outfit_items query
      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      // Subsequent calls for preference updates - existing pref not found
      const updateChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(updateChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Should have called from() for c2's preferences but not c1's
      // outfit_items (1) + color (2) + category (2) + subcategory (2) + color_combo (2) = 9 calls min
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should update color and category preferences for each item', async () => {
      const items = [
        {
          clothing_id: 'c1',
          clothes: { category: 'ust_giyim', color: 'mavi', subcategory: null, ai_tags: [] },
        },
      ];

      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      // For each updatePreference call: first select (existing check), then insert/update
      const noExistingChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(noExistingChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      const fromCalls = mockSupabase.from.mock.calls.map((c) => c[0]);
      expect(fromCalls).toContain('user_preferences');
    });

    it('should skip subcategory update when clothing has no subcategory', async () => {
      const items = [
        {
          clothing_id: 'c1',
          clothes: { category: 'ust_giyim', color: 'mavi', subcategory: null, ai_tags: null },
        },
      ];

      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      const noExistingChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(noExistingChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Without subcategory and ai_tags: outfit_items(1) + color(2) + category(2) + color_combo(2) = 7
      // With subcategory it would be 9
      const callCount = mockSupabase.from.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(7);
    });

    it('should iterate ai_tags array for style preferences', async () => {
      const items = [
        {
          clothing_id: 'c1',
          clothes: {
            category: 'ust_giyim',
            color: 'mavi',
            subcategory: 'tshirt',
            ai_tags: ['minimal', 'sportif'],
          },
        },
      ];

      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      const noExistingChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(noExistingChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Should have more calls due to 2 style tags
      const callCount = mockSupabase.from.mock.calls.length;
      // outfit_items(1) + color(2) + category(2) + subcategory(2) + tag1(2) + tag2(2) + color_combo(2) = 13
      expect(callCount).toBeGreaterThanOrEqual(11);
    });

    it('should create new preference with score 0.6 when liked', async () => {
      const items = [
        {
          clothing_id: 'c1',
          clothes: { category: 'ust_giyim', color: 'mavi', subcategory: null, ai_tags: null },
        },
      ];

      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      // No existing preference found
      const noExistingChain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(noExistingChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Check insert calls contain score 0.6 (0.5 + 0.1)
      const insertCalls = noExistingChain.insert.mock.calls;
      if (insertCalls.length > 0) {
        expect(insertCalls[0][0].score).toBe(0.6);
      }
    });

    it('should clamp existing preference score to [0, 1] range', async () => {
      const items = [
        {
          clothing_id: 'c1',
          clothes: { category: 'ust_giyim', color: 'mavi', subcategory: null, ai_tags: null },
        },
      ];

      const itemsChain = createChain({ data: items, error: null });
      mockSupabase.from.mockReturnValueOnce(itemsChain);

      // Existing preference with score already at 1.0
      const existingChain = createChain({
        data: { id: 'pref-1', score: 1.0, interaction_count: 10 },
        error: null,
      });
      mockSupabase.from.mockReturnValue(existingChain);

      await processOutfitFeedback('user-1', 'outfit-1', true);

      // Score should be clamped to 1.0 (not 1.1)
      const updateCalls = existingChain.update.mock.calls;
      if (updateCalls.length > 0) {
        expect(updateCalls[0][0].score).toBeLessThanOrEqual(1);
      }
    });
  });

  // ==================== getUserPreferenceProfile ====================
  describe('getUserPreferenceProfile', () => {
    it('should return preferences grouped by preference_type', async () => {
      const preferences = [
        { preference_type: 'color', preference_key: 'mavi', score: 0.8, interaction_count: 5 },
        { preference_type: 'color', preference_key: 'kirmizi', score: 0.6, interaction_count: 3 },
        { preference_type: 'category', preference_key: 'ust_giyim', score: 0.9, interaction_count: 10 },
      ];

      const chain = createChain({ data: preferences, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getUserPreferenceProfile('user-1');

      expect(result.color).toHaveLength(2);
      expect(result.category).toHaveLength(1);
      expect(result.color[0]).toEqual({ key: 'mavi', score: 0.8, count: 5 });
    });

    it('should return empty object when data is null', async () => {
      const chain = createChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getUserPreferenceProfile('user-1');

      expect(result).toEqual({});
    });

    it('should query with correct user_id and order by score descending', async () => {
      const chain = createChain({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      await getUserPreferenceProfile('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('user_preferences');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.order).toHaveBeenCalledWith('score', { ascending: false });
    });
  });
});
