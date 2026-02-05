const createRateLimitMiddleware = require('../src/middleware');
const RateLimiter = require('../src/RateLimiter');

// Mock Express req/res/next
const createMockReq = (ip = '192.168.1.1') => ({
  ip,
  connection: { remoteAddress: ip }
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

const createMockNext = () => jest.fn();

describe('Rate Limit Middleware', () => {
  test('throws error if limiter is not provided', () => {
    expect(() => createRateLimitMiddleware()).toThrow('Rate limiter instance is required');
  });

  test('allows request when under limit', async () => {
    const mockRedis = { isOpen: true, zRemRangeByScore: jest.fn(), zCard: jest.fn().mockResolvedValue(0), zAdd: jest.fn(), expire: jest.fn() };
    const limiter = new RateLimiter(mockRedis, { maxRequests: 10 });
    const middleware = createRateLimitMiddleware(limiter);

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks request when over limit', async () => {
    const mockRedis = { isOpen: true, zRemRangeByScore: jest.fn(), zCard: jest.fn().mockResolvedValue(10), zAdd: jest.fn(), expire: jest.fn() };
    const limiter = new RateLimiter(mockRedis, { maxRequests: 10 });
    const middleware = createRateLimitMiddleware(limiter);

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('uses custom keyGenerator', async () => {
    const mockRedis = { isOpen: true, zRemRangeByScore: jest.fn(), zCard: jest.fn().mockResolvedValue(0), zAdd: jest.fn(), expire: jest.fn() };
    const limiter = new RateLimiter(mockRedis);
    
    const customKeyGenerator = (req) => req.userId || 'anonymous';
    const middleware = createRateLimitMiddleware(limiter, { keyGenerator: customKeyGenerator });

    const req = { ...createMockReq(), userId: 'user123' };
    const res = createMockRes();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});