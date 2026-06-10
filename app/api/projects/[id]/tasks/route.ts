import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import { z } from 'zod'

type Params = { params: { id: string } }

const createTaskSchema = z.object({
  title:       z.string().min(1).max(300).trim(),
  description: z.string().max(2000).optional(),
  status:      z.enum(['todo', 'in-progress', 'in-review', 'done']).default('todo'),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  assigneeId:  z.string().optional(),
  dueDate:     z.string().optional(),
})

async function isMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return (project as any).members.some((m: any) => m.userId.toString() === userId)
}

// GET /api/projects/[id]/tasks
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    if (!await isMember(params.id, session.user.id)) {
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

    if (!await isMember(params.id, session.user.id)) {
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

    const task = await Task.create({
      ...parsed.data,
      projectId: params.id,
      createdBy: session.user.id,
      order:     (lastTask?.order ?? -1) + 1,
      dueDate:   parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    })

    const populated = await task.populate([
      { path: 'assigneeId', select: 'name avatarUrl' },
      { path: 'createdBy',  select: 'name' },
    ])

    // Emit via Socket.io
    const io = (global as any).io
    if (io) io.to(`project:${params.id}`).emit('task-created', populated)

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}