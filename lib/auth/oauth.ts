import { connectDB } from '@/lib/db/connect'
import { User, type IUser } from '@/lib/db/models/user'
import type { UserRole } from '@/types'

/**
 * MongoDBAdapter writes straight into the users collection with the MongoDB
 * driver, so Mongoose never sees the document: no schema defaults, no
 * validation. An OAuth account therefore lands with no universityId, no status
 * and no role — and universityId carries a unique index, so the *second* such
 * account collided on null and sign-in failed outright.
 *
 * This fills in what the adapter cannot know, after it has created the record.
 */
export async function completeAdapterUser(userId: string): Promise<IUser | null> {
  await connectDB()

  // .lean() deliberately: a hydrated document has the schema defaults applied,
  // so role would read as "Student" even when no such field is stored and this
  // would decide there was nothing to fill in.
  const stored = await User.findById(userId).lean()
  if (!stored) return null

  const missing: Record<string, unknown> = {}

  if (!stored.universityId) {
    missing.universityId = `OAUTH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  // Same gate as a form registration: an administrator decides who gets in.
  if (!stored.status)   missing.status   = 'pending'
  if (!stored.role)     missing.role     = 'Student' satisfies UserRole
  if (stored.isPublic === undefined || stored.isPublic === null) missing.isPublic = true

  if (Object.keys(missing).length === 0) return stored as IUser

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: missing },
    { new: true }
  ).lean()

  return (updated as IUser | null) ?? null
}

/** Only an approved account may hold a session. */
export function isApproved(user: Pick<IUser, 'status'> | null | undefined): boolean {
  return user?.status === 'active'
}

/**
 * Whether an OAuth sign-in may proceed, for an account the adapter has already
 * seen before. A brand-new account does not exist yet at this point, so it is
 * allowed through here and vetted in the jwt callback once it has been created.
 */
export async function oauthSignInAllowed(userId?: string): Promise<boolean> {
  if (!userId) return true

  await connectDB()
  const existing = await User.findById(userId).select('status').lean()

  // Unknown to us yet — createUser has not run. Vetted later.
  if (!existing) return true

  return isApproved(existing as Pick<IUser, 'status'>)
}
