import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import { User } from '@/lib/db/models/user'
import Project from '@/lib/db/models/Project'
import Message from '@/lib/db/models/Message'
import Task from '@/lib/db/models/Task'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can access this
    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      totalUsers,
      newUsersThisMonth,
      totalProjects,
      activeProjects,
      seekingProjects,
      totalMessages,
      messagesThisMonth,
      totalTasks,
      completedTasks,
      usersByRole,
      projectsByDepartment,
      projectsByStatus,
      recentUsers,
      recentProjects,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Project.countDocuments(),
      Project.countDocuments({ status: 'active' }),
      Project.countDocuments({ status: 'seeking' }),
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Task.countDocuments(),
      Task.countDocuments({ status: 'done' }),

      // Users grouped by role
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Projects grouped by department (top 5)
      Project.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Projects grouped by status
      Project.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // 5 most recent users
      User.find()
        .select('name email role department createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // 5 most recent projects
      Project.find()
        .select('title department status members createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    return NextResponse.json({
      overview: {
        totalUsers,
        newUsersThisMonth,
        totalProjects,
        activeProjects,
        seekingProjects,
        totalMessages,
        messagesThisMonth,
        totalTasks,
        completedTasks,
      },
      charts: {
        usersByRole,
        projectsByDepartment,
        projectsByStatus,
      },
      recentUsers,
      recentProjects,
    })
  } catch (err) {
    console.error('[GET /api/admin/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}