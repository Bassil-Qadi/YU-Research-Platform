import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'           // your NextAuth v5 auth() or getServerSession
import { connectDB } from '@/lib/db'
import Project from '@/lib/db/models/Project'
import { User } from '@/lib/db/models/User'
import { createProjectSchema } from '@/lib/validations/project'

// GET /api/projects — list & search
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const q          = searchParams.get('q')          // full-text search
    const department = searchParams.get('department')
    const status     = searchParams.get('status')
    const tag        = searchParams.get('tag')
    const mine       = searchParams.get('mine')       // only my projects
    const page       = parseInt(searchParams.get('page') ?? '1')
    const limit      = Math.min(parseInt(searchParams.get('limit') ?? '12'), 50)

    // Build filter
    const filter: Record<string, any> = {}

    // Visibility: guests see public only, university members see public+university
    filter.$or = [
      { visibility: 'public' },
      { visibility: 'university' },
      { 'members.userId': session.user.id },
    ]

    if (q) filter.$text = { $search: q }
    if (department) filter.department = department
    if (status) filter.status = status
    if (tag) filter.tags = tag
    if (mine === 'true') {
      delete filter.$or
      filter['members.userId'] = session.user.id
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name avatarUrl department position')
        .populate('members.userId', 'name avatarUrl position')
        .lean(),
      Project.countDocuments(filter),
    ])

    return NextResponse.json({
      projects,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/projects]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects — create
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await req.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const project = await Project.create({
      ...parsed.data,
      createdBy: session.user.id,
      members: [{ userId: session.user.id, role: 'pi', joinedAt: new Date() }],
    })

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}