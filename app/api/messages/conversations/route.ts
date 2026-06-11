import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/db/connect'
import Project from '@/lib/db/models/Project'
import Message from '@/lib/db/models/Message'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Get all projects the user is a member of
    const projects = await Project.find({ 'members.userId': session.user.id })
      .select('title department members updatedAt')
      .populate('members.userId', 'name avatarUrl')
      .sort({ updatedAt: -1 })
      .lean()

    // For each project, get last message + unread count
    const conversations = await Promise.all(
      projects.map(async (project) => {
        const [lastMessage, unreadCount] = await Promise.all([
          Message.findOne({ projectId: project._id })
            .sort({ createdAt: -1 })
            .populate('senderId', 'name')
            .lean(),
          Message.countDocuments({
            projectId: project._id,
            readBy:    { $ne: session.user.id },
          }),
        ])

        return {
          id:          project._id.toString(),
          title:       project.title,
          department:  project.department,
          members:     project.members,
          lastMessage: lastMessage
            ? {
                content:   lastMessage.content,
                senderName: (lastMessage.senderId as any)?.name ?? 'Unknown',
                createdAt:  lastMessage.createdAt,
              }
            : null,
          unreadCount,
        }
      })
    )

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[GET /api/messages/conversations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}