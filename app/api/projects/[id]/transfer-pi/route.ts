import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import { transferPiSchema } from '@/lib/validations/project'
import { findMember, isProjectPi, memberUserId } from '@/lib/projects/membership'
import { createNotifications } from '@/lib/notifications'

type Params = { params: { id: string } }

/**
 * POST /api/projects/[id]/transfer-pi — hand the project over.
 *
 * A PI cannot leave their own project, so without this there was no way out:
 * the member-removal route tells them to transfer the role first.
 */
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

    const project = await Project.findById(params.id).select('title members')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only the sitting PI may hand over; a co-PI cannot promote themselves.
    if (!isProjectPi(project, session.user.id)) {
      return NextResponse.json(
        { error: 'Only the PI can transfer the PI role' },
        { status: 403 }
      )
    }

    const body   = await req.json()
    const parsed = transferPiSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { userId: newPiId } = parsed.data

    if (newPiId === session.user.id) {
      return NextResponse.json({ error: 'You are already the PI' }, { status: 409 })
    }
    if (!findMember(project, newPiId)) {
      return NextResponse.json(
        { error: 'That person is not a member of this project' },
        { status: 404 }
      )
    }

    // The outgoing PI stays on as co-PI rather than losing access outright.
    project.members.forEach((member) => {
      const id = memberUserId(member)
      if (id === newPiId) member.role = 'pi'
      else if (id === session.user.id) member.role = 'co-pi'
    })
    await project.save()

    await createNotifications({
      userIds: [newPiId],
      type:    'role-changed',
      title:   'You are now the PI',
      body:    `You were made Principal Investigator of "${project.title}".`,
      link:    `/projects/${params.id}`,
    })

    const updated = await Project.findById(params.id)
      .populate('createdBy', 'name avatarUrl')
      .populate('members.userId', 'name avatarUrl position')
      .lean()

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/projects/[id]/transfer-pi]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
