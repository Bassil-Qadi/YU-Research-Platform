import mongoose, { Schema, Document, Types } from 'mongoose'

export type ProjectStatus = 'active' | 'completed' | 'seeking' | 'paused'
export type ProjectVisibility = 'public' | 'university' | 'private'
export type MemberRole = 'pi' | 'co-pi' | 'contributor' | 'observer'

export interface IProjectMember {
  userId: Types.ObjectId
  role: MemberRole
  joinedAt: Date
}

export interface IProject extends Document {
  title: string
  abstract: string
  tags: string[]
  status: ProjectStatus
  visibility: ProjectVisibility
  members: IProjectMember[]
  fundingSource?: string
  fundingAmount?: number
  department: string
  startDate: Date
  endDate?: Date
  createdBy: Types.ObjectId
  imageUrl?: string
  openPositions: string[]  
  createdAt: Date
  updatedAt: Date
}

const ProjectMemberSchema = new Schema<IProjectMember>({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String, enum: ['pi', 'co-pi', 'contributor', 'observer'], required: true },
  joinedAt: { type: Date, default: Date.now },
})

const ProjectSchema = new Schema<IProject>(
  {
    title:         { type: String, required: true, trim: true, maxlength: 200 },
    abstract:      { type: String, required: true, maxlength: 5000 },
    tags:          [{ type: String, trim: true, lowercase: true }],
    status:        { type: String, enum: ['active', 'completed', 'seeking', 'paused'], default: 'active' },
    visibility:    { type: String, enum: ['public', 'university', 'private'], default: 'university' },
    members:       [ProjectMemberSchema],
    fundingSource: { type: String },
    fundingAmount: { type: Number },
    department:    { type: String, required: true },
    startDate:     { type: Date, required: true },
    endDate:       { type: Date },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl:      { type: String },
    openPositions: [{ type: String }],
  },
  { timestamps: true }
)

// Indexes
ProjectSchema.index({ title: 'text', abstract: 'text', tags: 'text' })
ProjectSchema.index({ 'members.userId': 1 })
ProjectSchema.index({ status: 1, visibility: 1 })
ProjectSchema.index({ department: 1 })

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema)