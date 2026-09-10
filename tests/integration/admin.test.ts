import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeUser } from '../helpers/factories'
import { signedInAs, signedOut } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

async function routes() {
  return {
    list:   (await import('@/app/api/admin/users/route')).GET,
    update: (await import('@/app/api/admin/users/[id]/route')).PATCH,
  }
}

const patchUser = async (id: string, changes: Record<string, unknown>) => {
  const { update } = await routes()
  return update(jsonRequest('/x', { method: 'PATCH', body: changes }), { params: { id } })
}

describe('who may use the admin API', () => {
  it('refuses a non-admin and an anonymous caller alike', async () => {
    const admin   = await makeUser({ role: 'Admin' })
    const student = await makeUser({ role: 'Student' })
    const { list } = await routes()

    await signedInAs(student)
    expect((await list(jsonRequest('/x'))).status).toBe(403)
    expect((await patchUser(admin._id.toString(), { status: 'suspended' })).status).toBe(403)

    await signedOut()
    expect((await list(jsonRequest('/x'))).status).toBe(403)
  })

  it('lets an admin in', async () => {
    const admin = await makeUser({ role: 'Admin' })
    await makeUser({})

    await signedInAs(admin)
    const { list } = await routes()
    const res = await list(jsonRequest('/x'))

    expect(res.status).toBe(200)
    expect((await body(res)).users).toHaveLength(2)
  })
})

describe('finding people', () => {
  it('searches name, email and department', async () => {
    const admin = await makeUser({ role: 'Admin', name: 'The Admin' })
    await makeUser({ name: 'Ada Lovelace', email: 'ada@university.edu', department: 'Maths' })
    await makeUser({ name: 'Grace Hopper', email: 'grace@university.edu', department: 'Computing' })

    await signedInAs(admin)
    const { list } = await routes()

    const byName  = await body(await list(jsonRequest('/x?q=Lovelace')))
    const byEmail = await body(await list(jsonRequest('/x?q=grace@')))
    const byDept  = await body(await list(jsonRequest('/x?q=Computing')))

    expect(byName.users.map((u: { name: string }) => u.name)).toEqual(['Ada Lovelace'])
    expect(byEmail.users.map((u: { name: string }) => u.name)).toEqual(['Grace Hopper'])
    expect(byDept.users.map((u: { name: string }) => u.name)).toEqual(['Grace Hopper'])
  })

  it('filters by status and by role', async () => {
    const admin = await makeUser({ role: 'Admin' })
    await makeUser({ status: 'pending' })
    await makeUser({ status: 'suspended' })
    await makeUser({ role: 'Faculty' })

    await signedInAs(admin)
    const { list } = await routes()

    expect((await body(await list(jsonRequest('/x?status=pending')))).users).toHaveLength(1)
    expect((await body(await list(jsonRequest('/x?status=suspended')))).users).toHaveLength(1)
    expect((await body(await list(jsonRequest('/x?role=Faculty')))).users).toHaveLength(1)
  })

  it('ignores an unrecognised filter rather than hiding everyone', async () => {
    const admin = await makeUser({ role: 'Admin' })
    await makeUser({})

    await signedInAs(admin)
    const { list } = await routes()

    // A typo in the query string must not silently show an empty platform.
    const res = await body(await list(jsonRequest('/x?status=banned&role=Wizard')))
    expect(res.users).toHaveLength(2)
  })

  it('reports counts per status and paginates', async () => {
    const admin = await makeUser({ role: 'Admin' })
    for (let i = 0; i < 4; i++) await makeUser({ status: 'pending' })

    await signedInAs(admin)
    const { list } = await routes()

    const first = await body(await list(jsonRequest('/x?limit=2&page=1')))
    expect(first.users).toHaveLength(2)
    expect(first.pagination).toMatchObject({ total: 5, pages: 3 })
    expect(first.counts.pending).toBe(4)
    expect(first.counts.active).toBe(1)

    const last = await body(await list(jsonRequest('/x?limit=2&page=3')))
    expect(last.users).toHaveLength(1)
  })
})

