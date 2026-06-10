import Notification, { type NotificationType } from '@/lib/db/models/Notification'
import { Types } from 'mongoose'

interface CreateNotificationParams {
  userIds: (string | Types.ObjectId)[]
  type:    NotificationType
  title:   string
  body:    string
  link?:   string
}

export async function createNotifications({
  userIds, type, title, body, link,
}: CreateNotificationParams) {
  if (!userIds.length) return

  const docs = userIds.map((userId) => ({
    userId, type, title, body, link,
  }))

  const notifications = await Notification.insertMany(docs)

  // Emit real-time notification to each user via Socket.io
  const io = (global as any).io
  if (io) {
    notifications.forEach((notification) => {
      io.to(`user:${notification.userId.toString()}`).emit(
        'new-notification',
        notification
      )
    })
  }

  return notifications
}