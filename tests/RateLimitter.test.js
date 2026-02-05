const RateLimiter = require('../src/RateLimiter');

// Mock Redis client
const createMockRedis = () => {
  const store = new Map();
  
  return {
    isOpen: true,
    
    async zRemRangeByScore(key, min, max) {
      const items = store.get(key) || [];
      const filtered = items.filter(item => item.score < min || item.score > max);
      store.set(key, filtered);
    },
    
    async zCard(key) {
      const items = store.get(key) || [];
      return items.length;
    },
    
    async zAdd(key, member) {
      const items = store.get(key) || [];
      items.push(member);
      store.set(key, items);
    },
    
    async expire(key, seconds) {
      // Mock implementation - in real Redis this auto-deletes
      return true;
    }
  };
};

describe('RateLimiter', () => {
  describe('Constructor', () => {
    test('throws error when redis is null', () => {
      expect(() => new RateLimiter(null)).toThrow('Redis client is required');
    });

    test('throws error when windowMs is negative', () => {
      const mockRedis = createMockRedis();
      expect(() => new RateLimiter(mockRedis, { windowMs: -1000 }))
        .toThrow('windowMs must be a positive number');
    });

    test('throws error when maxRequests is zero', () => {
      const mockRedis = createMockRedis();
      expect(() => new RateLimiter(mockRedis, { maxRequests: 0 }))
        .toThrow('maxRequests must be a positive number');
    });

    test('sets default values correctly', () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis);

      expect(limiter.windowMs).toBe(60000);
      expect(limiter.maxRequests).toBe(100);
      expect(limiter.keyPrefix).toBe('ratelimit');
      expect(limiter.failClosed).toBe(false);
    });
  });

  describe('consume()', () => {
    test('throws error when identifier is missing', async () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis);

      await expect(limiter.consume()).rejects.toThrow('Identifier is required');
      await expect(limiter.consume('')).rejects.toThrow('Identifier is required');
    });

    test('throws error when identifier is not a string', async () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis);

      await expect(limiter.consume(123)).rejects.toThrow('Identifier must be a string');
    });

    test('allows requests under limit', async () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis, {
        windowMs: 1000,
        maxRequests: 5
      });

      const result1 = await limiter.consume('user1');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = await limiter.consume('user1');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    test('blocks requests over limit', async () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis, {
        windowMs: 60000,
        maxRequests: 3
      });

      // Use up all requests
      await limiter.consume('user1');
      await limiter.consume('user1');
      await limiter.consume('user1');

      // Next request should be blocked
      const result = await limiter.consume('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('tracks different users separately', async () => {
      const mockRedis = createMockRedis();
      const limiter = new RateLimiter(mockRedis, {
        windowMs: 60000,
        maxRequests: 2
      });

      // User1 uses their limit
      await limiter.consume('user1');
      await limiter.consume('user1');
      const result1 = await limiter.consume('user1');
      expect(result1.allowed).toBe(false);

      // User2 should still be allowed
      const result2 = await limiter.consume('user2');
      expect(result2.allowed).toBe(true);
    });

    test('fails open when Redis errors and failClosed is false', async () => {
      const mockRedis = createMockRedis();
      mockRedis.zCard = async () => { throw new Error('Redis connection lost'); };
      
      const limiter = new RateLimiter(mockRedis, { failClosed: false });

      const result = await limiter.consume('user1');
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(true);
    });

    test('fails closed when Redis errors and failClosed is true', async () => {
      const mockRedis = createMockRedis();
      mockRedis.zCard = async () => { throw new Error('Redis connection lost'); };
      
      const limiter = new RateLimiter(mockRedis, { failClosed: true });

      const result = await limiter.consume('user1');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Rate limiter unavailable');
    });
  });
});