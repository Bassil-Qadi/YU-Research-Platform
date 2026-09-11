import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import TaskComment from '@/lib/db/models/TaskComment'
import mongoose from 'mongoose'
import { createNotifications } from '@/lib/notifications'
import { isMember } from '@/lib/projects/membership'
import { createTaskSchema } from '@/lib/validations/task'

type Params = { params: { id: string } }

async function isProjectMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return isMember(project, userId)
}

/** The project itself, when the caller belongs to it — needed to check assignees. */
async function projectForMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return project && isMember(project, userId) ? project : null
}

// GET /api/projects/[id]/tasks
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    if (!await isProjectMember(params.id, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [tasks, counts] = await Promise.all([
      Task.find({ projectId: params.id })
        .sort({ status: 1, order: 1 })
        .populate('assigneeId', 'name avatarUrl')
        .populate('createdBy',  'name')
        .lean(),
      // One grouped count for the whole board, computed rather than stored on
      // each task: a stored counter drifts the first time two writes race.
      TaskComment.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { projectId: new mongoose.Types.ObjectId(params.id) } },
        { $group: { _id: '$taskId', count: { $sum: 1 } } },
      ]),
    ])

    const byTask = new Map(counts.map((c) => [c._id.toString(), c.count]))

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        ...task,
        commentCount: byTask.get(task._id.toString()) ?? 0,
      })),
    })
  } catch (err) {
    console.error('[GET /api/projects/[id]/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/tasks
export async function POST(req: NextRequest, { params }: Params) {
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

    const body   = await req.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Work can only be handed to someone on the project.
    if (parsed.data.assigneeId && !isMember(project, parsed.data.assigneeId)) {
      return NextResponse.json(
        { error: { fieldErrors: { assigneeId: ['That person is not a member of this project'] } } },
        { status: 422 }
      )
    }

    // Set order to end of column
    const lastTask = await Task.findOne({
      projectId: params.id,
      status:    parsed.data.status,
    }).sort({ order: -1 }).lean()

    // Optional fields are spread in only when set, so an unassigned task is
    // never written with an explicit undefined.
    const { assigneeId, dueDate, ...taskData } = parsed.data

    const task = await Task.create({
      ...taskData,
      projectId: params.id,
      createdBy: session.user.id,
      order:     (lastTask?.order ?? -1) + 1,
      ...(assigneeId ? { assigneeId } : {}),
      ...(dueDate    ? { dueDate: new Date(dueDate) } : {}),
    })

    const populated = await task.populate([
      { path: 'assigneeId', select: 'name avatarUrl' },
      { path: 'createdBy',  select: 'name' },
    ])

    // Only notify a real assignee, and never the person doing the assigning.
    if (assigneeId && assigneeId !== session.user.id) {
      await createNotifications({
        userIds: [assigneeId],
        type:    'task-assigned',
        title:   'You were assigned a task',
        body:    `You've been assigned: "${task.title}"`,
        link:    `/projects/${params.id}`,
      })
    }

    // Emit via Socket.io
    global.io?.to(`project:${params.id}`).emit('task-created', populated)

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}