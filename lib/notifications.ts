import Notification, { type NotificationType } from '@/lib/db/models/Notification'
import { Types } from 'mongoose'
import { EVENTS, userChannel } from '@/lib/realtime/channels'
import { publish } from '@/lib/realtime/server'

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

  // Each recipient hears about their own notification on their personal
  // channel. A missed one still shows up on the bell's 30-second poll.
  await Promise.all(
    notifications.map((notification) =>
      publish(
        userChannel(notification.userId.toString()),
        EVENTS.notificationNew,
        notification
      )
    )
  )

  return notifications
}