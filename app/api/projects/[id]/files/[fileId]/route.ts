import { NextRequest, NextResponse } from 'next/server'
import { EVENTS, projectChannel } from '@/lib/realtime/channels'
import { publish } from '@/lib/realtime/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import ProjectFile from '@/lib/db/models/ProjectFile'
import { canEditProject } from '@/lib/projects/membership'
import { deleteFile } from '@/lib/storage'

type Params = { params: { id: string; fileId: string } }

// DELETE /api/projects/[id]/files/[fileId] — uploader, or a PI/co-PI
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (
      !mongoose.isValidObjectId(params.id) ||
      !mongoose.isValidObjectId(params.fileId)
    ) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await connectDB()

    const file = await ProjectFile.findOne({
      _id:       params.fileId,
      projectId: params.id,
    })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const project = await Project.findById(params.id).select('members').lean()
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isUploader = file.uploadedBy.toString() === session.user.id
    if (!isUploader && !canEditProject(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Drop the record first: an orphaned record is worse than an orphaned blob,
    // and deleteFile tolerates a file that has already gone.
    await ProjectFile.deleteOne({ _id: file._id })
    await deleteFile(file.publicId, file.resourceType)

    await publish(projectChannel(params.id), EVENTS.fileDeleted, { fileId: params.fileId })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/files/[fileId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
