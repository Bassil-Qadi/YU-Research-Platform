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

/** A researcher asking to be let onto a project. The role is the reviewer's call. */
export const createJoinRequestSchema = z.object({
  message:  z.string().max(1000).trim().optional(),
  position: z.string().max(200).trim().optional(),
})

export const reviewJoinRequestSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('approved'),
    role:   z.enum(['co-pi', 'contributor', 'observer']).default('contributor'),
  }),
  z.object({
    status: z.literal('declined'),
    reason: z.string().max(500).trim().optional(),
  }),
])

export const transferPiSchema = z.object({
  userId: z.string().min(1, 'A member is required'),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>
export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestSchema>
export type TransferPiInput = z.infer<typeof transferPiSchema>