import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

/** Stub schema for Phase 2 project CRUD */
export const createProjectSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  status: projectStatusSchema.default("draft"),
  tags: z.array(z.string().max(50)).max(15).default([]),
  department: z.string().max(120).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
