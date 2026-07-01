import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'

// GET — list pending users
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'pending'

    const users = await User.find({ status })
      .select('name email role department position status createdAt')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}