describe('changing an account', () => {
  it('approves, suspends and reinstates', async () => {
    const admin = await makeUser({ role: 'Admin' })
    const user  = await makeUser({ status: 'pending' })
    const id    = user._id.toString()

    await signedInAs(admin)

    expect((await body(await patchUser(id, { status: 'active' }))).status).toBe('active')
    expect((await body(await patchUser(id, { status: 'suspended' }))).status).toBe('suspended')
    expect((await body(await patchUser(id, { status: 'active' }))).status).toBe('active')
  })

  it('sets a role', async () => {
    const admin = await makeUser({ role: 'Admin' })
    const user  = await makeUser({ role: 'Student' })

    await signedInAs(admin)
    const res = await patchUser(user._id.toString(), { role: 'Faculty' })

    expect((await body(res)).role).toBe('Faculty')
  })

  it('records the reason a registration was turned down', async () => {
    const admin = await makeUser({ role: 'Admin' })
    const user  = await makeUser({ status: 'pending' })

    await signedInAs(admin)
    await patchUser(user._id.toString(), { status: 'rejected', reason: 'Not a member of the university' })

    const { User } = await import('@/lib/db/models/user')
    const stored = await User.findById(user._id).lean()
    expect(stored?.rejectionReason).toBe('Not a member of the university')
  })

  it('rejects an unknown status or role', async () => {
    const admin = await makeUser({ role: 'Admin' })
    const user  = await makeUser({})

    await signedInAs(admin)
    expect((await patchUser(user._id.toString(), { status: 'banished' })).status).toBe(422)
    expect((await patchUser(user._id.toString(), { role: 'Wizard' })).status).toBe(422)
    expect((await patchUser(user._id.toString(), {})).status).toBe(422)
  })

  it('404s on an account that does not exist, 400s on a malformed id', async () => {
    const admin = await makeUser({ role: 'Admin' })

    await signedInAs(admin)
    expect((await patchUser(new mongoose.Types.ObjectId().toString(), { status: 'active' })).status).toBe(404)
    expect((await patchUser('nonsense', { status: 'active' })).status).toBe(400)
  })
})

describe('guards against locking everyone out', () => {
  it('refuses to let an admin change their own role or status', async () => {
    const admin = await makeUser({ role: 'Admin' })

    await signedInAs(admin)

    // The classic self-inflicted lockout.
    expect((await patchUser(admin._id.toString(), { role: 'Student' })).status).toBe(409)
    expect((await patchUser(admin._id.toString(), { status: 'suspended' })).status).toBe(409)
  })

  /**
   * Self-protection alone already guarantees an administrator survives: the
   * acting admin cannot target themselves, so they are always still there
   * afterwards. The last-admin check covers the one case that slips past it —
   * a session whose Admin role was revoked in the database but whose token has
   * not yet been revalidated, which is a five minute window.
   */
  it('refuses to remove the last administrator left in the database', async () => {
    const realAdmin = await makeUser({ role: 'Admin' })
    const demoted   = await makeUser({ role: 'Student' })

    // A stale token: the session still claims Admin, the record no longer does.
    await signedInAs({ _id: demoted._id, name: demoted.name, email: demoted.email, role: 'Admin' })

    expect((await patchUser(realAdmin._id.toString(), { role: 'Student' })).status).toBe(409)
    expect((await patchUser(realAdmin._id.toString(), { status: 'suspended' })).status).toBe(409)
  })

  it('allows removing an admin while another one remains', async () => {
    const acting = await makeUser({ role: 'Admin' })
    const spare  = await makeUser({ role: 'Admin' })

    await signedInAs(acting)
    expect((await patchUser(spare._id.toString(), { role: 'Student' })).status).toBe(200)
  })

  it('leaves at least one admin standing however hard you try', async () => {
    const acting = await makeUser({ role: 'Admin' })
    const others = await Promise.all([
      makeUser({ role: 'Admin' }),
      makeUser({ role: 'Admin' }),
    ])

    await signedInAs(acting)
    for (const other of others) {
      await patchUser(other._id.toString(), { status: 'suspended' })
    }
    await patchUser(acting._id.toString(), { status: 'suspended' }) // refused

    const { User } = await import('@/lib/db/models/user')
    expect(await User.countDocuments({ role: 'Admin', status: 'active' })).toBeGreaterThanOrEqual(1)
  })
})
