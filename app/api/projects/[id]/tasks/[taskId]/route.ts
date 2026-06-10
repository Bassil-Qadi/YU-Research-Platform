import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import { z } from 'zod'
import { createNotifications } from '@/lib/notifications'

type Params = { params: { id: string; taskId: string } }

const updateTaskSchema = z.object({
  title:       z.string().min(1).max(300).trim().optional(),
  description: z.string().max(2000).optional(),
  status:      z.enum(['todo', 'in-progress', 'in-review', 'done']).optional(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  assigneeId:  z.string().nullable().optional(),
  dueDate:     z.string().nullable().optional(),
  order:       z.number().optional(),
})

async function isMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return (project as any).members.some((m: any) => m.userId.toString() === userId)
}

// PATCH /api/projects/[id]/tasks/[taskId]
export async function PATCH(req: NextRequest, { params }: Params) {
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
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const updateData: any = { ...parsed.data }
    if (parsed.data.dueDate) updateData.dueDate = new Date(parsed.data.dueDate)
    if (parsed.data.dueDate === null) updateData.dueDate = null

    const task = await Task.findOneAndUpdate(
      { _id: params.taskId, projectId: params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('assigneeId', 'name avatarUrl')
      .populate('createdBy',  'name')
      .lean()

    // Emit via Socket.io
    const io = (global as any).io
    if (io) io.to(`project:${params.id}`).emit('task-updated', task)

  if (
    parsed.data.assigneeId &&
    parsed.data.assigneeId !== session.user.id
  ) {
    await createNotifications({
      userIds: [parsed.data.assigneeId],
      type:    'task-assigned',
      title:   'You were assigned a task',
      body:    `You've been assigned: "${task?.title}"`,
      link:    `/projects/${params.id}`,
    })
  }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
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

    if (!await isMember(params.id, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const task = await Task.findOneAndDelete({
      _id:       params.taskId,
      projectId: params.id,
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const io = (global as any).io
    if (io) io.to(`project:${params.id}`).emit('task-deleted', { taskId: params.taskId })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/tasks/[taskId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}