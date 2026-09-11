import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import { containsInsensitive } from '@/lib/regex'

const PER_KIND = 5
const MIN_LENGTH = 2
const MAX_LENGTH = 100

// GET /api/search?q= — the header's search box: projects and people.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, MAX_LENGTH) ?? ''

    // One letter matches half the platform and tells nobody anything.
    if (q.length < MIN_LENGTH) {
      return NextResponse.json({ projects: [], people: [] })
    }

    await connectDB()

    const pattern = containsInsensitive(q)

    const [projects, people] = await Promise.all([
      Project.find({
        $and: [
          // Only what this person could open anyway: never a stranger's
          // private project, which the project page itself would refuse.
          {
            $or: [
              { visibility: { $in: ['public', 'university'] } },
              { 'members.userId': session.user.id },
            ],
          },
          { $or: [{ title: pattern }, { tags: pattern }, { department: pattern }] },
        ],
      })
        .select('title department status')
        .sort({ updatedAt: -1 })
        .limit(PER_KIND)
        .lean(),

      User.find({
        status:   'active',
        isPublic: { $ne: false },
        $or: [
          { name: pattern },
          { department: pattern },
          { position: pattern },
          { researchInterests: pattern },
        ],
      })
        .select('name department position avatarUrl')
        .sort({ name: 1 })
        .limit(PER_KIND)
        .lean(),
    ])

    return NextResponse.json({ projects, people })
  } catch (err) {
    console.error('[GET /api/search]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
