import mongoose, { Schema, Document, Types } from 'mongoose'

export type TaskStatus   = 'todo' | 'in-progress' | 'in-review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface ITask extends Document {
  projectId:  Types.ObjectId
  title:      string
  description?: string
  status:     TaskStatus
  priority:   TaskPriority
  assigneeId?: Types.ObjectId
  createdBy:  Types.ObjectId
  dueDate?:   Date
  order:      number
  createdAt:  Date
  updatedAt:  Date
}

const TaskSchema = new Schema<ITask>(
  {
    projectId:   { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title:       { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, maxlength: 2000 },
    status:      { type: String, enum: ['todo', 'in-progress', 'in-review', 'done'], default: 'todo' },
    priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    assigneeId:  { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate:     { type: Date },
    order:       { type: Number, default: 0 },
  },
  { timestamps: true }
)

TaskSchema.index({ projectId: 1, status: 1, order: 1 })

export default mongoose.models.Task ||
  mongoose.model<ITask>('Task', TaskSchema)