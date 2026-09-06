import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import { updateProjectSchema } from '@/lib/validations/project'
import Task from '@/lib/db/models/Task'
import Message from '@/lib/db/models/Message'
import JoinRequest from '@/lib/db/models/JoinRequest'
import ProjectFile from '@/lib/db/models/ProjectFile'
import { deleteFile } from '@/lib/storage'
import { canEditProject, isMember, isProjectPi } from '@/lib/projects/membership'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

// GET /api/projects/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    const project = await Project.findById(params.id)
      .populate('createdBy', 'name avatarUrl department position email')
      .populate('members.userId', 'name avatarUrl department position email')
      .lean()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Enforce visibility
    if (project.visibility === 'private' && !isMember(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(project)
  } catch (err) {
    console.error('[GET /api/projects/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const project = await Project.findById(params.id)
      .populate('members.userId', '_id')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!canEditProject(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const updated = await Project.findByIdAndUpdate(
      params.id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name avatarUrl')
      .populate('members.userId', 'name avatarUrl position')
      .lean()

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/projects/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] — PI only
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const project = await Project.findById(params.id).populate('members.userId', '_id')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!isProjectPi(project, session.user.id)) {
      return NextResponse.json({ error: 'Only the PI can delete a project' }, { status: 403 })
    }

    // Everything hanging off the project goes with it; otherwise the tasks,
    // messages, requests and uploaded files outlive it as unreachable rows.
    const files = await ProjectFile.find({ projectId: params.id })
      .select('publicId resourceType')
      .lean()

    await Promise.all([
      Task.deleteMany({ projectId: params.id }),
      Message.deleteMany({ projectId: params.id }),
      JoinRequest.deleteMany({ projectId: params.id }),
      ProjectFile.deleteMany({ projectId: params.id }),
    ])

    await Project.findByIdAndDelete(params.id)

    // Storage last: a leftover blob is recoverable, a dangling record is not.
    await Promise.all(files.map((f) => deleteFile(f.publicId, f.resourceType)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}