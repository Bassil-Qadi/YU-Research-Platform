import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Conversation from '@/lib/db/models/Conversation'
import DirectMessage from '@/lib/db/models/DirectMessage'
import { createNotifications } from '@/lib/notifications'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

type Params = { params: { id: string } }

const sendSchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

/** The conversation, but only if the caller is in it. */
async function participantConversation(conversationId: string, userId: string) {
  if (!mongoose.isValidObjectId(conversationId)) return null

  return Conversation.findOne({
    _id:          conversationId,
    participants: userId,
  })
}

// GET /api/conversations/[id]/messages
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const conversation = await participantConversation(params.id, session.user.id)
    if (!conversation) {
      // 404 rather than 403: a non-participant should not learn it exists.
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const page  = parseInt(searchParams.get('page') ?? '1')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    const messages = await DirectMessage.find({ conversationId: params.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'name avatarUrl')
      .lean()

    await DirectMessage.updateMany(
      { conversationId: params.id, readBy: { $ne: session.user.id } },
      { $addToSet: { readBy: session.user.id } }
    )

    return NextResponse.json({ messages: messages.reverse(), page, limit })
  } catch (err) {
    console.error('[GET /api/conversations/[id]/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/conversations/[id]/messages
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verdict = await rateLimit(
      `direct-message:${session.user.id}`,
      RATE_LIMITS.directMessage
    )
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    await connectDB()

    const conversation = await participantConversation(params.id, session.user.id)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const body   = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const message = await DirectMessage.create({
      conversationId: params.id,
      senderId:       session.user.id,
      content:        parsed.data.content,
      readBy:         [session.user.id],
    })

    conversation.lastMessageAt = message.createdAt
    await conversation.save()

    const populated = await message.populate('senderId', 'name avatarUrl')

    const recipientId = conversation.participants
      .map((p) => p.toString())
      .find((id) => id !== session.user.id)

    if (recipientId) {
      // Personal rooms are joined from the session, so this reaches the
      // recipient wherever they are without a room per conversation.
      const io = global.io
      io?.to(`user:${recipientId}`).emit('dm:new', {
        conversationId: params.id,
        message:        populated,
      })
      io?.to(`user:${session.user.id}`).emit('dm:new', {
        conversationId: params.id,
        message:        populated,
      })

      await createNotifications({
        userIds: [recipientId],
        type:    'new-message',
        title:   `New message from ${session.user.name ?? 'a researcher'}`,
        body:    parsed.data.content.slice(0, 140),
        link:    `/messages?conversation=${params.id}`,
      })
    }

    return NextResponse.json(populated, { status: 201 })
  } catch (err) {
    console.error('[POST /api/conversations/[id]/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
