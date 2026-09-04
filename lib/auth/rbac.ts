import { USER_ROLES, type UserRole } from "@/types";

/**
 * Higher number wins. Every role in USER_ROLES must appear here — the
 * Record type makes a missing entry a compile error rather than a silent
 * `undefined >= n` comparison that denies access.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  Admin: 100,
  Faculty: 80,
  Researcher: 60,
  Staff: 50,
  Student: 40,
};

/** The least-privileged role, used when a session carries no role. */
export const DEFAULT_ROLE: UserRole = USER_ROLES.reduce((lowest, role) =>
  ROLE_HIERARCHY[role] < ROLE_HIERARCHY[lowest] ? role : lowest
);

export function hasMinimumRole(
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === "Admin";
}

export function canAccessAdmin(role: UserRole | undefined): boolean {
  return isAdmin(role);
}

export function canManageProjects(role: UserRole | undefined): boolean {
  return hasMinimumRole(role, "Researcher");
}

export function canModerate(role: UserRole | undefined): boolean {
  return hasMinimumRole(role, "Faculty");
}
