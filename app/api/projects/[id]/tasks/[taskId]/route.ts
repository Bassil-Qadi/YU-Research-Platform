import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import TaskComment from '@/lib/db/models/TaskComment'
import { deleteFile } from '@/lib/storage'
import { createNotifications } from '@/lib/notifications'
import { isMember } from '@/lib/projects/membership'
import { updateTaskSchema } from '@/lib/validations/task'

type Params = { params: { id: string; taskId: string } }

async function isProjectMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return isMember(project, userId)
}

/** The project itself, when the caller belongs to it — needed to check assignees. */
async function projectForMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return project && isMember(project, userId) ? project : null
}

// PATCH /api/projects/[id]/tasks/[taskId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const project = await projectForMember(params.id, session.user.id)
    if (!project) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await Task.findOne({ _id: params.taskId, projectId: params.id })
      .select('assigneeId')
      .lean()
    const previousAssignee = existing?.assigneeId?.toString()

    const body   = await req.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    if (parsed.data.assigneeId && !isMember(project, parsed.data.assigneeId)) {
      return NextResponse.json(
        { error: { fieldErrors: { assigneeId: ['That person is not a member of this project'] } } },
        { status: 422 }
      )
    }

    // null clears a field; undefined was never sent and is left alone.
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value
    }
    if (parsed.data.dueDate) updateData.dueDate = new Date(parsed.data.dueDate)
    if (parsed.data.description === null) updateData.description = ''

    const task = await Task.findOneAndUpdate(
      { _id: params.taskId, projectId: params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('assigneeId', 'name avatarUrl')
      .populate('createdBy',  'name')
      .lean()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Emit via Socket.io
    global.io?.to(`project:${params.id}`).emit('task-updated', task)

    // Announce a *new* assignee, not every save that happens to carry one.
    const newAssignee = parsed.data.assigneeId ?? null

    if (
      newAssignee &&
      newAssignee !== previousAssignee &&
      newAssignee !== session.user.id
    ) {
      await createNotifications({
        userIds: [newAssignee],
        type:    'task-assigned',
        title:   'You were assigned a task',
        body:    `You've been assigned: "${task.title}"`,
        link:    `/projects/${params.id}`,
      })
    }

    return NextResponse.json(task)
  } catch (err) {
    console.error('[PATCH /api/projects/[id]/tasks/[taskId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/tasks/[taskId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    if (!await isProjectMember(params.id, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const task = await Task.findOneAndDelete({
      _id:       params.taskId,
      projectId: params.id,
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Collect before deleting: afterwards there is nothing left to read.
    const attached = await TaskComment.find({
      taskId: params.taskId, attachment: { $exists: true },
    })
      .select('attachment')
      .lean()

    await TaskComment.deleteMany({ taskId: params.taskId })

    await Promise.all(
      attached.flatMap((c) =>
        c.attachment ? [deleteFile(c.attachment.publicId, c.attachment.resourceType)] : []
      )
    )

    global.io?.to(`project:${params.id}`).emit('task-deleted', { taskId: params.taskId })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/tasks/[taskId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}