import { describe, expect, it } from 'vitest'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

async function routes() {
  return {
    list:     (await import('@/app/api/projects/[id]/join-requests/route')).GET,
    create:   (await import('@/app/api/projects/[id]/join-requests/route')).POST,
    review:   (await import('@/app/api/projects/[id]/join-requests/[requestId]/route')).PATCH,
    withdraw: (await import('@/app/api/projects/[id]/join-requests/[requestId]/route')).DELETE,
    transfer: (await import('@/app/api/projects/[id]/transfer-pi/route')).POST,
  }
}

async function ask(projectId: string, message = 'let me in') {
  const { create } = await routes()
  return create(jsonRequest('/x', { method: 'POST', body: { message } }), {
    params: { id: projectId },
  })
}

describe('requesting to join', () => {
  it('lets an outsider ask, and tells the project leads', async () => {
    const pi        = await makeUser({})
    const coPi      = await makeUser({})
    const applicant = await makeUser({ name: 'Ada' })
    const project   = await makeProject(pi, { members: [{ userId: coPi._id, role: 'co-pi' }] })

    await signedInAs(applicant)
    expect((await ask(project._id.toString())).status).toBe(201)

    const Notification = (await import('@/lib/db/models/Notification')).default
    const notified = (await Notification.find({ type: 'join-request' }).lean())
      .map((n) => n.userId.toString())

    expect(notified).toHaveLength(2)
    expect(notified).toContain(pi._id.toString())
    expect(notified).toContain(coPi._id.toString())
  })

  it('refuses a second request while one is pending', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi)

    await signedInAs(applicant)
    await ask(project._id.toString())

    expect((await ask(project._id.toString())).status).toBe(409)
  })

  it('refuses someone who is already a member', async () => {
    const pi      = await makeUser({})
    const project = await makeProject(pi)

    await signedInAs(pi)
    expect((await ask(project._id.toString())).status).toBe(409)
  })

  it('hides private projects behind a 404 rather than a 403', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi, { visibility: 'private' })

    await signedInAs(applicant)
    // 404, not 403: confirming the project exists would leak it.
    expect((await ask(project._id.toString())).status).toBe(404)
  })

  it('refuses a project that has finished', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi, { status: 'completed' })

    await signedInAs(applicant)
    expect((await ask(project._id.toString())).status).toBe(409)
  })
})

describe('the review queue', () => {
  it('is visible to project leads and nobody else', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const outsider  = await makeUser({})
    const project   = await makeProject(pi)
    const projectId = project._id.toString()

    await signedInAs(applicant)
    await ask(projectId)

    const { list } = await routes()

    await signedInAs(outsider)
    expect((await list(jsonRequest('/x'), { params: { id: projectId } })).status).toBe(403)

    await signedInAs(pi)
    const res = await list(jsonRequest('/x'), { params: { id: projectId } })
    expect(res.status).toBe(200)
    expect((await body(res)).requests).toHaveLength(1)
  })

  it('lets an applicant see only their own request', async () => {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const bystander = await makeUser({})
    const project   = await makeProject(pi)
    const projectId = project._id.toString()

    await signedInAs(applicant)
    await ask(projectId)

    const { list } = await routes()
    const mine = await list(jsonRequest('/x?mine=true'), { params: { id: projectId } })
    expect((await body(mine)).request).toBeTruthy()

    await signedInAs(bystander)
    const theirs = await list(jsonRequest('/x?mine=true'), { params: { id: projectId } })
    expect((await body(theirs)).request).toBeNull()
  })
})

