import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IMessage extends Document {
  projectId: Types.ObjectId
  senderId:  Types.ObjectId
  content:   string
  readBy:    Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    senderId:  { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    content:   { type: String, required: true, trim: true, maxlength: 5000 },
    readBy:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// Compound index for fetching messages in a project sorted by time
MessageSchema.index({ projectId: 1, createdAt: -1 })

export default mongoose.models.Message ||
  mongoose.model<IMessage>('Message', MessageSchema)