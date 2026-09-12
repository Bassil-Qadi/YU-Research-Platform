import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import TaskComment from '@/lib/db/models/TaskComment'
import { taskForMember } from '@/lib/projects/task-access'
import { commentSchema } from '@/lib/validations/project'
import { createNotifications } from '@/lib/notifications'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import {
  ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES,
  isStorageConfigured, uploadFile,
} from '@/lib/storage'
import { readUploadedFileFrom } from '@/lib/storage/upload-request'
import type { ITaskCommentAttachment } from '@/lib/db/models/TaskComment'

type Params = { params: { id: string; taskId: string } }

const ACCEPTED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]

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

    // A comment arrives as JSON when it is only text, and as a multipart form
    // when it carries a file — the text rides along in the same request so a
    // failed upload cannot strand a comment, or the other way round.
    const isUpload = (req.headers.get('content-type') ?? '')
      .includes('multipart/form-data')

    let content = ''
    let attachment: ITaskCommentAttachment | undefined

    if (isUpload) {
      let form: FormData
      try {
        form = await req.formData()
      } catch {
        return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 })
      }

      const rawContent = form.get('content')
      content = typeof rawContent === 'string' ? rawContent.trim() : ''

      if (content.length > 2000) {
        return NextResponse.json(
          { error: { fieldErrors: { content: ['That is longer than 2000 characters'] } } },
          { status: 422 }
        )
      }

      if (!form.get('file')) {
        return NextResponse.json(
          { error: { fieldErrors: { file: ['No file was attached'] } } },
          { status: 400 }
        )
      }

      // Uploads are metered separately from comments: one file costs both.
      const uploadVerdict = await rateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload)
      if (!uploadVerdict.allowed) {
        return NextResponse.json(
          { error: 'Too many uploads. Please try again later.' },
          { status: 429, headers: rateLimitHeaders(uploadVerdict) }
        )
      }

      if (!isStorageConfigured()) {
        return NextResponse.json(
          { error: 'File uploads are not configured on this server' },
          { status: 503 }
        )
      }

      const file = await readUploadedFileFrom(form, { allowedTypes: ACCEPTED_TYPES })
      if (!file.ok) {
        return NextResponse.json({ error: file.error }, { status: file.status })
      }

      // Images go in as images so Cloudinary can transform them; anything else
      // is raw so it comes back byte-for-byte.
      const resourceType = ALLOWED_IMAGE_TYPES.includes(file.file.contentType)
        ? 'image'
        : 'raw'

      const uploaded = await uploadFile(file.file.buffer, {
        folder:   `research-platform/projects/${params.id}/comments`,
        filename: file.file.filename,
        resourceType,
      })

      attachment = {
        name:        file.file.filename,
        publicId:    uploaded.publicId,
        url:         uploaded.url,
        bytes:       uploaded.bytes,
        format:      uploaded.format,
        contentType: file.file.contentType,
        resourceType,
      }
    } else {
      const body   = await req.json().catch(() => ({}))
      const parsed = commentSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
      }
      content = parsed.data.content
    }

    const comment = await TaskComment.create({
      taskId:    params.taskId,
      projectId: params.id,
      authorId:  session.user.id,
      content,
      ...(attachment ? { attachment } : {}),
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
        body:    content.slice(0, 140) || `Attached ${attachment?.name ?? 'a file'}`,
        link:    `/projects/${params.id}?task=${params.taskId}`,
      })
    }

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/tasks/[taskId]/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
