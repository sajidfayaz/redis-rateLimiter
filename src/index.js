const RateLimiter = require('./RateLimiter');
const createRateLimitMiddleware = require('./middleware');

module.exports = {
  RateLimiter,
  createRateLimitMiddleware,
  default: RateLimiter
};