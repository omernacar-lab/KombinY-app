describe('weatherService', () => {
  let getWeather, getClothingAdvice;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    // Fresh module each test due to module-level cache
    const weatherService = require('../../services/weatherService');
    getWeather = weatherService.getWeather;
    getClothingAdvice = weatherService.getClothingAdvice;
  });

  afterEach(() => {
    delete global.fetch;
  });

  const createFetchResponse = (data, ok = true) => ({
    ok,
    json: jest.fn().mockResolvedValue(data),
  });

  const mockWeatherApiData = {
    main: { temp: 22.4, feels_like: 21.1, humidity: 55 },
    weather: [{ description: 'açık', icon: '01d', main: 'Clear' }],
    wind: { speed: 3.5 },
  };

  // ==================== getWeather ====================
  describe('getWeather', () => {
    it('should construct correct URL with city, TR country, metric units', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(mockWeatherApiData));

      await getWeather('Ankara');

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('q=Ankara');
      expect(calledUrl).toContain(',TR');
      expect(calledUrl).toContain('units=metric');
      expect(calledUrl).toContain('lang=tr');
    });

    it('should default city to Istanbul', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(mockWeatherApiData));

      await getWeather();

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('q=Istanbul');
      expect(calledUrl).toContain(',TR');
    });

    it('should return formatted object with Math.round applied to temps', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(mockWeatherApiData));

      const result = await getWeather('Istanbul');

      expect(result.temp).toBe(22);
      expect(result.feels_like).toBe(21);
      expect(result.humidity).toBe(55);
      expect(result.description).toBe('açık');
      expect(result.condition).toBe('gunesli');
    });

    it('should cache result and return cached data on second call', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(mockWeatherApiData));

      const result1 = await getWeather('Istanbul');
      const result2 = await getWeather('Istanbul');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should use lowercase trimmed city key for cache', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(mockWeatherApiData));

      await getWeather('  ISTANBUL  ');
      await getWeather('istanbul');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on non-OK response', async () => {
      global.fetch.mockResolvedValue(createFetchResponse(null, false));

      await expect(getWeather('Istanbul')).rejects.toThrow('Hava durumu alınamadı');
    });

    it('should propagate fetch errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(getWeather('Istanbul')).rejects.toThrow('Network error');
    });
  });

  // ==================== mapWeatherCondition (tested via getWeather) ====================
  describe('weather condition mapping', () => {
    const conditions = [
      ['Clear', 'gunesli'],
      ['Clouds', 'bulutlu'],
      ['Rain', 'yagmurlu'],
      ['Drizzle', 'ciseleme'],
      ['Thunderstorm', 'firtinali'],
      ['Snow', 'karli'],
      ['Mist', 'sisli'],
      ['Fog', 'sisli'],
      ['Haze', 'puslu'],
    ];

    it.each(conditions)('should map %s to %s', async (main, expected) => {
      const data = {
        ...mockWeatherApiData,
        weather: [{ ...mockWeatherApiData.weather[0], main }],
      };
      global.fetch.mockResolvedValue(createFetchResponse(data));

      const result = await getWeather(`test-${main}`);

      expect(result.condition).toBe(expected);
    });

    it('should return normal for unknown condition', async () => {
      const data = {
        ...mockWeatherApiData,
        weather: [{ ...mockWeatherApiData.weather[0], main: 'Unknown' }],
      };
      global.fetch.mockResolvedValue(createFetchResponse(data));

      const result = await getWeather('test-unknown');

      expect(result.condition).toBe('normal');
    });
  });

  // ==================== getClothingAdvice ====================
  describe('getClothingAdvice', () => {
    it('should return warmth 1-2 for temp >= 30', () => {
      const advice = getClothingAdvice({ temp: 35, condition: 'gunesli' });

      expect(advice.warmth_min).toBe(1);
      expect(advice.warmth_max).toBe(2);
      expect(advice.needs_outerwear).toBe(false);
    });

    it('should return warmth 1-3 for temp 20-29', () => {
      const advice = getClothingAdvice({ temp: 25, condition: 'gunesli' });

      expect(advice.warmth_min).toBe(1);
      expect(advice.warmth_max).toBe(3);
      expect(advice.needs_outerwear).toBe(false);
    });

    it('should return warmth 2-4 with outerwear for temp 10-19', () => {
      const advice = getClothingAdvice({ temp: 15, condition: 'bulutlu' });

      expect(advice.warmth_min).toBe(2);
      expect(advice.warmth_max).toBe(4);
      expect(advice.needs_outerwear).toBe(true);
    });

    it('should return warmth 3-5 with outerwear for temp 0-9', () => {
      const advice = getClothingAdvice({ temp: 5, condition: 'bulutlu' });

      expect(advice.warmth_min).toBe(3);
      expect(advice.warmth_max).toBe(5);
      expect(advice.needs_outerwear).toBe(true);
    });

    it('should return warmth 4-5 with outerwear for temp < 0', () => {
      const advice = getClothingAdvice({ temp: -5, condition: 'karli' });

      expect(advice.warmth_min).toBe(4);
      expect(advice.warmth_max).toBe(5);
      expect(advice.needs_outerwear).toBe(true);
    });

    it('should set rain_gear to true for rain conditions', () => {
      for (const condition of ['yagmurlu', 'ciseleme', 'firtinali']) {
        const advice = getClothingAdvice({ temp: 20, condition });
        expect(advice.rain_gear).toBe(true);
      }
    });

    it('should set rain_gear to false for non-rain conditions', () => {
      for (const condition of ['gunesli', 'bulutlu', 'karli', 'sisli']) {
        const advice = getClothingAdvice({ temp: 20, condition });
        expect(advice.rain_gear).toBe(false);
      }
    });
  });
});
