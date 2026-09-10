import { MemoryRateLimitStore, type RateLimitStore } from '@/lib/rate-limit/store'
import { RedisRateLimitStore } from '@/lib/rate-limit/redis-store'

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit:    number
  windowMs: number
}

export interface RateLimitVerdict {
  allowed:   boolean
  limit:     number
  remaining: number
  resetAt:   number
  /** Seconds until the caller may retry; only meaningful when blocked. */
  retryAfter: number
}

/** Rules are named so the same limit can be applied consistently. */
export const RATE_LIMITS = {
  /** Creates an account AND sends mail to the applicant and every admin. */
  register:     { limit: 5,  windowMs: 60 * 60 * 1000 },
  /** Slows credential stuffing without locking a real person out for long. */
  login:        { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Mails every PI and co-PI of the project. */
  joinRequest:  { limit: 10, windowMs: 60 * 60 * 1000 },
  /** Third-party storage quota is finite. */
  upload:       { limit: 30, windowMs: 60 * 60 * 1000 },
  /** Person-to-person messages: generous for real use, capped for a script. */
  directMessage: { limit: 60, windowMs: 5 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>

interface RateLimitState {
  memory:           MemoryRateLimitStore
  redis:            RedisRateLimitStore | null
  redisUnavailable: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var rateLimitState: RateLimitState | undefined
}

/**
 * Held on globalThis, the same way the Mongoose connection is: route modules
 * are re-evaluated between requests in development, and a counter that resets
 * on every request is not a rate limit at all.
 */
const state: RateLimitState = global.rateLimitState ?? {
  memory:           new MemoryRateLimitStore(),
  redis:            null,
  redisUnavailable: false,
}
global.rateLimitState = state

function getStores(): RateLimitStore[] {
  const url = process.env.REDIS_URL
  if (!url || state.redisUnavailable) return [state.memory]

  if (!state.redis) state.redis = RedisRateLimitStore.connect(url)
  return [state.redis, state.memory]
}

/**
 * Count a request against `key` and decide whether it may proceed.
 *
 * Deliberately fails *closed on the rule, open on the infrastructure*: if the
 * shared store is unreachable the in-process store still applies the limit, so
 * losing Redis degrades accuracy rather than removing protection.
 */
export async function rateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitVerdict> {
  const [primary, fallback] = getStores()

  let hit
  try {
    hit = await primary.hit(key, rule.windowMs, rule.limit)
  } catch (err) {
    if (primary.name === 'redis') {
      if (!state.redisUnavailable) {
        console.warn(
          '[rate-limit] Redis unreachable, falling back to in-process counting:',
          err instanceof Error ? err.message : err
        )
      }
      state.redisUnavailable = true
    }
    hit = await (fallback ?? state.memory).hit(key, rule.windowMs, rule.limit)
  }

  const allowed = hit.count <= rule.limit

  return {
    allowed,
    limit:      rule.limit,
    remaining:  Math.max(0, rule.limit - hit.count),
    resetAt:    hit.resetAt,
    retryAfter: Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)),
  }
}

/**
 * Best-effort client address. Behind a proxy this is only as trustworthy as the
 * proxy: x-forwarded-for is caller-supplied unless something upstream rewrites
 * it, so treat these limits as friction, not as identity.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  )
}

/** Standard headers so clients can back off intelligently. */
export function rateLimitHeaders(verdict: RateLimitVerdict): Record<string, string> {
  return {
    'RateLimit-Limit':     String(verdict.limit),
    'RateLimit-Remaining': String(verdict.remaining),
    'RateLimit-Reset':     String(Math.ceil((verdict.resetAt - Date.now()) / 1000)),
    ...(verdict.allowed ? {} : { 'Retry-After': String(verdict.retryAfter) }),
  }
}
