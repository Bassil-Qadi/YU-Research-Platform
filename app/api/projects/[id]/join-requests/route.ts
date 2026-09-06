import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import JoinRequest from '@/lib/db/models/JoinRequest'
import { createJoinRequestSchema } from '@/lib/validations/project'
import { canEditProject, isMember, memberUserId } from '@/lib/projects/membership'
import { createNotifications } from '@/lib/notifications'
import { User } from '@/lib/db/models/user'
import { sendEmail } from '@/lib/email/client'
import { joinRequestReceived } from '@/lib/email/templates'

type Params = { params: { id: string } }

// GET /api/projects/[id]/join-requests — the review queue for PI/co-PI,
// or ?mine=true for the caller's own request on this project.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)

    if (searchParams.get('mine') === 'true') {
      const own = await JoinRequest.findOne({
        projectId: params.id,
        userId:    session.user.id,
        status:    'pending',
      }).lean()

      return NextResponse.json({ request: own ?? null })
    }

    const project = await Project.findById(params.id).select('members').lean()
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!canEditProject(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = searchParams.get('status') ?? 'pending'
    const requests = await JoinRequest.find({ projectId: params.id, status })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email avatarUrl department position researchInterests')
      .lean()

    return NextResponse.json({ requests })
  } catch (err) {
    console.error('[GET /api/projects/[id]/join-requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/join-requests — ask to join
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

    const project = await Project.findById(params.id)
      .select('title members visibility status openPositions')
      .lean()
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // You cannot ask to join something you were never allowed to see.
    if (project.visibility === 'private') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (project.status === 'completed') {
      return NextResponse.json(
        { error: 'This project has finished and is not taking new members' },
        { status: 409 }
      )
    }
    if (isMember(project, session.user.id)) {
      return NextResponse.json({ error: 'You are already a member' }, { status: 409 })
    }

    const body   = await req.json().catch(() => ({}))
    const parsed = createJoinRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const existing = await JoinRequest.findOne({
      projectId: params.id,
      userId:    session.user.id,
      status:    'pending',
    }).lean()
    if (existing) {
      return NextResponse.json(
        { error: 'You already have a request awaiting review' },
        { status: 409 }
      )
    }

    const request = await JoinRequest.create({
      projectId: params.id,
      userId:    session.user.id,
      message:   parsed.data.message,
      position:  parsed.data.position,
      status:    'pending',
    })

    // Everyone who can act on it hears about it.
    const reviewers = project.members
      .filter((m) => m.role === 'pi' || m.role === 'co-pi')
      .map(memberUserId)

    await createNotifications({
      userIds: reviewers,
      type:    'join-request',
      title:   'New request to join',
      body:    `${session.user.name ?? 'A researcher'} asked to join "${project.title}".`,
      link:    `/projects/${params.id}`,
    })

    const reviewerEmails = (
      await User.find({ _id: { $in: reviewers } }).select('email').lean()
    ).map((u) => u.email).filter(Boolean)

    if (reviewerEmails.length > 0) {
      const mail = joinRequestReceived(
        session.user.name ?? 'A researcher',
        project.title,
        params.id,
        parsed.data.message
      )
      await sendEmail({ to: reviewerEmails, ...mail })
    }

    return NextResponse.json(request, { status: 201 })
  } catch (err) {
    // The partial unique index is the backstop for two requests racing.
    if (err instanceof Error && 'code' in err && err.code === 11000) {
      return NextResponse.json(
        { error: 'You already have a request awaiting review' },
        { status: 409 }
      )
    }
    console.error('[POST /api/projects/[id]/join-requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
