import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

async function makeTask(projectId: string, fields: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/projects/[id]/tasks/route')
  const res = await POST(
    jsonRequest('/x', { method: 'POST', body: { title: 'Analyse the survey data', ...fields } }),
    { params: { id: projectId } }
  )
  return (await body(res))._id as string
}

async function routes() {
  const list = await import('@/app/api/projects/[id]/tasks/[taskId]/comments/route')
  const one  = await import('@/app/api/projects/[id]/tasks/[taskId]/comments/[commentId]/route')
  return { list: list.GET, add: list.POST, edit: one.PATCH, remove: one.DELETE }
}

async function comment(projectId: string, taskId: string, content: string) {
  const { add } = await routes()
  return add(
    jsonRequest('/x', { method: 'POST', body: { content } }),
    { params: { id: projectId, taskId } }
  )
}

/** A project with a PI, a co-PI, two contributors and a task. */
async function setup() {
  const pi       = await makeUser({ name: 'Priya PI' })
  const coPi     = await makeUser({ name: 'Colin CoPI' })
  const alice    = await makeUser({ name: 'Alice' })
  const bob      = await makeUser({ name: 'Bob' })
  const outsider = await makeUser({ name: 'Otto Outsider' })
  const project  = await makeProject(pi, {
    members: [
      { userId: coPi._id,  role: 'co-pi' },
      { userId: alice._id, role: 'contributor' },
      { userId: bob._id,   role: 'contributor' },
    ],
  })
  const projectId = project._id.toString()

  await signedInAs(pi)
  const taskId = await makeTask(projectId, { assigneeId: alice._id.toString() })

  return { pi, coPi, alice, bob, outsider, projectId, taskId }
}

describe('posting and reading', () => {
  it('lets a member comment and everyone in the project read it', async () => {
    const { alice, bob, projectId, taskId } = await setup()

    await signedInAs(alice)
    const res = await comment(projectId, taskId, 'Started on this today')
    expect(res.status).toBe(201)
    expect((await body(res)).authorId.name).toBe('Alice')

    await signedInAs(bob)
    const { list } = await routes()
    const thread = await body(await list(jsonRequest('/x'), { params: { id: projectId, taskId } }))

    expect(thread.comments.map((c: { content: string }) => c.content)).toEqual(['Started on this today'])
  })

  it('returns the thread oldest first', async () => {
    const { alice, bob, projectId, taskId } = await setup()

    await signedInAs(alice)
    await comment(projectId, taskId, 'first')
    await signedInAs(bob)
    await comment(projectId, taskId, 'second')
    await signedInAs(alice)
    await comment(projectId, taskId, 'third')

    const { list } = await routes()
    const thread = await body(await list(jsonRequest('/x'), { params: { id: projectId, taskId } }))
    expect(thread.comments.map((c: { content: string }) => c.content)).toEqual(['first', 'second', 'third'])
  })

  it('keeps non-members out entirely', async () => {
    const { outsider, projectId, taskId } = await setup()
    const { list } = await routes()

    await signedInAs(outsider)
    expect((await list(jsonRequest('/x'), { params: { id: projectId, taskId } })).status).toBe(403)
    expect((await comment(projectId, taskId, 'let me in')).status).toBe(403)
  })

  it('refuses a task borrowed from another project', async () => {
    // A member of project B pairs their own project id with project A's task
    // id. Membership of B is genuine; the task must still be out of reach.
    const { taskId } = await setup()

    const other = await makeUser({})
    const otherProject = await makeProject(other)

    await signedInAs(other)
    const res = await comment(otherProject._id.toString(), taskId, 'sneaking in')
    expect(res.status).toBe(404)
  })

  it('rejects blank and oversized comments', async () => {
    const { alice, projectId, taskId } = await setup()

    await signedInAs(alice)
    expect((await comment(projectId, taskId, '   \n  ')).status).toBe(422)
    expect((await comment(projectId, taskId, 'x'.repeat(2001))).status).toBe(422)
  })

  it('400s on malformed ids', async () => {
    const { alice, projectId } = await setup()

    await signedInAs(alice)
    expect((await comment(projectId, 'nonsense', 'hi')).status).toBe(400)
    expect((await comment('nonsense', new mongoose.Types.ObjectId().toString(), 'hi')).status).toBe(400)
  })
})

describe('who gets told', () => {
  async function notifiedFor(userIds: string[]) {
    const Notification = (await import('@/lib/db/models/Notification')).default
    const rows = await Notification.find({ type: 'task-comment' }).lean()
    return userIds.map((id) => rows.filter((r) => r.userId.toString() === id).length)
  }

  it('tells the assignee and the creator, never the author', async () => {
    const { pi, alice, bob, projectId, taskId } = await setup()
    // pi created the task, alice is assigned; bob comments.

    await signedInAs(bob)
    await comment(projectId, taskId, 'Can I help?')

    const [toPi, toAlice, toBob] = await notifiedFor([
      pi._id.toString(), alice._id.toString(), bob._id.toString(),
    ])
    expect(toPi).toBe(1)
    expect(toAlice).toBe(1)
    expect(toBob).toBe(0)
  })

  it('brings everyone who has joined the thread along', async () => {
    const { coPi, bob, projectId, taskId } = await setup()

    await signedInAs(coPi)
    await comment(projectId, taskId, 'Watching this one')

    await signedInAs(bob)
    await comment(projectId, taskId, 'Reply')

    const [toCoPi] = await notifiedFor([coPi._id.toString()])
    expect(toCoPi).toBe(1) // told about Bob's reply
  })

  it('tells each person once, even when they fill several roles', async () => {
    const { pi, bob, projectId } = await setup()

    // pi both created this task and is assigned to it.
    await signedInAs(pi)
    const own = await makeTask(projectId, { assigneeId: pi._id.toString() })

    await signedInAs(bob)
    await comment(projectId, own, 'one')

    const Notification = (await import('@/lib/db/models/Notification')).default
    const toPi = await Notification.countDocuments({ type: 'task-comment', userId: pi._id })
    expect(toPi).toBe(1)
  })
})

