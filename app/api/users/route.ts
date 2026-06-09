import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const q          = searchParams.get('q')
    const department = searchParams.get('department')
    const role       = searchParams.get('role')
    const page       = parseInt(searchParams.get('page') ?? '1')
    const limit      = Math.min(parseInt(searchParams.get('limit') ?? '12'), 50)

    const filter: Record<string, any> = { isPublic: true }

    if (department) filter.department = department
    if (role)       filter.role = role
    if (q) {
      filter.$or = [
        { name:              { $regex: q, $options: 'i' } },
        { department:        { $regex: q, $options: 'i' } },
        { researchInterests: { $regex: q, $options: 'i' } },
        { position:          { $regex: q, $options: 'i' } },
      ]
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email department position researchInterests avatarUrl role bio')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    return NextResponse.json({
      users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}