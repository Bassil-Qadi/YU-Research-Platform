import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { useDatabase } from '../helpers/db'
import { makeUser } from '../helpers/factories'

useDatabase()

/**
 * MongoDBAdapter writes with the raw driver, so these tests insert the same way
 * rather than through Mongoose — a document created via the model would get the
 * schema defaults and hide the very problem being tested.
 */
async function adapterCreatesUser(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id:           new mongoose.Types.ObjectId(),
    name:          'OAuth Person',
    email:         `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    image:         'https://example.com/avatar.png',
    emailVerified: null,
    ...overrides,
  }

  await mongoose.connection.collection('users').insertOne(doc)
  return doc
}

describe('accounts created by the OAuth adapter', () => {
  it('arrive without the fields the schema would have supplied', async () => {
    const raw = await adapterCreatesUser()
    const stored = await mongoose.connection.collection('users').findOne({ _id: raw._id })

    // This is the premise of the bug: no defaults were applied.
    expect(stored?.universityId).toBeUndefined()
    expect(stored?.status).toBeUndefined()
    expect(stored?.role).toBeUndefined()
  })

  it('does not block a second adapter account on the unique index', async () => {
    // Regression: universityId is unique, and two documents missing it both
    // count as null, so the second OAuth sign-in ever failed to insert.
    const { User } = await import('@/lib/db/models/user')
    await User.syncIndexes()

    await adapterCreatesUser()
    await expect(adapterCreatesUser()).resolves.toBeTruthy()

    expect(await mongoose.connection.collection('users').countDocuments()).toBe(2)
  })

  it('is completed with everything the rest of the app needs', async () => {
    const { completeAdapterUser } = await import('@/lib/auth/oauth')
    const raw = await adapterCreatesUser()

    const completed = await completeAdapterUser(raw._id.toString())

    expect(completed?.universityId).toMatch(/^OAUTH-/)
    expect(completed?.role).toBe('Student')
    expect(completed?.isPublic).toBe(true)
    // Held for approval, exactly like a form registration.
    expect(completed?.status).toBe('pending')
  })

  it('gives each completed account its own universityId', async () => {
    const { completeAdapterUser } = await import('@/lib/auth/oauth')

    const a = await completeAdapterUser((await adapterCreatesUser())._id.toString())
    const b = await completeAdapterUser((await adapterCreatesUser())._id.toString())

    expect(a?.universityId).not.toBe(b?.universityId)
  })

  it('leaves an already-complete account untouched', async () => {
    const { completeAdapterUser } = await import('@/lib/auth/oauth')
    const existing = await makeUser({ role: 'Faculty', status: 'active' })

    const completed = await completeAdapterUser(existing._id.toString())

    expect(completed?.role).toBe('Faculty')
    expect(completed?.status).toBe('active')
    expect(completed?.universityId).toBe(existing.universityId)
  })

  it('reports nothing for an id that does not exist', async () => {
    const { completeAdapterUser } = await import('@/lib/auth/oauth')

    expect(await completeAdapterUser(new mongoose.Types.ObjectId().toString())).toBeNull()
  })
})

describe('who may hold a session', () => {
  it('admits only approved accounts', async () => {
    const { isApproved } = await import('@/lib/auth/oauth')

    expect(isApproved({ status: 'active' })).toBe(true)
    expect(isApproved({ status: 'pending' })).toBe(false)
    expect(isApproved({ status: 'rejected' })).toBe(false)
    expect(isApproved(null)).toBe(false)
    // The shape an adapter account has before it is completed.
    expect(isApproved({ status: undefined } as never)).toBe(false)
  })

  it('turns away a returning user who is not approved', async () => {
    const { oauthSignInAllowed } = await import('@/lib/auth/oauth')

    const pending = await makeUser({ status: 'pending' })
    const active  = await makeUser({ status: 'active' })

    expect(await oauthSignInAllowed(pending._id.toString())).toBe(false)
    expect(await oauthSignInAllowed(active._id.toString())).toBe(true)
  })

  it('lets a first-time account through, to be vetted once created', async () => {
    const { oauthSignInAllowed } = await import('@/lib/auth/oauth')

    // signIn runs before the adapter inserts the row, so there is nothing to
    // check yet; the jwt callback is what refuses the session.
    expect(await oauthSignInAllowed(undefined)).toBe(true)
    expect(await oauthSignInAllowed(new mongoose.Types.ObjectId().toString())).toBe(true)
  })
})
