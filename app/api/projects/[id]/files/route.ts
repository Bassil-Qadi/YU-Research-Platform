import { NextRequest, NextResponse } from 'next/server'
import { EVENTS, projectChannel } from '@/lib/realtime/channels'
import { publish } from '@/lib/realtime/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import ProjectFile from '@/lib/db/models/ProjectFile'
import { isMember } from '@/lib/projects/membership'
import {
  ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES,
  isStorageConfigured, uploadFile,
} from '@/lib/storage'
import { readUploadedFile } from '@/lib/storage/upload-request'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

type Params = { params: { id: string } }

const ACCEPTED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]

async function memberOf(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members').lean()
  return isMember(project, userId)
}

// GET /api/projects/[id]/files
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    await connectDB()

    if (!(await memberOf(params.id, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const files = await ProjectFile.find({ projectId: params.id })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name avatarUrl')
      .lean()

    return NextResponse.json({ files })
  } catch (err) {
    console.error('[GET /api/projects/[id]/files]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/files — attach a file to the project
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    await connectDB()

    // Permission first: a non-member should be told they cannot do this,
    // not that the server happens to be misconfigured.
    if (!(await memberOf(params.id, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const verdict = await rateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload)
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'File uploads are not configured on this server' },
        { status: 503 }
      )
    }

    const parsed = await readUploadedFile(req, { allowedTypes: ACCEPTED_TYPES })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }

    // Images go in as images so Cloudinary can transform them; everything else
    // is stored raw so it comes back byte-for-byte.
    const resourceType = ALLOWED_IMAGE_TYPES.includes(parsed.file.contentType)
      ? 'image'
      : 'raw'

    const uploaded = await uploadFile(parsed.file.buffer, {
      folder:   `research-platform/projects/${params.id}`,
      filename: parsed.file.filename,
      resourceType,
    })

    const created = await ProjectFile.create({
      projectId:   params.id,
      uploadedBy:  session.user.id,
      name:        parsed.file.filename,
      publicId:    uploaded.publicId,
      url:         uploaded.url,
      bytes:       uploaded.bytes,
      format:      uploaded.format,
      contentType: parsed.file.contentType,
      resourceType,
    })

    const populated = await created.populate('uploadedBy', 'name avatarUrl')

    await publish(projectChannel(params.id), EVENTS.fileUploaded, populated)

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/files]', err)
    return NextResponse.json({ error: 'Failed to upload the file' }, { status: 500 })
  }
}
