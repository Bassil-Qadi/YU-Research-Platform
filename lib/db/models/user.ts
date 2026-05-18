import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES } from "@/types";

const userSchema = new Schema(
  {
    universityId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "Student",
      required: true,
    },
    department: { type: String },
    researchInterests: { type: [String], default: [] },
    orcidId: { type: String },
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
