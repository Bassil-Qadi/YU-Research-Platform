import mongoose, { Schema, Document, Types } from 'mongoose'

export type NotificationType =
  | 'project-invite'
  | 'member-joined'
  | 'member-left'
  | 'task-assigned'
  | 'task-moved'
  | 'new-message'

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
    type:   {
      type: String,
      enum: ['project-invite', 'member-joined', 'member-left', 'task-assigned', 'task-moved', 'new-message'],
      required: true,
    },
    title:  { type: String, required: true },
    body:   { type: String, required: true },
    link:   { type: String },
    read:   { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

export default mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema)