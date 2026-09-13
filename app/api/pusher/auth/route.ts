import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import { isMember } from '@/lib/projects/membership'
import { parseChannel } from '@/lib/realtime/channels'
import { getPusher } from '@/lib/realtime/server'

/** Pusher socket ids look like `123456.7890123`. */
const SOCKET_ID = /^\d+\.\d+$/

// POST /api/pusher/auth
//
// pusher-js calls this before joining any private or presence channel, sending
// `socket_id` and `channel_name` as a form. Every channel we use is one of those
// two kinds, so nothing is readable without passing through here.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pusher = getPusher()
    if (!pusher) {
      return NextResponse.json(
        { error: 'Real-time updates are not configured on this server' },
        { status: 503 }
      )
    }

    const form = await req.formData().catch(() => null)
    const socketId    = form?.get('socket_id')
    const channelName = form?.get('channel_name')

    if (typeof socketId !== 'string' || !SOCKET_ID.test(socketId) || typeof channelName !== 'string') {
      return NextResponse.json({ error: 'Invalid authorization request' }, { status: 400 })
    }

    const channel = parseChannel(channelName)
    if (!channel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // A personal channel carries DMs and notifications: only its owner may read it.
    if (channel.kind === 'user') {
      if (channel.id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json(pusher.authorizeChannel(socketId, channelName))
    }

    // Membership is read on every join, so removing someone takes effect at once.
    await connectDB()
    const project = await Project.findById(channel.id).select('members').lean()
    if (!isMember(project, session.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // The name comes from the session, so a typing indicator names the real sender.
    return NextResponse.json(
      pusher.authorizeChannel(socketId, channelName, {
        user_id:   session.user.id,
        user_info: { name: session.user.name ?? 'Someone' },
      })
    )
  } catch (err) {
    console.error('[POST /api/pusher/auth]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
