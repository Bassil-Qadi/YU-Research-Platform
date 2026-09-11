import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // 'me' resolves to the current user
    const userId = params.id === 'me' ? session.user.id : params.id

    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const [user, projects] = await Promise.all([
      User.findById(userId)
        .select('name email department position researchInterests avatarUrl role bio orcidId publicationsUrl isPublic status createdAt')
        .lean(),
      Project.find({ 'members.userId': userId, visibility: { $ne: 'private' } })
        .select('title abstract department status members updatedAt')
        .limit(10)
        .lean(),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Someone not (or no longer) approved has no public profile.
    if (userId !== session.user.id && user.status && user.status !== 'active') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Private profiles only visible to themselves. Explicitly false, so a
    // user document without the field is treated as public, as the schema says.
    if (user.isPublic === false && userId !== session.user.id) {
      return NextResponse.json({ error: 'This profile is private' }, { status: 403 })
    }

    return NextResponse.json({ user, projects })
  } catch (err) {
    console.error('[GET /api/users/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}