import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Conversation, { pairKeyFor, sortedPair } from '@/lib/db/models/Conversation'
import DirectMessage from '@/lib/db/models/DirectMessage'
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const startConversationSchema = z.object({
  userId: z.string().min(1, 'A recipient is required'),
})

interface PopulatedParticipant {
  _id:        mongoose.Types.ObjectId
  name:       string
  avatarUrl?: string
  position?:  string
  department?: string
}

// GET /api/conversations — my direct message threads
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const conversations = await Conversation.find({ participants: session.user.id })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate('participants', 'name avatarUrl position department')
      .lean()

    const withDetail = await Promise.all(
      conversations.map(async (conversation) => {
        const [lastMessage, unreadCount] = await Promise.all([
          DirectMessage.findOne({ conversationId: conversation._id })
            .sort({ createdAt: -1 })
            .lean(),
          DirectMessage.countDocuments({
            conversationId: conversation._id,
            readBy:         { $ne: session.user.id },
          }),
        ])

        // A thread is defined by the other person, so that is what the list shows.
        const other = (conversation.participants as unknown as PopulatedParticipant[])
          .find((p) => p._id.toString() !== session.user.id)

        return {
          id:   conversation._id.toString(),
          with: other
            ? {
                _id:        other._id.toString(),
                name:       other.name,
                avatarUrl:  other.avatarUrl,
                position:   other.position,
                department: other.department,
              }
            : null,
          lastMessage: lastMessage
            ? {
                content:   lastMessage.content,
                createdAt: lastMessage.createdAt,
                fromMe:    lastMessage.senderId.toString() === session.user.id,
              }
            : null,
          unreadCount,
          updatedAt: conversation.lastMessageAt ?? conversation.createdAt,
        }
      })
    )

    return NextResponse.json({ conversations: withDetail })
  } catch (err) {
    console.error('[GET /api/conversations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/conversations — open the thread with someone, creating it if needed
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verdict = await rateLimit(
      `conversation:${session.user.id}`,
      RATE_LIMITS.directMessage
    )
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(verdict) }
      )
    }

    await connectDB()

    const body   = await req.json().catch(() => ({}))
    const parsed = startConversationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { userId } = parsed.data

    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot message yourself' },
        { status: 409 }
      )
    }

    const recipient = await User.findById(userId).select('name status').lean()
    if (!recipient || recipient.status !== 'active') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const participants = sortedPair(session.user.id, userId)
    const pairKey      = pairKeyFor(session.user.id, userId)

    // Upsert on the pair key: two people opening the thread at the same moment
    // converge on one conversation instead of creating two.
    const conversation = await Conversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { participants, pairKey } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    return NextResponse.json({ id: conversation!._id.toString() }, { status: 201 })
  } catch (err) {
    // The unique index is the backstop if two upserts race.
    if (err instanceof Error && 'code' in err && err.code === 11000) {
      try {
        const session = await auth()
        const body = await req.json().catch(() => ({}))
        const existing = await Conversation.findOne({
          pairKey: pairKeyFor(session!.user.id, body.userId),
        }).lean()
        if (existing) {
          return NextResponse.json({ id: existing._id.toString() }, { status: 200 })
        }
      } catch {
        // fall through to the generic error
      }
    }

    console.error('[POST /api/conversations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
