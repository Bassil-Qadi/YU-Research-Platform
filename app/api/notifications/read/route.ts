import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Notification from '@/lib/db/models/Notification'

// PATCH /api/notifications/read — mark ALL as read
export async function PATCH(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    await Notification.updateMany(
      { userId: session.user.id, read: false },
      { $set: { read: true } }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/notifications/read]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}