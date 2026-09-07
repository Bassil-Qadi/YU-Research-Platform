import { describe, expect, it } from 'vitest'
import { MemoryRateLimitStore } from '@/lib/rate-limit/store'
import { RATE_LIMITS, clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const RULE = { limit: 5, windowMs: 60_000 }

async function hitTimes(store: MemoryRateLimitStore, key: string, times: number) {
  const counts: number[] = []
  for (let i = 0; i < times; i++) {
    counts.push((await store.hit(key, RULE.windowMs, RULE.limit)).count)
  }
  return counts
}

describe('MemoryRateLimitStore', () => {
  it('counts every request in the window, past the limit', async () => {
    const store = new MemoryRateLimitStore()

    // Regression: the count used to be read after trimming the log to `limit`
    // entries, so it could never exceed the limit and nothing ever blocked.
    expect(await hitTimes(store, 'k', 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 7])
  })

  it('keeps separate keys independent', async () => {
    const store = new MemoryRateLimitStore()
    await hitTimes(store, 'a', 5)

    expect((await store.hit('b', RULE.windowMs, RULE.limit)).count).toBe(1)
  })

  it('lets a window lapse once its entries age out', async () => {
    const store = new MemoryRateLimitStore()
    for (let i = 0; i < 6; i++) await store.hit('k', 100, 5)

    await new Promise((resolve) => setTimeout(resolve, 160))

    expect((await store.hit('k', 100, 5)).count).toBe(1)
  })

  it('reports when the window frees up', async () => {
    const store = new MemoryRateLimitStore()
    const before = Date.now()
    const hit = await store.hit('k', 60_000, 5)

    expect(hit.resetAt).toBeGreaterThanOrEqual(before + 60_000)
  })

  it('forgets a key once reset', async () => {
    const store = new MemoryRateLimitStore()
    await hitTimes(store, 'k', 3)
    await store.reset('k')

    expect((await store.hit('k', RULE.windowMs, RULE.limit)).count).toBe(1)
  })
})

describe('rateLimit', () => {
  it('allows up to the limit then refuses, and counts state across calls', async () => {
    const key = `test-${Math.random()}`
    const verdicts = []
    for (let i = 0; i < 7; i++) verdicts.push(await rateLimit(key, RULE))

    // Regression: module state used to reset between calls, so the limiter
    // silently counted every request as the first one.
    expect(verdicts.map((v) => v.allowed)).toEqual([
      true, true, true, true, true, false, false,
    ])
    expect(verdicts[4].remaining).toBe(0)
    expect(verdicts[5].retryAfter).toBeGreaterThan(0)
  })

  it('exposes limits that are strict enough to matter', () => {
    // Registration writes a row and sends mail to every admin.
    expect(RATE_LIMITS.register.limit).toBeLessThanOrEqual(10)
    expect(RATE_LIMITS.login.limit).toBeLessThanOrEqual(20)
  })
})

describe('rateLimitHeaders', () => {
  it('adds Retry-After only when the caller is blocked', () => {
    const blocked = rateLimitHeaders({
      allowed: false, limit: 5, remaining: 0, resetAt: Date.now() + 5_000, retryAfter: 5,
    })
    const allowed = rateLimitHeaders({
      allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 5_000, retryAfter: 5,
    })

    expect(blocked['Retry-After']).toBe('5')
    expect(allowed['Retry-After']).toBeUndefined()
    expect(allowed['RateLimit-Remaining']).toBe('4')
  })
})

describe('clientIp', () => {
  const req = (headers: Record<string, string>) =>
    new Request('http://localhost/x', { headers })

  it('takes the first entry of x-forwarded-for', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' }))).toBe('203.0.113.5')
  })

  it('falls back through the other proxy headers', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIp(req({ 'cf-connecting-ip': '198.51.100.3' }))).toBe('198.51.100.3')
  })

  it('does not throw when nothing identifies the caller', () => {
    expect(clientIp(req({}))).toBe('unknown')
  })
})
