import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Project from '@/lib/db/models/Project'
import { User } from '@/lib/db/models/User'
import { inviteMemberSchema } from '@/lib/validations/project'

type Params = { params: { id: string } }

// POST /api/projects/[id]/members — invite by email
export async function POST(req: NextRequest, { params }: Params) {
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

    // Only PI or co-PI can invite
    const canInvite = project.members.some(
      (m: any) =>
        m.userId._id?.toString() === session.user.id &&
        ['pi', 'co-pi'].includes(m.role)
    )
    if (!canInvite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = inviteMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Look up user by email
    const invitee = await User.findOne({ email: parsed.data.email }).lean()
    if (!invitee) {
      return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
    }

    // Already a member?
    const alreadyMember = project.members.some(
      (m: any) => m.userId._id?.toString() === invitee._id.toString()
    )
    if (alreadyMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }

    project.members.push({
      userId: invitee._id,
      role: parsed.data.role,
      joinedAt: new Date(),
    })
    await project.save()

    // TODO: send email notification here (Resend / SES)

    return NextResponse.json({ success: true, memberId: invitee._id })
  } catch (err) {
    console.error('[POST /api/projects/[id]/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/members?userId=... — remove a member
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId query param required' }, { status: 400 })
    }

    const project = await Project.findById(params.id).populate('members.userId', '_id')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isPi = project.members.some(
      (m: any) => m.userId._id?.toString() === session.user.id && m.role === 'pi'
    )
    const isSelf = targetUserId === session.user.id

    // Allow: PI removing anyone, or a member removing themselves
    if (!isPi && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // PI cannot remove themselves (transfer ownership first)
    const targetIsPi = project.members.some(
      (m: any) => m.userId._id?.toString() === targetUserId && m.role === 'pi'
    )
    if (targetIsPi) {
      return NextResponse.json({ error: 'Transfer PI role before leaving' }, { status: 400 })
    }

    project.members = project.members.filter(
      (m: any) => m.userId._id?.toString() !== targetUserId
    )
    await project.save()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}