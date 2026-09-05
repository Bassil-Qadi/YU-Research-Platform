import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import JoinRequest from '@/lib/db/models/JoinRequest'
import { reviewJoinRequestSchema } from '@/lib/validations/project'
import { canEditProject, isMember, memberUserId } from '@/lib/projects/membership'
import { createNotifications } from '@/lib/notifications'

type Params = { params: { id: string; requestId: string } }

// PATCH /api/projects/[id]/join-requests/[requestId] — approve or decline
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (
      !mongoose.isValidObjectId(params.id) ||
      !mongoose.isValidObjectId(params.requestId)
    ) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await connectDB()

    const project = await Project.findById(params.id).select('title members')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!canEditProject(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body   = await req.json()
    const parsed = reviewJoinRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const request = await JoinRequest.findOne({
      _id:       params.requestId,
      projectId: params.id,
    })
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: `This request was already ${request.status}` },
        { status: 409 }
      )
    }

    const applicantId = request.userId.toString()

    if (parsed.data.status === 'declined') {
      request.status        = 'declined'
      request.reviewedBy    = new mongoose.Types.ObjectId(session.user.id)
      request.reviewedAt    = new Date()
      request.declineReason = parsed.data.reason
      await request.save()

      await createNotifications({
        userIds: [applicantId],
        type:    'join-declined',
        title:   'Request declined',
        body: parsed.data.reason
          ? `Your request to join "${project.title}" was declined: ${parsed.data.reason}`
          : `Your request to join "${project.title}" was declined.`,
        link: `/projects/${params.id}`,
      })

      return NextResponse.json(request)
    }

    // Approved — someone may have been added by invite in the meantime.
    if (isMember(project, applicantId)) {
      request.status     = 'approved'
      request.reviewedBy = new mongoose.Types.ObjectId(session.user.id)
      request.reviewedAt = new Date()
      await request.save()

      return NextResponse.json(request)
    }

    const existingMemberIds = project.members.map(memberUserId)

    project.members.push({
      userId:   request.userId,
      role:     parsed.data.role,
      joinedAt: new Date(),
    })
    await project.save()

    request.status     = 'approved'
    request.reviewedBy = new mongoose.Types.ObjectId(session.user.id)
    request.reviewedAt = new Date()
    await request.save()

    await createNotifications({
      userIds: [applicantId],
      type:    'join-approved',
      title:   'Request approved',
      body:    `You are now a member of "${project.title}" as ${parsed.data.role}.`,
      link:    `/projects/${params.id}`,
    })

    await createNotifications({
      userIds: existingMemberIds,
      type:    'member-joined',
      title:   'New project member',
      body:    `Someone new joined "${project.title}".`,
      link:    `/projects/${params.id}`,
    })

    return NextResponse.json(request)
  } catch (err) {
    console.error('[PATCH /api/projects/[id]/join-requests/[requestId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/join-requests/[requestId] — withdraw your own
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!mongoose.isValidObjectId(params.requestId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await connectDB()

    const request = await JoinRequest.findOne({
      _id:       params.requestId,
      projectId: params.id,
    })
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (request.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: `This request was already ${request.status}` },
        { status: 409 }
      )
    }

    request.status = 'withdrawn'
    await request.save()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/join-requests/[requestId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
