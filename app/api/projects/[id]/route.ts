import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Project from '@/lib/db/models/Project'
import { updateProjectSchema } from '@/lib/validations/project'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

function canEdit(project: any, userId: string) {
  return project.members.some(
    (m: any) =>
      m.userId._id?.toString() === userId &&
      ['pi', 'co-pi'].includes(m.role)
  )
}

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
    const isMember = project.members.some(
      (m: any) => m.userId._id?.toString() === session.user.id
    )
    if (project.visibility === 'private' && !isMember) {
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
    if (!canEdit(project, session.user.id)) {
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

    const isPi = project.members.some(
      (m: any) => m.userId._id?.toString() === session.user.id && m.role === 'pi'
    )
    if (!isPi) {
      return NextResponse.json({ error: 'Only the PI can delete a project' }, { status: 403 })
    }

    await Project.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}