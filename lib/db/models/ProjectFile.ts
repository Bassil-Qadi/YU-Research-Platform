import mongoose, { Schema, Document, Types, type Model } from 'mongoose'
import type { StorageResourceType } from '@/lib/storage'

export interface IProjectFile extends Document {
  projectId:  Types.ObjectId
  uploadedBy: Types.ObjectId
  /** The original filename, shown in the UI and used for downloads. */
  name:         string
  publicId:     string
  url:          string
  bytes:        number
  format?:      string
  contentType:  string
  resourceType: StorageResourceType
  description?: string
  createdAt:    Date
  updatedAt:    Date
}

const ProjectFileSchema = new Schema<IProjectFile>(
  {
    projectId:  { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    name:         { type: String, required: true, trim: true, maxlength: 255 },
    publicId:     { type: String, required: true },
    url:          { type: String, required: true },
    bytes:        { type: Number, required: true },
    format:       { type: String },
    contentType:  { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
    description:  { type: String, maxlength: 500, trim: true },
  },
  { timestamps: true }
)

// The file list for a project, newest first.
ProjectFileSchema.index({ projectId: 1, createdAt: -1 })

const ProjectFile: Model<IProjectFile> =
  mongoose.models.ProjectFile ?? mongoose.model<IProjectFile>('ProjectFile', ProjectFileSchema)

export default ProjectFile
