import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES, USER_STATUSES } from "@/types";

const userSchema = new Schema(
  {
    researchInterests: [{ type: String }],
    department:        { type: String },
    bio:               { type: String, maxlength: 1000 },
    orcidId:           { type: String },
    position:          { type: String },  // 'Professor', 'PhD Student', etc.
    publicationsUrl:   { type: String },
    avatarUrl:         { type: String },
    /** Cloudinary public id, kept so the old image can be deleted on replace. */
    avatarPublicId:    { type: String },
    isPublic:          { type: Boolean, default: true },
    // Sparse: MongoDBAdapter creates OAuth accounts without this field, and a
    // non-sparse unique index treats every one of them as a duplicate null.
    // Run `npm run sync-indexes` after changing this on an existing database.
    universityId: { type: String, required: true, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    status: {
      type:    String,
      enum:    USER_STATUSES,
      default: 'pending',
      index:   true,
    },
    rejectionReason: { type: String },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "Student",
      required: true,
    },
    avatar: { type: String },
    passwordHash: { type: String, select: false },
    /**
     * When the password last changed. Any session issued before this is
     * refused at revalidation, so resetting a password turns out whoever was
     * already signed in — the point of resetting it after a compromise.
     */
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
