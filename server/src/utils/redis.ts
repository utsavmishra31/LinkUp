import Redis from 'ioredis';

// Use a local redis instance by default.
// In production, this would be your ElastiCache or Upstash URL.
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// We disable offlineQueue so that if Redis is down, it fails fast 
// and we can fallback to Postgres gracefully instead of hanging.
export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 50, 2000);
    }
});

redis.on('connect', () => console.log('🟢 Redis Connected (Caching Layer Active)'));
redis.on('error', (err) => console.warn('🟡 Redis Unavailable (Falling back to Postgres direct)'));
