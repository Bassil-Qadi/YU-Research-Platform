import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

export const NOTIFICATION_TYPES = [
  'project-invite',
  'member-joined',
  'member-left',
  'task-assigned',
  'task-moved',
  'new-message',
  'join-request',
  'join-approved',
  'join-declined',
  'role-changed',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface INotification extends Document {
  userId:    Types.ObjectId
  type:      NotificationType
  title:     string
  body:      string
  link?:     string
  read:      boolean
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Sourced from the same list as the type, so the two cannot drift apart.
    type:   { type: String, enum: NOTIFICATION_TYPES, required: true },
    title:  { type: String, required: true },
    body:   { type: String, required: true },
    link:   { type: String },
    read:   { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification