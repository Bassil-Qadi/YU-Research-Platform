import { NextRequest, NextResponse } from 'next/server'
import type { FilterQuery } from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User, type IUser } from '@/lib/db/models/user'
import { USER_ROLES, USER_STATUSES } from '@/types'
import { containsInsensitive } from '@/lib/regex'

// GET /api/admin/users — the full directory, searchable and filterable
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const q      = searchParams.get('q')?.trim()
    const status = searchParams.get('status')
    const role   = searchParams.get('role')
    const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

    const filter: FilterQuery<IUser> = {}

    // 'all' (or anything unrecognised) means no filter, so a typo in the query
    // string cannot silently hide accounts from an administrator.
    if (status && (USER_STATUSES as readonly string[]).includes(status)) {
      filter.status = status
    }
    if (role && (USER_ROLES as readonly string[]).includes(role)) {
      filter.role = role
    }
    if (q) {
      const pattern = containsInsensitive(q)
      filter.$or = [
        { name:         pattern },
        { email:        pattern },
        { department:   pattern },
        { universityId: pattern },
      ]
    }

    const [users, total, counts] = await Promise.all([
      User.find(filter)
        .select('name email role department position status universityId avatarUrl createdAt rejectionReason')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      // Tab counts are of the whole platform, not of the current filter.
      User.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ])

    return NextResponse.json({
      users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      counts: Object.fromEntries(counts.map((c) => [c._id ?? 'unknown', c.count])),
    })
  } catch (err) {
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
