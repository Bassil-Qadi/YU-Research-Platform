export const USER_ROLES = [
  "Admin",
  "Faculty",
  "Researcher",
  "Student",
  "Guest",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

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
