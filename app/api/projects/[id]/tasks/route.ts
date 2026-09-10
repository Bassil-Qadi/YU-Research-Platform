import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import { z } from 'zod'
import { createNotifications } from '@/lib/notifications'
import { isMember } from '@/lib/projects/membership'

type Params = { params: { id: string } }

const createTaskSchema = z.object({
  title:       z.string().trim().min(1).max(300),
  description: z.string().max(2000).optional(),
  status:      z.enum(['todo', 'in-progress', 'in-review', 'done']).default('todo'),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  assigneeId:  z.string().optional(),
  dueDate:     z.string().optional(),
})

async function isProjectMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return isMember(project, userId)
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

    const tasks = await Task.find({ projectId: params.id })
      .sort({ status: 1, order: 1 })
      .populate('assigneeId', 'name avatarUrl')
      .populate('createdBy',  'name')
      .lean()

    return NextResponse.json({ tasks })
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

    if (!await isProjectMember(params.id, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body   = await req.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
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