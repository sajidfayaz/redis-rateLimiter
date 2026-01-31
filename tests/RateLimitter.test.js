const RateLimiter = require('../src/RateLimiter');

describe('RateLimiter Constructor', () => {
    test('throws error when redis is null', () => {
        expect(() => {
            new RateLimiter(null);
        }).toThrow('Redis client is required');
    });

    test('throws error when windowMs is negative', () => {
        const mockRedis = {isOpen: true};

        expect(() => {
            new RateLimiter(mockRedis, {windowMs: -1000});
        }).toThrow('windowMs must be a positive number');
    });

    test('sets default values correctly', () => {
        const mockRedis = {isOpen: true};
        const limiter = new RateLimiter(mockRedis);

        expect(limiter.windowMs).toBe(60000);
        expect(limiter.maxRequests).toBe(100);
        expect(limiter.keyPrefix).toBe('rateLimit');
    });

});
