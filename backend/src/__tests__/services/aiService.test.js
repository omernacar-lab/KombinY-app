const { MockOpenAI, createOpenAIResponse, getCreateMock } = require('../helpers/mockOpenAI');
const { createMockClothing, createMockAiAnalysis, createMockWeather } = require('../helpers/mockData');

jest.mock('openai', () => require('../helpers/mockOpenAI').MockOpenAI);

const { analyzeClothing, generateOutfitSuggestion, analyzeFrameForClothingItems, deduplicateDetectedItems } = require('../../services/aiService');

describe('aiService', () => {
  const mockCreate = getCreateMock();

  beforeEach(() => {
    mockCreate.mockReset();
  });

  // ==================== analyzeClothing ====================
  describe('analyzeClothing', () => {
    it('should parse valid JSON response and return clothing properties', async () => {
      const analysis = createMockAiAnalysis();
      mockCreate.mockResolvedValue(createOpenAIResponse(analysis));

      const result = await analyzeClothing('base64ImageData');

      expect(result).toEqual(analysis);
      expect(result.category).toBe('ust_giyim');
      expect(result.color).toBe('mavi');
    });

    it('should strip markdown code block wrappers from response', async () => {
      const analysis = createMockAiAnalysis();
      const wrappedContent = '```json\n' + JSON.stringify(analysis) + '\n```';
      mockCreate.mockResolvedValue(createOpenAIResponse(wrappedContent));

      const result = await analyzeClothing('base64ImageData');

      expect(result).toEqual(analysis);
    });

    it('should send image as data:image/jpeg;base64 format', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(createMockAiAnalysis()));

      await analyzeClothing('testBase64');

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[1];
      expect(userMessage.content[0].image_url.url).toBe('data:image/jpeg;base64,testBase64');
    });

    it('should use gpt-4o-mini model with temperature 0.3', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(createMockAiAnalysis()));

      await analyzeClothing('testBase64');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.temperature).toBe(0.3);
    });

    it('should propagate error when API call rejects', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      await expect(analyzeClothing('testBase64')).rejects.toThrow('API error');
    });

    it('should throw on invalid JSON response', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse('not valid json'));

      await expect(analyzeClothing('testBase64')).rejects.toThrow();
    });
  });

  // ==================== generateOutfitSuggestion ====================
  describe('generateOutfitSuggestion', () => {
    const baseSuggestion = {
      items: [{ clothing_id: 'cloth-1', reason: 'test' }],
      styling_tip: 'Harika bir kombin!',
      confidence: 0.9,
      alternative_swap: null,
    };

    it('should filter clothes to only temiz and non-archived items', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      const clothes = [
        createMockClothing({ id: 'c1', status: 'temiz', is_archived: false }),
        createMockClothing({ id: 'c2', status: 'kirli', is_archived: false }),
        createMockClothing({ id: 'c3', status: 'temiz', is_archived: true }),
        createMockClothing({ id: 'c4', status: 'temiz', is_archived: false }),
      ];

      await generateOutfitSuggestion({
        clothes,
        weather: createMockWeather(),
        occasion: 'gunluk',
        recentlyWorn: [],
        userPreferences: {},
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userContent = callArgs.messages[1].content;
      // Only c1 and c4 should be in the prompt (temiz + not archived)
      expect(userContent).toContain('c1');
      expect(userContent).not.toContain('c2');
      expect(userContent).not.toContain('c3');
      expect(userContent).toContain('c4');
    });

    it('should map recently worn items to just clothing_id values', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      const recentlyWorn = [
        { clothing_id: 'worn-1', worn_date: '2024-01-01' },
        { clothing_id: 'worn-2', worn_date: '2024-01-02' },
      ];

      await generateOutfitSuggestion({
        clothes: [createMockClothing()],
        weather: createMockWeather(),
        occasion: 'gunluk',
        recentlyWorn,
        userPreferences: {},
      });

      const userContent = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userContent).toContain('worn-1');
      expect(userContent).toContain('worn-2');
    });

    it('should handle null weather gracefully', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      await generateOutfitSuggestion({
        clothes: [createMockClothing()],
        weather: null,
        occasion: 'gunluk',
        recentlyWorn: [],
        userPreferences: {},
      });

      const userContent = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userContent).toContain('Bilinmiyor');
    });

    it('should include avoidColors in prompt when provided', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      await generateOutfitSuggestion({
        clothes: [createMockClothing()],
        weather: createMockWeather(),
        occasion: 'gunluk',
        recentlyWorn: [],
        userPreferences: {},
        avoidColors: ['siyah', 'kahverengi'],
      });

      const userContent = mockCreate.mock.calls[0][0].messages[1].content;
      expect(userContent).toContain('siyah');
      expect(userContent).toContain('kahverengi');
    });

    it('should use temperature 0.7', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      await generateOutfitSuggestion({
        clothes: [createMockClothing()],
        weather: createMockWeather(),
        occasion: 'gunluk',
        recentlyWorn: [],
        userPreferences: {},
      });

      expect(mockCreate.mock.calls[0][0].temperature).toBe(0.7);
    });

    it('should return parsed suggestion object', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse(baseSuggestion));

      const result = await generateOutfitSuggestion({
        clothes: [createMockClothing()],
        weather: createMockWeather(),
        occasion: 'gunluk',
        recentlyWorn: [],
        userPreferences: {},
      });

      expect(result).toEqual(baseSuggestion);
    });
  });

  // ==================== analyzeFrameForClothingItems ====================
  describe('analyzeFrameForClothingItems', () => {
    it('should return array when API returns array', async () => {
      const items = [
        { fingerprint: 'ust_giyim-tshirt-mavi-duz', category: 'ust_giyim' },
        { fingerprint: 'alt_giyim-jean-siyah-duz', category: 'alt_giyim' },
      ];
      mockCreate.mockResolvedValue(createOpenAIResponse(items));

      const result = await analyzeFrameForClothingItems('base64');

      expect(result).toEqual(items);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should wrap single object in array', async () => {
      const item = { fingerprint: 'ust_giyim-tshirt-mavi-duz', category: 'ust_giyim' };
      mockCreate.mockResolvedValue(createOpenAIResponse(item));

      const result = await analyzeFrameForClothingItems('base64');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([item]);
    });

    it('should handle empty array response', async () => {
      mockCreate.mockResolvedValue(createOpenAIResponse([]));

      const result = await analyzeFrameForClothingItems('base64');

      expect(result).toEqual([]);
    });
  });

  // ==================== deduplicateDetectedItems ====================
  describe('deduplicateDetectedItems', () => {
    it('should remove duplicates by fingerprint', () => {
      const items = [
        { fingerprint: 'ust_giyim-tshirt-mavi-duz', name: 'First' },
        { fingerprint: 'ust_giyim-tshirt-mavi-duz', name: 'Second' },
        { fingerprint: 'alt_giyim-jean-siyah-duz', name: 'Third' },
      ];

      const result = deduplicateDetectedItems(items);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('First'); // keeps first occurrence
      expect(result[1].name).toBe('Third');
    });

    it('should be case-insensitive and trim whitespace', () => {
      const items = [
        { fingerprint: 'Ust_Giyim-Tshirt-Mavi-Duz', name: 'First' },
        { fingerprint: '  ust_giyim-tshirt-mavi-duz  ', name: 'Second' },
      ];

      const result = deduplicateDetectedItems(items);

      expect(result).toHaveLength(1);
    });

    it('should skip items with empty or falsy fingerprint', () => {
      const items = [
        { fingerprint: '', name: 'Empty' },
        { fingerprint: null, name: 'Null' },
        { fingerprint: undefined, name: 'Undefined' },
        { fingerprint: 'valid-fp', name: 'Valid' },
      ];

      const result = deduplicateDetectedItems(items);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid');
    });

    it('should return empty array for empty input', () => {
      expect(deduplicateDetectedItems([])).toEqual([]);
    });
  });
});
