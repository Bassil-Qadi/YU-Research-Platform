import { z } from 'zod'

export const createProjectSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  abstract: z.string().min(50, 'Abstract must be at least 50 characters').max(5000),
  tags: z.array(z.string().toLowerCase().trim()).max(10),
  status: z.enum(['active', 'completed', 'seeking', 'paused']).default('active'),
  visibility: z.enum(['public', 'university', 'private']).default('university'),
  department: z.string().min(1, 'Department is required'),
  fundingSource: z.string().optional(),
  fundingAmount: z.number().positive().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  openPositions: z.array(z.string()).max(10).default([]),
})

export const updateProjectSchema = createProjectSchema.partial()

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['co-pi', 'contributor', 'observer']),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>