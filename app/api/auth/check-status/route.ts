import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ status: 'unknown' })
    }

    const user = await User.findOne({ email })
      .select('status')
      .lean()

    if (!user) {
      return NextResponse.json({ status: 'unknown' })
    }

    return NextResponse.json({ status: user.status })
  } catch {
    return NextResponse.json({ status: 'unknown' })
  }
}