describe('editing', () => {
  it('lets the author edit and marks it edited', async () => {
    const { alice, projectId, taskId } = await setup()
    const { edit } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'Draft thought'))

    const res = await edit(
      jsonRequest('/x', { method: 'PATCH', body: { content: 'Considered thought' } }),
      { params: { id: projectId, taskId, commentId: created._id } }
    )
    const updated = await body(res)

    expect(res.status).toBe(200)
    expect(updated.content).toBe('Considered thought')
    expect(updated.editedAt).toBeTruthy()
  })

  it('does not mark an unchanged save as edited', async () => {
    const { alice, projectId, taskId } = await setup()
    const { edit } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'Same words'))
    const res = await edit(
      jsonRequest('/x', { method: 'PATCH', body: { content: '  Same words  ' } }),
      { params: { id: projectId, taskId, commentId: created._id } }
    )

    expect((await body(res)).editedAt).toBeFalsy()
  })

  it('refuses edits from anyone else — including a PI', async () => {
    const { pi, alice, projectId, taskId } = await setup()
    const { edit } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'My words'))

    // Moderating means removing, not rewording someone else's comment.
    await signedInAs(pi)
    const res = await edit(
      jsonRequest('/x', { method: 'PATCH', body: { content: 'Words I prefer' } }),
      { params: { id: projectId, taskId, commentId: created._id } }
    )
    expect(res.status).toBe(403)
  })
})

describe('deleting', () => {
  it('lets the author delete their own comment', async () => {
    const { alice, projectId, taskId } = await setup()
    const { remove } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'Oops'))
    const res = await remove(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, taskId, commentId: created._id },
    })
    expect(res.status).toBe(200)
  })

  it('lets a PI or co-PI remove anyone’s comment', async () => {
    const { coPi, alice, projectId, taskId } = await setup()
    const { remove } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'Needs moderating'))

    await signedInAs(coPi)
    const res = await remove(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, taskId, commentId: created._id },
    })
    expect(res.status).toBe(200)
  })

  it('refuses another contributor', async () => {
    const { alice, bob, projectId, taskId } = await setup()
    const { remove } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'Mine'))

    await signedInAs(bob)
    const res = await remove(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, taskId, commentId: created._id },
    })
    expect(res.status).toBe(403)
  })

  it('will not touch a comment through the wrong task', async () => {
    const { pi, alice, projectId, taskId } = await setup()
    const { remove } = await routes()

    await signedInAs(alice)
    const created = await body(await comment(projectId, taskId, 'On the first task'))

    await signedInAs(pi)
    const otherTask = await makeTask(projectId)
    const res = await remove(jsonRequest('/x', { method: 'DELETE' }), {
      params: { id: projectId, taskId: otherTask, commentId: created._id },
    })
    expect(res.status).toBe(404)
  })
})

describe('counts and cleanup', () => {
  it('shows each task’s comment count on the board', async () => {
    const { alice, projectId, taskId } = await setup()

    await signedInAs(alice)
    await comment(projectId, taskId, 'one')
    await comment(projectId, taskId, 'two')

    const { GET } = await import('@/app/api/projects/[id]/tasks/route')
    const board = await body(await GET(jsonRequest('/x'), { params: { id: projectId } }))
    const task = board.tasks.find((t: { _id: string }) => t._id === taskId)

    expect(task.commentCount).toBe(2)
  })

  it('deleting a task deletes its comments', async () => {
    const { pi, alice, projectId, taskId } = await setup()

    await signedInAs(alice)
    await comment(projectId, taskId, 'soon gone')

    await signedInAs(pi)
    const { DELETE } = await import('@/app/api/projects/[id]/tasks/[taskId]/route')
    await DELETE(jsonRequest('/x', { method: 'DELETE' }), { params: { id: projectId, taskId } })

    const TaskComment = (await import('@/lib/db/models/TaskComment')).default
    expect(await TaskComment.countDocuments({ taskId })).toBe(0)
  })

  it('deleting a project deletes every comment in it', async () => {
    const { pi, alice, projectId, taskId } = await setup()

    await signedInAs(alice)
    await comment(projectId, taskId, 'soon gone too')

    await signedInAs(pi)
    const { DELETE } = await import('@/app/api/projects/[id]/route')
    await DELETE(jsonRequest('/x', { method: 'DELETE' }), { params: { id: projectId } })

    const TaskComment = (await import('@/lib/db/models/TaskComment')).default
    expect(await TaskComment.countDocuments({ projectId })).toBe(0)
  })
})
