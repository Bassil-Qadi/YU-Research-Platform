import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import { User } from '@/lib/db/models/user'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const [
      activeProjects,
      recruitingProjects,
      totalResearchers,
      myProjects,
    ] = await Promise.all([
      // Projects the user is a member of
      Project.countDocuments({
        'members.userId': session.user.id,
        status: 'active',
      }),
      // Projects actively seeking members
      Project.countDocuments({
        'members.userId': session.user.id,
        status: 'seeking',
      }),
      // Total public researchers on platform
      User.countDocuments({ isPublic: true }),
      // All user's projects for activity feed
      Project.find({ 'members.userId': session.user.id })
        .select('title status updatedAt department')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ])

    return NextResponse.json({
      activeProjects,
      recruitingProjects,
      totalResearchers,
      recentProjects: myProjects,
    })
  } catch (err) {
    console.error('[GET /api/dashboard/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}