import mongoose, { Schema, Document, Types, type Model } from 'mongoose'

export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'

export interface IJoinRequest extends Document {
  projectId:  Types.ObjectId
  userId:     Types.ObjectId
  message?:   string
  /** Which of the project's openPositions the applicant is going for, if any. */
  position?:  string
  status:     JoinRequestStatus
  /** The PI or co-PI who approved or declined it. */
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  declineReason?: string
  createdAt:  Date
  updatedAt:  Date
}

const JoinRequestSchema = new Schema<IJoinRequest>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId:    { type: Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    message:   { type: String, maxlength: 1000, trim: true },
    position:  { type: String, maxlength: 200, trim: true },
    status: {
      type:    String,
      enum:    ['pending', 'approved', 'declined', 'withdrawn'],
      default: 'pending',
      index:   true,
    },
    reviewedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:    { type: Date },
    declineReason: { type: String, maxlength: 500 },
  },
  { timestamps: true }
)

// The review queue: pending requests for a project, newest first.
JoinRequestSchema.index({ projectId: 1, status: 1, createdAt: -1 })

// A user may only have one request in flight per project. Partial so that a
// declined or withdrawn request does not block them from asking again later.
JoinRequestSchema.index(
  { projectId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
)

const JoinRequest: Model<IJoinRequest> =
  mongoose.models.JoinRequest ?? mongoose.model<IJoinRequest>('JoinRequest', JoinRequestSchema)

export default JoinRequest
