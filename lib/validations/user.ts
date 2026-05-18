import { z } from "zod";
import { USER_ROLES } from "@/types";

export const userRoleSchema = z.enum(USER_ROLES);

export const createUserSchema = z.object({
  universityId: z.string().min(1).max(64),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: userRoleSchema.default("Student"),
  department: z.string().max(120).optional(),
  researchInterests: z.array(z.string().max(80)).max(20).default([]),
  orcidId: z.string().max(32).optional(),
  avatar: z.string().url().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({
  universityId: true,
  email: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
