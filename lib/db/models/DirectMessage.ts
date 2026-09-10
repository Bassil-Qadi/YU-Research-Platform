import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

export interface IDirectMessage extends Document {
  conversationId: Types.ObjectId
  senderId:       Types.ObjectId
  content:        string
  /** Who has seen it; the sender is added on send. */
  readBy:         Types.ObjectId[]
  createdAt:      Date
  updatedAt:      Date
}

const DirectMessageSchema = new Schema<IDirectMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content:  { type: String, required: true, trim: true, maxlength: 5000 },
    readBy:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// Reading a thread, newest first.
DirectMessageSchema.index({ conversationId: 1, createdAt: -1 })
// Counting what someone has not seen.
DirectMessageSchema.index({ conversationId: 1, readBy: 1 })

const DirectMessage: Model<IDirectMessage> =
  mongoose.models.DirectMessage ??
  mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema)

export default DirectMessage
