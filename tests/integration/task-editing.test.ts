import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeProject, makeUser } from '../helpers/factories'
import { signedInAs } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

async function patchTask(projectId: string, taskId: string, payload: Record<string, unknown>) {
  const { PATCH } = await import('@/app/api/projects/[id]/tasks/[taskId]/route')
  return PATCH(
    jsonRequest('/x', { method: 'PATCH', body: payload }),
    { params: { id: projectId, taskId } }
  )
}

async function createTask(projectId: string, payload: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/projects/[id]/tasks/route')
  const res = await POST(
    jsonRequest('/x', { method: 'POST', body: { title: 'Analyse the survey data', ...payload } }),
    { params: { id: projectId } }
  )
  return res
}

/** A PI, a contributor, an outsider and one task, with the PI signed in. */
async function setup(taskFields: Record<string, unknown> = {}) {
  const pi       = await makeUser({ name: 'Priya PI' })
  const helper   = await makeUser({ name: 'Hana Helper' })
  const outsider = await makeUser({ name: 'Otto Outsider' })
  const project  = await makeProject(pi, {
    members: [{ userId: helper._id, role: 'contributor' }],
  })

  await signedInAs(pi)
  const task = await body(await createTask(project._id.toString(), taskFields))

  return {
    pi, helper, outsider,
    projectId: project._id.toString(),
    taskId:    task._id as string,
  }
}

const notifications = async () =>
  (await import('@/lib/db/models/Notification')).default

describe('PATCH /api/projects/[id]/tasks/[taskId]', () => {
  it('edits the fields it is given and leaves the rest alone', async () => {
    const { projectId, taskId } = await setup({
      description: 'The original plan',
      priority:    'low',
    })

    const res = await patchTask(projectId, taskId, {
      title:    'Analyse the interview data',
      priority: 'high',
    })
    const task = await body(res)

    expect(res.status).toBe(200)
    expect(task.title).toBe('Analyse the interview data')
    expect(task.priority).toBe('high')
    expect(task.description).toBe('The original plan')
    expect(task.status).toBe('todo')
  })

  it('rejects a title that is only whitespace', async () => {
    const { projectId, taskId } = await setup()

    const res = await patchTask(projectId, taskId, { title: '   ' })

    expect(res.status).toBe(422)
    expect((await body(res)).error.fieldErrors.title).toBeTruthy()
  })

  it('rejects an empty patch rather than touching the task', async () => {
    const { projectId, taskId } = await setup()

    expect((await patchTask(projectId, taskId, {})).status).toBe(422)
  })

  it('refuses an assignee who is not on the project', async () => {
    const { projectId, taskId, outsider } = await setup()

    const res = await patchTask(projectId, taskId, { assigneeId: outsider._id.toString() })

    expect(res.status).toBe(422)
    expect((await body(res)).error.fieldErrors.assigneeId).toBeTruthy()
  })

  it('answers 422, not 500, when the assignee id is malformed', async () => {
    // Regression: any string reached Mongoose and blew up as a cast error.
    const { projectId, taskId } = await setup()

    const res = await patchTask(projectId, taskId, { assigneeId: 'not-an-id' })

    expect(res.status).toBe(422)
  })

  it('answers 422, not 500, when the due date is unparseable', async () => {
    const { projectId, taskId } = await setup()

    const res = await patchTask(projectId, taskId, { dueDate: 'next Thursday-ish' })

    expect(res.status).toBe(422)
  })

  it('clears the assignee, the due date and the description with null', async () => {
    const { projectId, taskId, helper } = await setup({
      description: 'The original plan',
      assigneeId:  undefined,
      dueDate:     '2026-10-01',
    })
    await patchTask(projectId, taskId, { assigneeId: helper._id.toString() })

    const res  = await patchTask(projectId, taskId, {
      assigneeId:  null,
      dueDate:     null,
      description: null,
    })
    const task = await body(res)

    expect(res.status).toBe(200)
    expect(task.assigneeId).toBeFalsy()
    expect(task.dueDate).toBeFalsy()
    expect(task.description).toBe('')
  })

  it('notifies a new assignee once, and not again on later saves', async () => {
    // Regression: every save carrying an assigneeId re-notified them.
    const { projectId, taskId, helper } = await setup()
    const Notification = await notifications()

    await patchTask(projectId, taskId, { assigneeId: helper._id.toString() })
    expect(await Notification.countDocuments({ type: 'task-assigned' })).toBe(1)

    await patchTask(projectId, taskId, {
      assigneeId: helper._id.toString(),
      title:      'Analyse the interview data',
    })
    expect(await Notification.countDocuments({ type: 'task-assigned' })).toBe(1)
  })

  it('never notifies someone who assigned the task to themselves', async () => {
    const { projectId, taskId, pi } = await setup()

    await patchTask(projectId, taskId, { assigneeId: pi._id.toString() })

    expect(await (await notifications()).countDocuments()).toBe(0)
  })

  it('lets a contributor edit, and refuses an outsider', async () => {
    const { projectId, taskId, helper, outsider } = await setup()

    await signedInAs(helper)
    expect((await patchTask(projectId, taskId, { status: 'in-progress' })).status).toBe(200)

    await signedInAs(outsider)
    expect((await patchTask(projectId, taskId, { status: 'done' })).status).toBe(403)
  })

  it('404s on a task from another project', async () => {
    const { pi, projectId } = await setup()
    const other = await setup()

    await signedInAs(pi) // the second setup signed in as its own PI
    const res = await patchTask(projectId, other.taskId, { status: 'done' })

    expect(res.status).toBe(404)
  })

  it('404s on an id that matches no task', async () => {
    const { projectId } = await setup()

    const res = await patchTask(projectId, new mongoose.Types.ObjectId().toString(), { status: 'done' })

    expect(res.status).toBe(404)
  })
})

describe('POST /api/projects/[id]/tasks', () => {
  it('refuses an assignee who is not on the project', async () => {
    const { projectId, outsider } = await setup()

    const res = await createTask(projectId, { assigneeId: outsider._id.toString() })

    expect(res.status).toBe(422)
    expect((await body(res)).error.fieldErrors.assigneeId).toBeTruthy()
  })

  it('answers 422, not 500, when the assignee id is malformed', async () => {
    const { projectId } = await setup()

    expect((await createTask(projectId, { assigneeId: 'nope' })).status).toBe(422)
  })
})
