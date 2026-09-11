import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User, type IUser } from '@/lib/db/models/user'
import type { FilterQuery } from 'mongoose'
import { containsInsensitive, equalsInsensitive } from '@/lib/regex'

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

    // $ne: false rather than true — a missing field means the schema default,
    // which is public. Matching on true hides legacy user documents.
    //
    // Active only: pending, rejected and suspended accounts used to be listed
    // here, and messaging one of them then failed with "User not found".
    const filter: FilterQuery<IUser> = { isPublic: { $ne: false }, status: 'active' }

    // Case-insensitive, so "school of engineering" and "School of Engineering"
    // are the same department.
    if (department) filter.department = equalsInsensitive(department)
    if (role)       filter.role = role
    if (q?.trim()) {
      // Escaped: raw input in $regex lets anyone send a pattern that hangs the
      // database, or "." that matches everyone.
      const pattern = containsInsensitive(q)
      filter.$or = [
        { name:              pattern },
        { department:        pattern },
        { researchInterests: pattern },
        { position:          pattern },
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