describe('reviewing a request', () => {
  async function pending() {
    const pi        = await makeUser({})
    const applicant = await makeUser({})
    const project   = await makeProject(pi)
    const projectId = project._id.toString()

    await signedInAs(applicant)
    const created = await ask(projectId)
    const requestId = (await body(created))._id

    return { pi, applicant, projectId, requestId }
  }

  it('adds the member with the role the reviewer chose', async () => {
    const { pi, applicant, projectId, requestId } = await pending()
    const { review } = await routes()

    await signedInAs(pi)
    const res = await review(
      jsonRequest('/x', { method: 'PATCH', body: { status: 'approved', role: 'co-pi' } }),
      { params: { id: projectId, requestId } }
    )
    expect(res.status).toBe(200)

    const Project = (await import('@/lib/db/models/Project')).default
    const updated = await Project.findById(projectId).lean()
    const member = updated?.members.find((m) => m.userId.toString() === applicant._id.toString())

    expect(member?.role).toBe('co-pi')
  })

  it('does not add anyone when declined', async () => {
    const { pi, applicant, projectId, requestId } = await pending()
    const { review } = await routes()

    await signedInAs(pi)
    await review(
      jsonRequest('/x', { method: 'PATCH', body: { status: 'declined', reason: 'Not now' } }),
      { params: { id: projectId, requestId } }
    )

    const Project = (await import('@/lib/db/models/Project')).default
    const updated = await Project.findById(projectId).lean()

    expect(updated?.members.some((m) => m.userId.toString() === applicant._id.toString())).toBe(false)
  })

  it('refuses to review the same request twice', async () => {
    const { pi, projectId, requestId } = await pending()
    const { review } = await routes()

    await signedInAs(pi)
    const approve = () => review(
      jsonRequest('/x', { method: 'PATCH', body: { status: 'approved', role: 'contributor' } }),
      { params: { id: projectId, requestId } }
    )

    expect((await approve()).status).toBe(200)
    expect((await approve()).status).toBe(409)
  })

  it('refuses a reviewer who does not lead the project', async () => {
    const { projectId, requestId } = await pending()
    const outsider = await makeUser({})
    const { review } = await routes()

    await signedInAs(outsider)
    const res = await review(
      jsonRequest('/x', { method: 'PATCH', body: { status: 'approved', role: 'contributor' } }),
      { params: { id: projectId, requestId } }
    )

    expect(res.status).toBe(403)
  })

  it('lets an applicant withdraw their own request but not someone else’s', async () => {
    const { applicant, projectId, requestId } = await pending()
    const stranger = await makeUser({})
    const { withdraw } = await routes()

    await signedInAs(stranger)
    expect((await withdraw(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, requestId },
    })).status).toBe(403)

    await signedInAs(applicant)
    expect((await withdraw(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, requestId },
    })).status).toBe(200)
  })
})

describe('transferring the PI role', () => {
  it('promotes the member and demotes the outgoing PI to co-PI', async () => {
    const pi      = await makeUser({})
    const heir    = await makeUser({})
    const project = await makeProject(pi, { members: [{ userId: heir._id, role: 'contributor' }] })

    await signedInAs(pi)
    const { transfer } = await routes()
    const res = await transfer(
      jsonRequest('/x', { method: 'POST', body: { userId: heir._id.toString() } }),
      { params: { id: project._id.toString() } }
    )
    expect(res.status).toBe(200)

    const Project = (await import('@/lib/db/models/Project')).default
    const updated = await Project.findById(project._id).lean()
    const roleOf = (id: string) =>
      updated?.members.find((m) => m.userId.toString() === id)?.role

    expect(roleOf(heir._id.toString())).toBe('pi')
    expect(roleOf(pi._id.toString())).toBe('co-pi')
  })

  it('refuses a co-PI trying to promote themselves', async () => {
    const pi      = await makeUser({})
    const coPi    = await makeUser({})
    const project = await makeProject(pi, { members: [{ userId: coPi._id, role: 'co-pi' }] })

    await signedInAs(coPi)
    const { transfer } = await routes()
    const res = await transfer(
      jsonRequest('/x', { method: 'POST', body: { userId: coPi._id.toString() } }),
      { params: { id: project._id.toString() } }
    )

    expect(res.status).toBe(403)
  })

  it('refuses handing the project to someone who is not a member', async () => {
    const pi       = await makeUser({})
    const stranger = await makeUser({})
    const project  = await makeProject(pi)

    await signedInAs(pi)
    const { transfer } = await routes()
    const res = await transfer(
      jsonRequest('/x', { method: 'POST', body: { userId: stranger._id.toString() } }),
      { params: { id: project._id.toString() } }
    )

    expect(res.status).toBe(404)
  })

  it('unblocks the PI’s own exit, which is otherwise refused', async () => {
    const pi      = await makeUser({})
    const heir    = await makeUser({})
    const project = await makeProject(pi, { members: [{ userId: heir._id, role: 'contributor' }] })
    const projectId = project._id.toString()

    const { DELETE: removeMember } = await import('@/app/api/projects/[id]/members/route')
    await signedInAs(pi)

    const stuck = await removeMember(
      jsonRequest(`/x?userId=${pi._id.toString()}`, { method: 'DELETE' }),
      { params: { id: projectId } }
    )
    expect(stuck.status).toBe(400)

    const { transfer } = await routes()
    await transfer(
      jsonRequest('/x', { method: 'POST', body: { userId: heir._id.toString() } }),
      { params: { id: projectId } }
    )

    const freed = await removeMember(
      jsonRequest(`/x?userId=${pi._id.toString()}`, { method: 'DELETE' }),
      { params: { id: projectId } }
    )
    expect(freed.status).toBe(200)
  })
})
