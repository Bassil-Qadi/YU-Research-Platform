import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Message from '@/lib/db/models/Message'
import { z } from 'zod'

type Params = { params: { id: string } }

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
})

// Helper — check if user is a project member
async function getProjectMembership(projectId: string, userId: string) {
  const project = await Project.findById(projectId).select('members visibility').lean()
  if (!project) return null
  const member = (project as any).members.find(
    (m: any) => m.userId.toString() === userId
  )
  return { project, member }
}

// GET /api/projects/[id]/messages
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const membership = await getProjectMembership(params.id, session.user.id)
    if (!membership?.member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page  = parseInt(searchParams.get('page')  ?? '1')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    const messages = await Message.find({ projectId: params.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'name avatarUrl position')
      .lean()

    // Mark all as read for this user
    await Message.updateMany(
      { projectId: params.id, readBy: { $ne: session.user.id } },
      { $addToSet: { readBy: session.user.id } }
    )

    return NextResponse.json({
      messages: messages.reverse(), // oldest first for chat display
      page,
      limit,
    })
  } catch (err) {
    console.error('[GET /api/projects/[id]/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/messages
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const membership = await getProjectMembership(params.id, session.user.id)
    if (!membership?.member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body   = await req.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const message = await Message.create({
      projectId: params.id,
      senderId:  session.user.id,
      content:   parsed.data.content,
      readBy:    [session.user.id],
    })

    const populated = await message.populate('senderId', 'name avatarUrl position')

    // Emit to all users in the project room via Socket.io
    const io = (global as any).io
    if (io) {
      io.to(`project:${params.id}`).emit('new-message', populated)
    }

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}