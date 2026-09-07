import { describe, expect, it } from 'vitest'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs, signedOut } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

describe('GET /api/users (the researcher directory)', () => {
  it('includes users whose isPublic flag was never set', async () => {
    // Regression: the query matched { isPublic: true }, but the schema default
    // is true, so every user document predating the field was invisible.
    const legacy = await makeUser({ name: 'Legacy User' })
    await legacy.updateOne({ $unset: { isPublic: '' } })
    await makeUser({ name: 'Modern User', isPublic: true })

    await signedInAs(legacy)
    const { GET } = await import('@/app/api/users/route')
    const res = await GET(jsonRequest('/api/users'))

    const names = (await body(res)).users.map((u: { name: string }) => u.name)
    expect(names).toContain('Legacy User')
    expect(names).toContain('Modern User')
  })

  it('leaves out users who opted out explicitly', async () => {
    const viewer = await makeUser({})
    await makeUser({ name: 'Private Person', isPublic: false })

    await signedInAs(viewer)
    const { GET } = await import('@/app/api/users/route')
    const res = await GET(jsonRequest('/api/users'))

    const names = (await body(res)).users.map((u: { name: string }) => u.name)
    expect(names).not.toContain('Private Person')
  })

  it('refuses an anonymous caller', async () => {
    await signedOut()
    const { GET } = await import('@/app/api/users/route')

    expect((await GET(jsonRequest('/api/users'))).status).toBe(401)
  })
})

describe('GET /api/users/[id]', () => {
  it('shows a profile whose isPublic flag was never set', async () => {
    // Same root cause: `!user.isPublic` treated a missing field as private, so
    // legacy profiles returned "This profile is private" to everyone.
    const owner  = await makeUser({ name: 'Legacy Owner' })
    await owner.updateOne({ $unset: { isPublic: '' } })
    const viewer = await makeUser({})

    await signedInAs(viewer)
    const { GET } = await import('@/app/api/users/[id]/route')
    const res = await GET(jsonRequest('/x'), { params: { id: owner._id.toString() } })

    expect(res.status).toBe(200)
  })

  it('hides a profile that opted out, but not from its owner', async () => {
    const owner  = await makeUser({ isPublic: false })
    const viewer = await makeUser({})

    await signedInAs(viewer)
    const { GET } = await import('@/app/api/users/[id]/route')
    expect((await GET(jsonRequest('/x'), { params: { id: owner._id.toString() } })).status).toBe(403)

    await signedInAs(owner)
    expect((await GET(jsonRequest('/x'), { params: { id: owner._id.toString() } })).status).toBe(200)
  })

  it('rejects an id that is not an ObjectId', async () => {
    await signedInAs(await makeUser({}))
    const { GET } = await import('@/app/api/users/[id]/route')

    expect((await GET(jsonRequest('/x'), { params: { id: 'nonsense' } })).status).toBe(400)
  })
})

describe('POST /api/projects/[id]/tasks', () => {
  it('creates a task with no assignee', async () => {
    // Regression: an unassigned task passed [undefined] to createNotifications,
    // which Mongoose rejected — every such request 500ed.
    const pi = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    const { POST } = await import('@/app/api/projects/[id]/tasks/route')
    const res = await POST(
      jsonRequest('/x', { method: 'POST', body: { title: 'Unassigned work' } }),
      { params: { id: project._id.toString() } }
    )

    expect(res.status).toBe(201)
    expect((await body(res)).assigneeId).toBeFalsy()

    const Notification = (await import('@/lib/db/models/Notification')).default
    expect(await Notification.countDocuments()).toBe(0)
  })

  it('notifies a real assignee but never the person assigning', async () => {
    const pi     = await makeUser({})
    const helper = await makeUser({})
    const project = await makeProject(pi, {
      members: [{ userId: helper._id, role: 'contributor' }],
    })

    await signedInAs(pi)
    const { POST } = await import('@/app/api/projects/[id]/tasks/route')

    await POST(
      jsonRequest('/x', { method: 'POST', body: { title: 'For the helper', assigneeId: helper._id.toString() } }),
      { params: { id: project._id.toString() } }
    )
    await POST(
      jsonRequest('/x', { method: 'POST', body: { title: 'For myself', assigneeId: pi._id.toString() } }),
      { params: { id: project._id.toString() } }
    )

    const Notification = (await import('@/lib/db/models/Notification')).default
    const notifications = await Notification.find().lean()

    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId.toString()).toBe(helper._id.toString())
  })

  it('refuses a non-member', async () => {
    const pi       = await makeUser({})
    const outsider = await makeUser({})
    const project  = await makeProject(pi)

    await signedInAs(outsider)
    const { POST } = await import('@/app/api/projects/[id]/tasks/route')
    const res = await POST(
      jsonRequest('/x', { method: 'POST', body: { title: 'Not mine' } }),
      { params: { id: project._id.toString() } }
    )

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('takes the project’s tasks, messages and requests with it', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi)
    const projectId = project._id.toString()

    await signedInAs(pi)
    const { POST: createTask } = await import('@/app/api/projects/[id]/tasks/route')
    await createTask(
      jsonRequest('/x', { method: 'POST', body: { title: 'a task' } }),
      { params: { id: projectId } }
    )

    const { POST: sendMessage } = await import('@/app/api/projects/[id]/messages/route')
    await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: 'a message' } }),
      { params: { id: projectId } }
    )

    await signedInAs(applicant)
    const { POST: askToJoin } = await import('@/app/api/projects/[id]/join-requests/route')
    await askToJoin(
      jsonRequest('/x', { method: 'POST', body: { message: 'please' } }),
      { params: { id: projectId } }
    )

    const Task        = (await import('@/lib/db/models/Task')).default
    const Message     = (await import('@/lib/db/models/Message')).default
    const JoinRequest = (await import('@/lib/db/models/JoinRequest')).default

    expect(await Task.countDocuments({ projectId })).toBe(1)
    expect(await Message.countDocuments({ projectId })).toBe(1)
    expect(await JoinRequest.countDocuments({ projectId })).toBe(1)

    await signedInAs(pi)
    const { DELETE } = await import('@/app/api/projects/[id]/route')
    const res = await DELETE(jsonRequest('/x', { method: 'DELETE' }), { params: { id: projectId } })

    expect(res.status).toBe(200)
    expect(await Task.countDocuments({ projectId })).toBe(0)
    expect(await Message.countDocuments({ projectId })).toBe(0)
    expect(await JoinRequest.countDocuments({ projectId })).toBe(0)
  })

  it('lets only the PI delete', async () => {
    const pi     = await makeUser({})
    const coPi   = await makeUser({})
    const project = await makeProject(pi, { members: [{ userId: coPi._id, role: 'co-pi' }] })

    await signedInAs(coPi)
    const { DELETE } = await import('@/app/api/projects/[id]/route')
    const res = await DELETE(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: project._id.toString() },
    })

    expect(res.status).toBe(403)
  })
})
