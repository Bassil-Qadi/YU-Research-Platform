import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../helpers/db'
import { fileRequest, jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs, signedOut } from '../helpers/session'

useDatabase()

afterEach(() => {
  delete process.env.CLOUDINARY_URL
})

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('project files', () => {
  it('refuses a non-member before it mentions configuration', async () => {
    const pi       = await makeUser({})
    const outsider = await makeUser({})
    const project  = await makeProject(pi)

    await signedInAs(outsider)
    const { POST } = await import('@/app/api/projects/[id]/files/route')
    const res = await POST(
      fileRequest('/x', { name: 'a.png', type: 'image/png', content: PNG }),
      { params: { id: project._id.toString() } }
    )

    // Regression: the storage check ran first, so a non-member was told the
    // server was misconfigured rather than that they had no access.
    expect(res.status).toBe(403)
  })

  it('tells a member plainly when storage is not configured', async () => {
    const pi      = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    const { POST } = await import('@/app/api/projects/[id]/files/route')
    const res = await POST(
      fileRequest('/x', { name: 'a.png', type: 'image/png', content: PNG }),
      { params: { id: project._id.toString() } }
    )

    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/not configured/i)
  })

  it('validates the upload before reaching for the network', async () => {
    // Configured, but pointed at a cloud that will never be contacted: every
    // case below is rejected by validation first.
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@example-cloud'

    const pi      = await makeUser({})
    const project = await makeProject(pi)
    const params  = { params: { id: project._id.toString() } }

    await signedInAs(pi)
    const { POST } = await import('@/app/api/projects/[id]/files/route')

    const oversized = await POST(
      fileRequest('/x', {
        name: 'big.txt', type: 'text/plain', content: Buffer.alloc(11 * 1024 * 1024),
      }),
      params
    )
    expect(oversized.status).toBe(413)

    const wrongType = await POST(
      fileRequest('/x', { name: 'evil.exe', type: 'application/x-msdownload', content: 'MZ' }),
      params
    )
    expect(wrongType.status).toBe(415)

    const empty = await POST(
      fileRequest('/x', { name: 'empty.txt', type: 'text/plain', content: Buffer.alloc(0) }),
      params
    )
    expect(empty.status).toBe(422)
  })

  it('shows a member the (empty) file list and refuses everyone else', async () => {
    const pi       = await makeUser({})
    const outsider = await makeUser({})
    const project  = await makeProject(pi)
    const params   = { params: { id: project._id.toString() } }

    const { GET } = await import('@/app/api/projects/[id]/files/route')

    await signedInAs(pi)
    const allowed = await GET(jsonRequest('/x'), params)
    expect(allowed.status).toBe(200)
    expect((await allowed.json()).files).toEqual([])

    await signedInAs(outsider)
    expect((await GET(jsonRequest('/x'), params)).status).toBe(403)

    await signedOut()
    expect((await GET(jsonRequest('/x'), params)).status).toBe(401)
  })
})

describe('avatar uploads', () => {
  it('accepts only images', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@example-cloud'
    const user = await makeUser({})

    await signedInAs(user)
    const { POST } = await import('@/app/api/users/me/avatar/route')
    const res = await POST(
      fileRequest('/x', { name: 'notes.txt', type: 'text/plain', content: 'not an image' })
    )

    expect(res.status).toBe(415)
  })

  it('refuses an anonymous caller', async () => {
    await signedOut()
    const { POST } = await import('@/app/api/users/me/avatar/route')
    const res = await POST(
      fileRequest('/x', { name: 'a.png', type: 'image/png', content: PNG })
    )

    expect(res.status).toBe(401)
  })
})

describe('registration rate limiting', () => {
  it('cuts off a flood from one origin and keeps others working', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    const register = (email: string, ip: string) =>
      POST(jsonRequest('/x', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: {
          name: 'Flood Tester', email, password: 'a-good-password',
          role: 'Student', department: 'Computer Science',
        },
      }))

    const ip = '203.0.113.44'
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      statuses.push((await register(`flood-${i}@university.edu`, ip)).status)
    }

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201])
    expect(statuses.slice(5)).toEqual([429, 429])

    // Only the accepted ones exist: the limiter runs before anything is written.
    const { User } = await import('@/lib/db/models/user')
    expect(await User.countDocuments({ email: /^flood-/ })).toBe(5)

    const elsewhere = await register('elsewhere@university.edu', '198.51.100.9')
    expect(elsewhere.status).toBe(201)
  })

  it('explains how long to wait', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const ip = '203.0.113.99'

    let last: Response | null = null
    for (let i = 0; i < 7; i++) {
      last = await POST(jsonRequest('/x', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: {
          name: 'Flood Tester', email: `wait-${i}@university.edu`, password: 'a-good-password',
          role: 'Student', department: 'Computer Science',
        },
      }))
    }

    expect(last?.status).toBe(429)
    expect(last?.headers.get('retry-after')).toBeTruthy()
    expect(last?.headers.get('ratelimit-limit')).toBe('5')
  })
})
