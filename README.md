# Redis Rate Limiter

> Production-ready sliding window rate limiter using Redis for Node.js applications

[![npm version](https://img.shields.io/npm/v/@sajidfayaz/redis-ratelimiter.svg)](https://www.npmjs.com/package/@sajidfayaz/redis-ratelimiter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- ✅ **Sliding window algorithm** - Smooth rate limiting without burst allowances
- ✅ **Redis-backed** - Works across multiple servers (distributed)
- ✅ **Express middleware included** - Drop-in solution for Express apps
- ✅ **Configurable fail strategies** - Fail open or closed when Redis is unavailable
- ✅ **Standard HTTP headers** - Sets `X-RateLimit-*` and `Retry-After` headers
- ✅ **Customizable identifiers** - Rate limit by IP, user ID, API key, or custom logic
- ✅ **Production-ready** - Comprehensive error handling and test coverage
- ✅ **TypeScript-friendly** - Works with TypeScript projects

---

## 📦 Installation

```bash
npm install @sajidfayaz/redis-ratelimiter redis
```

**Note:** Requires Redis client v4+. Install it separately if you haven't already.

---

## 🚀 Quick Start

### Basic Usage with Express

```javascript
const express = require('express');
const redis = require('redis');
const { RateLimiter, createRateLimitMiddleware } = require('@sajidfayaz/redis-ratelimiter');

const app = express();

// 1. Create Redis client
const redisClient = redis.createClient({
  url: 'redis://localhost:6379'
});
await redisClient.connect();

// 2. Create rate limiter (100 requests per minute)
const limiter = new RateLimiter(redisClient, {
  windowMs: 60000,      // 1 minute
  maxRequests: 100      // 100 requests per minute
});

// 3. Apply middleware to all routes
app.use(createRateLimitMiddleware(limiter));

// 4. Your routes
app.get('/api/data', (req, res) => {
  res.json({ message: 'Success!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

That's it! Your API is now rate limited. 🎉

---

## 📚 API Reference

### RateLimiter Class

Creates a new rate limiter instance.

```javascript
const limiter = new RateLimiter(redisClient, options);
```

#### Constructor Options

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `windowMs` | number | `60000` | Duration of the sliding window in milliseconds. All requests within this time range are counted toward the limit. |
| `maxRequests` | number | `100` | Maximum number of requests allowed within the sliding window. |
| `keyPrefix` | string | `'ratelimit'` | Prefix used for Redis keys to avoid collisions with other data in Redis. |
| `failClosed` | boolean | `false` | Determines behavior when Redis is unavailable. If `true`, requests are denied. If `false`, requests are allowed. |

#### Methods

##### `consume(identifier)`

Consumes a single request for the given identifier and checks whether it is allowed under the current rate limit.

**Parameters:**
- `identifier` (string): Unique identifier for the client (e.g. IP address, user ID, API key).

**Returns:** A Promise resolving to:

```javascript
{
  allowed: boolean,      // Whether the request is allowed
  remaining: number,     // Number of requests left in the current window
  limit: number,         // Maximum requests allowed per window
  resetTime: number      // Unix timestamp (ms) when the window resets
}
```

---

### Express Middleware

Creates Express middleware for automatic rate limiting.

```javascript
const middleware = createRateLimitMiddleware(limiter, options);
```

#### Middleware Options

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `keyGenerator` | function | `(req) => req.ip` | Function that generates the identifier used for rate limiting based on the request. |

---

## 💡 Usage Examples

### Rate Limit by User ID (Authenticated Routes)

```javascript
app.use('/api/user/*', 
  authenticate,
  createRateLimitMiddleware(limiter, {
    keyGenerator: (req) => req.user.id
  })
);
```

### Rate Limit by API Key

```javascript
app.use('/api/v1/*',
  createRateLimitMiddleware(limiter, {
    keyGenerator: (req) => req.headers['x-api-key']
  })
);
```

### Different Limits for Different Routes

```javascript
// Strict limit for login
const strictLimiter = new RateLimiter(redisClient, {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5
});

app.post('/api/login', 
  createRateLimitMiddleware(strictLimiter),
  loginHandler
);

// Generous limit for public API
const publicLimiter = new RateLimiter(redisClient, {
  windowMs: 60000,
  maxRequests: 1000
});

app.get('/api/public/*',
  createRateLimitMiddleware(publicLimiter),
  publicHandler
);
```

### Manual Usage (Without Middleware)

```javascript
app.post('/api/action', async (req, res) => {
  const identifier = req.user.id;
  const result = await limiter.consume(identifier);

  if (!result.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: result.resetTime
    });
  }

  res.json({ success: true });
});
```

---

## 🔧 How It Works

### Sliding Window Algorithm

Sliding window rate limiting tracks requests over a continuously moving time window instead of fixed intervals. Each request is timestamped, and only requests that occurred within the last `windowMs` milliseconds are counted.

Unlike fixed windows (which reset abruptly and allow bursts at boundaries), sliding windows provide smoother and more accurate rate limiting. This prevents clients from making a large number of requests at the exact moment a window resets.

This implementation uses Redis sorted sets, where each request is stored with its timestamp as the score. Old entries are removed, the current count is checked, and the request is either accepted or rejected atomically.

### Why Redis Sorted Sets?

Redis sorted sets allow efficient range queries by timestamp and automatic ordering. They are ideal for expiring old requests and counting active ones with minimal overhead in a distributed environment.

---

## ⚙️ Configuration

### Fail Open vs Fail Closed

```javascript
// Fail Open (default)
const limiter = new RateLimiter(redisClient, {
  failClosed: false
});

// Fail Closed
const limiter = new RateLimiter(redisClient, {
  failClosed: true
});
```

**Fail closed is recommended for:**
- Financial transactions
- Admin endpoints
- Security-sensitive APIs

**Fail open is recommended for:**
- Public APIs
- Content delivery
- Non-critical endpoints

---

## 📊 Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1738340000
Retry-After: 60
```

---

## 🧪 Testing

```bash
npm test
```

```bash
npm run test:coverage
```

---

## ❓ FAQ

### Why am I getting "Redis client is not connected"?

Ensure you call `await redisClient.connect()` before creating the rate limiter.

### Can I use this with TypeScript?

Yes. The library works seamlessly with TypeScript projects.

### How do I rate limit by both IP and User ID?

```javascript
keyGenerator: (req) => {
  return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
}
```

### What happens if two requests arrive at the same millisecond?

Each request is stored with a unique suffix, ensuring no collisions in Redis.

---

## 🤝 Contributing

Contributions are welcome! Please submit a Pull Request.

## 📄 License

MIT © [Sajid Fayaz](https://github.com/sajidfayaz)

## 🔗 Links

- [GitHub Repository](https://github.com/sajidfayaz/redis-rateLimiter)
- [npm Package](https://www.npmjs.com/package/@sajidfayaz/redis-ratelimiter)
- [Report Issues](https://github.com/sajidfayaz/redis-rateLimiter/issues)

---