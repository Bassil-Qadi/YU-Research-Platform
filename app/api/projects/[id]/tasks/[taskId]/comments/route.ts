import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import TaskComment from '@/lib/db/models/TaskComment'
import { taskForMember } from '@/lib/projects/task-access'
import { commentSchema } from '@/lib/validations/project'
import { createNotifications } from '@/lib/notifications'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

type Params = { params: { id: string; taskId: string } }

// GET /api/projects/[id]/tasks/[taskId]/comments
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const access = await taskForMember(params.id, params.taskId, session.user.id)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const comments = await TaskComment.find({ taskId: params.taskId })
      .sort({ createdAt: 1 })
      .populate('authorId', 'name avatarUrl')
      .lean()

    return NextResponse.json({ comments, canModerate: access.canModerate })
  } catch (err) {
    console.error('[GET /api/projects/[id]/tasks/[taskId]/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/tasks/[taskId]/comments
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verdict = await rateLimit(`comment:${session.user.id}`, RATE_LIMITS.comment)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many comments. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    await connectDB()

    const access = await taskForMember(params.id, params.taskId, session.user.id)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body   = await req.json().catch(() => ({}))
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const comment = await TaskComment.create({
      taskId:    params.taskId,
      projectId: params.id,
      authorId:  session.user.id,
      content:   parsed.data.content,
    })
    const populated = await comment.populate('authorId', 'name avatarUrl')

    global.io?.to(`project:${params.id}`).emit('task-comment:new', {
      taskId:  params.taskId,
      comment: populated,
    })

    // Everyone with a stake in the thread: whoever it is assigned to, whoever
    // opened it, and anyone who has already joined in — but never the author.
    const earlier = await TaskComment.distinct('authorId', { taskId: params.taskId })
    const recipients = new Set<string>(
      [access.task.assigneeId, access.task.createdBy, ...earlier]
        .filter(Boolean)
        .map((id) => id!.toString())
    )
    recipients.delete(session.user.id)

    if (recipients.size > 0) {
      await createNotifications({
        userIds: Array.from(recipients),
        type:    'task-comment',
        title:   `${session.user.name ?? 'Someone'} commented on "${access.task.title}"`,
        body:    parsed.data.content.slice(0, 140),
        link:    `/projects/${params.id}?task=${params.taskId}`,
      })
    }

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/tasks/[taskId]/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
