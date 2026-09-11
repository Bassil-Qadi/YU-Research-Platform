import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'

export interface PlatformStats {
  researchers:    number
  activeProjects: number
  departments:    number
}

/**
 * The figures on the public landing page, counted rather than written in.
 * They replaced "2,400+ researchers" and "98% satisfaction", which were
 * placeholder copy with nothing behind them.
 *
 * Returns null if the database cannot be reached, so the landing page renders
 * without the strip instead of failing to render at all.
 */
export async function getPlatformStats(): Promise<PlatformStats | null> {
  try {
    await connectDB()

    const [researchers, activeProjects, userDepts, projectDepts] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      Project.countDocuments({ status: { $in: ['active', 'seeking'] } }),
      User.distinct('department', { status: 'active' }),
      Project.distinct('department'),
    ])

    // Distinct ignoring case and stray spacing, so one department typed two
    // ways is not counted twice.
    const departments = new Set(
      [...userDepts, ...projectDepts]
        .filter((d): d is string => typeof d === 'string' && d.trim() !== '')
        .map((d) => d.trim().replace(/\s+/g, ' ').toLowerCase())
    ).size

    return { researchers, activeProjects, departments }
  } catch (err) {
    console.error('[platform-stats]', err)
    return null
  }
}
