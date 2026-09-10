export const USER_ROLES = [
  'Student',
  'Faculty', 
  'Staff',
  'Researcher',
  'Admin',
] as const

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  /** Registered, waiting on an administrator. */
  'pending',
  /** Approved; the only status that may hold a session. */
  'active',
  /** Registration was turned down. */
  'rejected',
  /** Was active, access withdrawn. Distinct from rejected so the reason for
   *  losing access stays legible. */
  'suspended',
] as const

export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserProfile {
  id: string;
  universityId: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  researchInterests: string[];
  orcidId?: string;
  avatar?: string;
}

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export interface ProjectStub {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
}
