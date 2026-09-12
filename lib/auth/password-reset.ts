import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * How long a reset link is good for. Long enough to find the mail, short
 * enough that an old message in an inbox is not a standing key to the account.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * 32 random bytes, URL-safe. Guessing one is not a realistic attack, so the
 * lookup can be a plain indexed read on the hash.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url')
}

/** What gets stored and looked up. Never store the token itself. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Compare two hashes without leaking, through timing, how much of a prefix
 * matched. Only meaningful where a candidate is compared against a known
 * value; the database lookup itself is already a constant-time index hit.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left  = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MS)
}

/** The link that goes in the email. */
export function resetUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
}
