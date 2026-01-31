class RateLimiter {
    constructor (redis, options ={}) {
        
        if(!redis) {
            throw new Error('Redis client is required');
        }

        this.redis = redis;
        this.windowMs = options.windowMs || 60000;
        this.maxRequests = options.maxRequests || 100;
        this.keyPrefix = options.keyPrefix || 'rateLimit';

        if(this.windowMs <= 0) {
            throw new Error('windowMs must be a positive number');
        }

        if(this.maxRequests <= 0) {
            throw new Error('maxRequests must be a positive number');
        }
        
    }
}

module.exports = RateLimiter