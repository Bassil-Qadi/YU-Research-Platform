import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Notification from '@/lib/db/models/Notification'

type Params = { params: { id: string } }

// PATCH /api/notifications/[id] — mark one as read
export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    await Notification.findOneAndUpdate(
      { _id: params.id, userId: session.user.id },
      { $set: { read: true } }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/notifications/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}