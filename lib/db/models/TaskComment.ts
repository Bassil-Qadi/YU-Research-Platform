import mongoose, { Schema, Document, Types, type Model } from 'mongoose'
import type { StorageResourceType } from '@/lib/storage'

/** One file hanging off a comment. Stored inline: it has no life of its own. */
export interface ITaskCommentAttachment {
  /** The original filename, shown in the thread and used for the download. */
  name:         string
  publicId:     string
  url:          string
  bytes:        number
  format?:      string
  contentType:  string
  resourceType: StorageResourceType
}

export interface ITaskComment extends Document {
  taskId:    Types.ObjectId
  /** Denormalised so permission checks and project deletion need no join. */
  projectId: Types.ObjectId
  authorId:  Types.ObjectId
  /** May be empty when the comment is nothing but an attachment. */
  content:   string
  attachment?: ITaskCommentAttachment
  /** Set on edit, so the thread can say so; createdAt keeps the original time. */
  editedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const AttachmentSchema = new Schema<ITaskCommentAttachment>(
  {
    name:         { type: String, required: true, trim: true, maxlength: 255 },
    publicId:     { type: String, required: true },
    url:          { type: String, required: true },
    bytes:        { type: Number, required: true },
    format:       { type: String },
    contentType:  { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
  },
  { _id: false }
)

const TaskCommentSchema = new Schema<ITaskComment>(
  {
    taskId:    { type: Schema.Types.ObjectId, ref: 'Task',    required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    authorId:  { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    // Not required: a comment may be an attachment with nothing written.
    content:    { type: String, default: '', trim: true, maxlength: 2000 },
    attachment: { type: AttachmentSchema },
    editedAt:  { type: Date },
  },
  { timestamps: true }
)

// An empty comment carrying no file is not a comment at all.
TaskCommentSchema.pre('validate', function (next) {
  if (!this.content?.trim() && !this.attachment) {
    next(new Error('A comment needs text or an attachment'))
    return
  }
  next()
})

// Reading a thread, oldest first.
TaskCommentSchema.index({ taskId: 1, createdAt: 1 })

const TaskComment: Model<ITaskComment> =
  mongoose.models.TaskComment ??
  mongoose.model<ITaskComment>('TaskComment', TaskCommentSchema)

export default TaskComment
