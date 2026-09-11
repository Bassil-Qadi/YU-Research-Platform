import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import { departmentOptions } from '@/lib/departments'

/**
 * GET /api/departments — what the filters offer.
 *
 * The canonical list, plus any department that is actually in use but not on
 * it, so an older free-text value can still be filtered to.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const [people, projects] = await Promise.all([
      User.distinct('department', { status: 'active' }),
      Project.distinct('department'),
    ])

    return NextResponse.json({
      departments: departmentOptions([...people, ...projects] as string[]),
    })
  } catch (err) {
    console.error('[GET /api/departments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
