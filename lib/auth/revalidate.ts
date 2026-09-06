import type { JWT } from 'next-auth/jwt'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import type { UserRole } from '@/types'

/**
 * How long a token is trusted before the account behind it is re-read.
 *
 * The session itself lasts 30 days, so without this an admin who rejects or
 * demotes someone would not affect them until the token expired. Re-reading on
 * every request would put a database round trip in front of everything, so the
 * result is trusted for a short interval instead.
 */
const REVALIDATE_AFTER_MS = 5 * 60 * 1000

/**
 * Re-read the account behind a token and either refresh it or destroy it.
 * Returning null tells Auth.js the session is no longer valid.
 *
 * Note this runs wherever the Node-side `auth()` runs — API routes and server
 * components. Middleware uses the edge-safe config and cannot reach the
 * database, so a revoked user may still be routed to a page; the first API call
 * that page makes is what signs them out.
 */
export async function revalidateToken(token: JWT | null): Promise<JWT | null> {
  if (!token) return null

  const userId = (token.id as string | undefined) ?? token.sub
  if (!userId) return null

  const checkedAt = typeof token.checkedAt === 'number' ? token.checkedAt : 0
  if (Date.now() - checkedAt < REVALIDATE_AFTER_MS) return token

  try {
    await connectDB()

    const user = await User.findById(userId)
      .select('name email role status department universityId avatarUrl')
      .lean()

    // Deleted, or no longer permitted to be here.
    if (!user || user.status !== 'active') return null

    return {
      ...token,
      name:         user.name,
      email:        user.email,
      picture:      user.avatarUrl ?? token.picture,
      role:         user.role as UserRole,
      department:   user.department ?? undefined,
      universityId: user.universityId,
      checkedAt:    Date.now(),
    }
  } catch (err) {
    // A database blip should not sign everybody out; keep the existing token
    // and try again on the next request.
    console.error('[auth] failed to revalidate session:', err)
    return token
  }
}
