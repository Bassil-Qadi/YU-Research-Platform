import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDatabase } from '../helpers/db'
import { TEST_PASSWORD, makeUser } from '../helpers/factories'

useDatabase()

/**
 * The credentials provider is the front door. These cover the shape of the
 * regression that made every password work, plus the status gating around it.
 */
type AuthorizeFn = (credentials: unknown, request: unknown) => Promise<unknown>

async function authorizeWith(email: string, password: string) {
  const { getAuthProviders } = await import('@/lib/auth/providers')
  const provider = getAuthProviders().find((p) => 'id' in p && p.id === 'credentials')

  // @auth/core's Credentials() returns a stub `authorize: () => null` and keeps
  // the real configuration on `options`, merging the two at initialisation.
  const authorize = (
    provider as unknown as { options?: { authorize?: AuthorizeFn }; authorize?: AuthorizeFn }
  ).options?.authorize

  if (!authorize) throw new Error('credentials provider exposes no authorize()')

  return authorize(
    { email, password },
    new Request('http://localhost/api/auth/callback/credentials', {
      headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
    })
  )
}

const codeOf = (err: unknown) =>
  (err as { code?: string })?.code ?? (err as Error)?.message

describe('credentials sign-in', () => {
  beforeEach(() => vi.resetModules())

  it('accepts the right password for an active account', async () => {
    const user = await makeUser({ email: 'ada@university.edu', name: 'Ada' })

    const result = await authorizeWith('ada@university.edu', TEST_PASSWORD)

    expect(result).toMatchObject({ id: user._id.toString(), email: 'ada@university.edu' })
  })

  it('rejects the wrong password', async () => {
    await makeUser({ email: 'ada@university.edu' })

    // Regression: the credential check was once commented out, so any password
    // signed anyone in — and an unknown email created an Admin account.
    await expect(authorizeWith('ada@university.edu', 'not-the-password'))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'invalid_credentials')
  })

  it('rejects an unknown address without creating anything', async () => {
    const { User } = await import('@/lib/db/models/user')

    await expect(authorizeWith('nobody@university.edu', 'anything-at-all'))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'invalid_credentials')

    expect(await User.countDocuments()).toBe(0)
  })

  it('rejects an account that has no password set', async () => {
    await makeUser({ email: 'oauth@university.edu', password: null })

    await expect(authorizeWith('oauth@university.edu', 'anything-at-all'))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'invalid_credentials')
  })

  it('holds back a pending account even with the right password', async () => {
    await makeUser({ email: 'pending@university.edu', status: 'pending' })

    await expect(authorizeWith('pending@university.edu', TEST_PASSWORD))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'account_pending')
  })

  it('holds back a rejected account', async () => {
    await makeUser({ email: 'rejected@university.edu', status: 'rejected' })

    await expect(authorizeWith('rejected@university.edu', TEST_PASSWORD))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'account_rejected')
  })

  it('does not leak account status to someone without the password', async () => {
    await makeUser({ email: 'pending@university.edu', status: 'pending' })

    // Status is only revealed after the password is proven, so a wrong password
    // must look identical whether the account is pending or active.
    await expect(authorizeWith('pending@university.edu', 'wrong-password'))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'invalid_credentials')
  })

  it('matches the address case-insensitively', async () => {
    await makeUser({ email: 'ada@university.edu' })

    await expect(authorizeWith('ADA@University.edu', TEST_PASSWORD)).resolves.toBeTruthy()
  })

  it('throttles repeated attempts against one address', async () => {
    await makeUser({ email: 'target@university.edu' })

    const codes: string[] = []
    for (let i = 0; i < 12; i++) {
      try {
        await authorizeWith('target@university.edu', 'wrong-password')
        codes.push('allowed')
      } catch (err) {
        codes.push(codeOf(err) as string)
      }
    }

    expect(codes.slice(0, 10).every((c) => c === 'invalid_credentials')).toBe(true)
    expect(codes.slice(10).every((c) => c === 'too_many_attempts')).toBe(true)
  })
})

describe('session revalidation', () => {
  it('destroys the session of an account that is no longer active', async () => {
    const { revalidateToken } = await import('@/lib/auth/revalidate')
    const user = await makeUser({ email: 'revoked@university.edu', status: 'active' })

    const stale = { id: user._id.toString(), checkedAt: Date.now() - 10 * 60 * 1000 }
    expect(await revalidateToken(stale)).toBeTruthy()

    const { User } = await import('@/lib/db/models/user')
    await User.updateOne({ _id: user._id }, { $set: { status: 'rejected' } })

    expect(await revalidateToken(stale)).toBeNull()
  })

  it('destroys the session of a deleted account', async () => {
    const { revalidateToken } = await import('@/lib/auth/revalidate')
    const user = await makeUser({})
    const id = user._id.toString()

    const { User } = await import('@/lib/db/models/user')
    await User.deleteOne({ _id: user._id })

    expect(await revalidateToken({ id, checkedAt: Date.now() - 10 * 60 * 1000 })).toBeNull()
  })

  it('picks up a role change rather than trusting the old token', async () => {
    const { revalidateToken } = await import('@/lib/auth/revalidate')
    const user = await makeUser({ role: 'Admin' })

    const { User } = await import('@/lib/db/models/user')
    await User.updateOne({ _id: user._id }, { $set: { role: 'Student' } })

    const refreshed = await revalidateToken({
      id: user._id.toString(), role: 'Admin', checkedAt: Date.now() - 10 * 60 * 1000,
    })

    expect(refreshed?.role).toBe('Student')
  })

  it('does not hit the database inside the trust window', async () => {
    const { revalidateToken } = await import('@/lib/auth/revalidate')
    const user = await makeUser({})

    const { User } = await import('@/lib/db/models/user')
    await User.updateOne({ _id: user._id }, { $set: { status: 'rejected' } })

    const fresh = { id: user._id.toString(), checkedAt: Date.now() }
    expect(await revalidateToken(fresh)).toBe(fresh)
  })

  it('rejects a token with no subject at all', async () => {
    const { revalidateToken } = await import('@/lib/auth/revalidate')

    expect(await revalidateToken(null)).toBeNull()
    expect(await revalidateToken({ checkedAt: 0 })).toBeNull()
  })
})

describe('suspended accounts', () => {
  beforeEach(() => vi.resetModules())

  it('cannot sign in, even with the right password', async () => {
    await makeUser({ email: 'suspended@university.edu', status: 'suspended' })

    // Without this, suspension only took effect when the token was next
    // revalidated — and the person could simply sign in again in the meantime.
    await expect(authorizeWith('suspended@university.edu', TEST_PASSWORD))
      .rejects.toSatisfy((e: unknown) => codeOf(e) === 'account_suspended')
  })

  it('can sign in again once reinstated', async () => {
    const user = await makeUser({ email: 'back@university.edu', status: 'suspended' })

    const { User } = await import('@/lib/db/models/user')
    await User.updateOne({ _id: user._id }, { $set: { status: 'active' } })

    await expect(authorizeWith('back@university.edu', TEST_PASSWORD)).resolves.toBeTruthy()
  })
})
