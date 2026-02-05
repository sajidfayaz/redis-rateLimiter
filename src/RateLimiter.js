class RateLimiter {
    constructor (redis, options ={}) {
        
        if(!redis) {
            throw new Error('Redis client is required');
        }

        this.redis = redis;
        this.windowMs = options.windowMs || 60000;
        this.maxRequests = options.maxRequests || 100;
        this.keyPrefix = options.keyPrefix || 'ratelimit';
        this.failClosed = options.failClosed || false;

        if(this.windowMs <= 0) {
            throw new Error('windowMs must be a positive number');
        }

        if(this.maxRequests <= 0) {
            throw new Error('maxRequests must be a positive number');
        }
    }

    async consume(identifier) {
        if(!identifier) {
            throw new Error('Identifier is required');
        }

        if (typeof identifier !== 'string'){
            throw new Error ('Identifier must be a string');
        }

        const key = `${this.keyPrefix}:${identifier}`;
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if(!this.redis.isOpen) {
            throw new Error('Redis client is not connected');
        }

        try {
            await this.redis.zRemRangeByScore(key, 0, windowStart);
            
            const count = await this.redis.zCard(key);

            if(count < this.maxRequests) {
                const uniqueId = `${now}-${Math.random().toString(36).slice(2, 11)}`;
                await this.redis.zAdd(key, {score: now, value: uniqueId});

                await this.redis.expire(key, Math.ceil(this.windowMs/1000));
                const remaining = this.maxRequests - count - 1;

                return {
                    allowed: true,
                    remaining: remaining,
                    limit: this.maxRequests,
                    resetTime: now + this.windowMs
                };
            } else {
                return {
                    allowed: false,
                    remaining: 0,
                    limit: this.maxRequests,
                    retryAfter: Math.ceil(this.windowMs/1000)
                };
            }
        } catch (error) {
            console.error('Redis error:', error);

            if(this.failClosed) {
                return {
                    allowed: false,
                    remaining: 0,
                    limit: this.maxRequests,
                    error: 'Rate limiter unavailable'
                };
            } else {
                return {
                    allowed: true,
                    remaining: 0,
                    limit: this.maxRequests,
                    degraded: true
                };
            }
        }
    }
}

module.exports = RateLimiter