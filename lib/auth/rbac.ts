import type { UserRole } from "@/types";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  Admin: 100,
  Faculty: 80,
  Researcher: 60,
  Student: 40,
  Guest: 10,
};

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
