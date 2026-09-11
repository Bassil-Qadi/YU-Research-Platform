import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

export interface ITaskComment extends Document {
  taskId:    Types.ObjectId
  /** Denormalised so permission checks and project deletion need no join. */
  projectId: Types.ObjectId
  authorId:  Types.ObjectId
  content:   string
  /** Set on edit, so the thread can say so; createdAt keeps the original time. */
  editedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const TaskCommentSchema = new Schema<ITaskComment>(
  {
    taskId:    { type: Schema.Types.ObjectId, ref: 'Task',    required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    authorId:  { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    content:   { type: String, required: true, trim: true, maxlength: 2000 },
    editedAt:  { type: Date },
  },
  { timestamps: true }
)

// Reading a thread, oldest first.
TaskCommentSchema.index({ taskId: 1, createdAt: 1 })

const TaskComment: Model<ITaskComment> =
  mongoose.models.TaskComment ??
  mongoose.model<ITaskComment>('TaskComment', TaskCommentSchema)

export default TaskComment
