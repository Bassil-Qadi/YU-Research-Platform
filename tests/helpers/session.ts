import { vi } from 'vitest'
import type mongoose from 'mongoose'
import type { UserRole } from '@/types'

/**
 * Route handlers get their caller from `auth()`. Mocking that one function is
 * enough to exercise the real handler — its permission checks, validation and
 * database work all run for real.
 */
vi.mock('@/auth', () => ({
  auth: vi.fn(async () => null),
}))

type SessionUser = {
  id:    string
  name?: string
  email?: string
  role?: UserRole
}

export async function signedInAs(user: {
  _id:   mongoose.Types.ObjectId
  name?: string
  email?: string
  role?: string
}) {
  const { auth } = await import('@/auth')

  const session = {
    user: {
      id:    user._id.toString(),
      name:  user.name,
      email: user.email,
      role:  (user.role ?? 'Student') as UserRole,
    } satisfies SessionUser,
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  }

  vi.mocked(auth).mockResolvedValue(session as never)
  return session
}

export async function signedOut() {
  const { auth } = await import('@/auth')
  vi.mocked(auth).mockResolvedValue(null as never)
}
