import Redis from 'ioredis';
import { env } from './env';

class CacheService {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private localCache = new Map<string, { value: any; expiresAt: number }>();

  constructor() {
    if (env.redisUrl) {
      try {
        this.redis = new Redis(env.redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy(times) {
            // Stop retrying after 2 attempts in development to prevent hangup
            if (times > 2) return null;
            return Math.min(times * 100, 2000);
          },
        });

        this.redis.on('connect', () => {
          this.isRedisConnected = true;
          console.log('[Cache] Connected to Redis successfully.');
        });

        this.redis.on('error', (err) => {
          this.isRedisConnected = false;
          console.warn('[Cache] Redis offline, utilizing local memory cache fallback. Details:', err.message);
        });
      } catch (error) {
        this.isRedisConnected = false;
        console.warn('[Cache] Failed to initialize Redis. Falling back to local memory cache.');
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error(`[Cache] Redis GET error for key ${key}:`, error);
      }
    }

    // Local fallback
    const cached = this.localCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.localCache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (error) {
        console.error(`[Cache] Redis SET error for key ${key}:`, error);
      }
    }

    // Local fallback
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        console.error(`[Cache] Redis DEL error for key ${key}:`, error);
      }
    }

    // Local fallback
    this.localCache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch (error) {
        console.error(`[Cache] Redis delPattern error:`, error);
      }
    }

    // Local fallback pattern delete (prefix-based)
    const prefix = pattern.replace('*', '');
    for (const key of this.localCache.keys()) {
      if (key.startsWith(prefix)) {
        this.localCache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
