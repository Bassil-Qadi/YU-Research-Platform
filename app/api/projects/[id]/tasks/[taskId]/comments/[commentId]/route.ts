import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import TaskComment from '@/lib/db/models/TaskComment'
import { taskForMember } from '@/lib/projects/task-access'
import { commentSchema } from '@/lib/validations/project'

type Params = { params: { id: string; taskId: string; commentId: string } }

/** The comment, scoped to this task — never located by its id alone. */
async function findComment(taskId: string, commentId: string) {
  if (!mongoose.isValidObjectId(commentId)) return null
  return TaskComment.findOne({ _id: commentId, taskId })
}

// PATCH — edit your own comment
export async function PATCH(req: NextRequest, { params }: Params) {
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

    const comment = await findComment(params.taskId, params.commentId)
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Moderators may remove a comment, but putting words in someone else's
    // mouth is not moderation — only the author edits.
    if (comment.authorId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 })
    }

    const body   = await req.json().catch(() => ({}))
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    if (parsed.data.content !== comment.content) {
      comment.content  = parsed.data.content
      comment.editedAt = new Date()
      await comment.save()
    }

    const populated = await comment.populate('authorId', 'name avatarUrl')

    global.io?.to(`project:${params.id}`).emit('task-comment:updated', {
      taskId:  params.taskId,
      comment: populated,
    })

    return NextResponse.json(populated)
  } catch (err) {
    console.error('[PATCH /api/projects/[id]/tasks/[taskId]/comments/[commentId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — the author, or a PI/co-PI moderating
export async function DELETE(_req: NextRequest, { params }: Params) {
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

    const comment = await findComment(params.taskId, params.commentId)
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const isAuthor = comment.authorId.toString() === session.user.id
    if (!isAuthor && !access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await comment.deleteOne()

    global.io?.to(`project:${params.id}`).emit('task-comment:deleted', {
      taskId:    params.taskId,
      commentId: params.commentId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/tasks/[taskId]/comments/[commentId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
