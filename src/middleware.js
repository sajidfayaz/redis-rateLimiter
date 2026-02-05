/**
 * 
 * @param {RateLimiter} limiter - RateLimiter Instance
 * @param {Object} options - Configuration Options
 * @param {Function} options.keyGenerator - function to extract id from req
 * @param {Function} Express middleware function
*/

function createRateLimitMiddleware(limiter, options = {}) {
    if(!limiter) {
        throw new Error('Rate limiter instance is required');
    }

    const  defaultKeyGenerator = (req) => {
        return req.ip || req.connection.remoteAddress;
    }

    const keyGenerator = options.keyGenerator || defaultKeyGenerator;
    
    return async function rateLimitMiddleware(req, res, next) {
        try {
            const identifier = keyGenerator(req);
            const result = await limiter.consume(identifier);
            
            res.setHeader('X-RateLimit-Limit', result.limit);
            res.setHeader('X-RateLimit-Remaining', result.remaining);
            res.setHeader('X-RateLimit-Reset', result.resetTime);

            if(result.allowed) {
                next();
            } else {
                res.setHeader('RetryAfter', result.retryAfter);
                return res.status(429).json({error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.', retryAfter: result.retryAfter})
            }
        } catch (error) {
            console.error('Rate limit middleware error:', error);
            next(error);
        }
    }
}

module.exports = createRateLimitMiddleware;