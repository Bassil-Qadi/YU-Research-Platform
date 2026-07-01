import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES } from "@/types";

const userSchema = new Schema(
  {
    researchInterests: [{ type: String }],
    department:        { type: String },
    bio:               { type: String, maxlength: 1000 },
    orcidId:           { type: String },
    position:          { type: String },  // 'Professor', 'PhD Student', etc.
    publicationsUrl:   { type: String },
    avatarUrl:         { type: String },
    isPublic:          { type: Boolean, default: true },
    universityId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    status: {
      type:    String,
      enum:    ['pending', 'active', 'rejected'],
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
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
