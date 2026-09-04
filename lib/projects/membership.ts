import type { Types } from "mongoose";
import type { MemberRole } from "@/lib/db/models/Project";

/**
 * A project member as it comes back from Mongo, whether `userId` was populated
 * or left as a raw ObjectId. Every membership check in the API goes through
 * here so the two shapes are handled in one place.
 */
export interface MemberLike {
  userId: Types.ObjectId | { _id: Types.ObjectId } | string;
  role: MemberRole;
}

export interface ProjectLike {
  members: MemberLike[];
}

/** The member's user id as a string, populated or not. */
export function memberUserId(member: MemberLike): string {
  const { userId } = member;
  if (typeof userId === "string") return userId;
  // A populated userId is a document carrying its own _id; a raw ObjectId
  // stringifies directly (and bson's ObjectId exposes _id returning itself,
  // so reading _id first is correct for both shapes).
  const id = "_id" in userId ? userId._id : userId;
  return id.toString();
}

/** The membership record for `userId`, or undefined if they are not a member. */
export function findMember(
  project: ProjectLike | null | undefined,
  userId: string
): MemberLike | undefined {
  return project?.members?.find((m) => memberUserId(m) === userId);
}

export function isMember(
  project: ProjectLike | null | undefined,
  userId: string
): boolean {
  return findMember(project, userId) !== undefined;
}

/** True when the user is a member AND holds one of `roles`. */
export function hasProjectRole(
  project: ProjectLike | null | undefined,
  userId: string,
  roles: MemberRole[]
): boolean {
  const member = findMember(project, userId);
  return member !== undefined && roles.includes(member.role);
}

/** PI or co-PI — the roles allowed to edit a project and manage its members. */
export function canEditProject(
  project: ProjectLike | null | undefined,
  userId: string
): boolean {
  return hasProjectRole(project, userId, ["pi", "co-pi"]);
}

export function isProjectPi(
  project: ProjectLike | null | undefined,
  userId: string
): boolean {
  return hasProjectRole(project, userId, ["pi"]);
}
