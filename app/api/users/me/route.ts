import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import { z } from 'zod'

// GET /api/users/me — fetch own profile
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const [user, projects] = await Promise.all([
      User.findById(session.user.id)
        .select('name email department position researchInterests avatarUrl role bio orcidId publicationsUrl isPublic createdAt')
        .lean(),
      Project.find({ 'members.userId': session.user.id })
        .select('title abstract department status members updatedAt')
        .limit(10)
        .lean(),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user, projects })
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/users/me — update own profile
const updateProfileSchema = z.object({
  bio:               z.string().max(1000).optional(),
  department:        z.string().optional(),
  position:          z.string().optional(),
  researchInterests: z.array(z.string()).max(10).optional(),
  orcidId:           z.string().optional(),
  publicationsUrl:   z.string().url().optional().or(z.literal('')),
  isPublic:          z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body   = await req.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const updated = await User.findByIdAndUpdate(
      session.user.id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).select('name email department position researchInterests avatarUrl role bio orcidId publicationsUrl isPublic')

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/users/me]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}