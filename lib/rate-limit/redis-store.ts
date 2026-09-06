import Redis from 'ioredis'
import type { RateLimitHit, RateLimitStore } from '@/lib/rate-limit/store'

/**
 * Sliding-window log in a Redis sorted set, so the limit is shared across every
 * instance rather than counted per process.
 *
 * The connection never queues offline commands and never retries a command
 * forever: if Redis is unreachable, hit() throws promptly and the caller falls
 * back to the in-process store rather than leaving a request hanging.
 */
export class RedisRateLimitStore implements RateLimitStore {
  readonly name = 'redis'

  constructor(private client: Redis) {}

  static connect(url: string): RedisRateLimitStore {
    const client = new Redis(url, {
      lazyConnect:          true,
      enableOfflineQueue:   false,
      maxRetriesPerRequest: 1,
      connectTimeout:       1_000,
      // Give up reconnecting quickly; the caller degrades to memory.
      retryStrategy: (attempt) => (attempt > 3 ? null : Math.min(attempt * 200, 1_000)),
    })

    // Without a listener an unreachable Redis raises an unhandled error event.
    client.on('error', () => {})

    return new RedisRateLimitStore(client)
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<RateLimitHit> {
    const now    = Date.now()
    const cutoff = now - windowMs
    const redisKey = `ratelimit:${key}`

    const results = await this.client
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      .zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2, 10)}`)
      .zcard(redisKey)
      .zrange(redisKey, '0', '0', 'WITHSCORES')
      .pexpire(redisKey, windowMs)
      .exec()

    if (!results) throw new Error('Redis transaction returned no result')

    const countEntry  = results[2]
    const oldestEntry = results[3]

    if (countEntry?.[0]) throw countEntry[0]

    const count  = Number(countEntry?.[1] ?? 0)
    const oldest = Array.isArray(oldestEntry?.[1])
      ? Number((oldestEntry[1] as string[])[1])
      : now

    return {
      count,
      resetAt: (Number.isFinite(oldest) ? oldest : now) + windowMs,
    }
  }

  async reset(key: string): Promise<void> {
    await this.client.del(`ratelimit:${key}`)
  }

  async disconnect(): Promise<void> {
    this.client.disconnect()
  }
}
