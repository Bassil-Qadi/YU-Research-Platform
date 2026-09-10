import { z } from 'zod'

// Trim before measuring: zod's .trim() is a transform, so placed after .min()
// it lets "   " through the length check and stores an empty string.
const tag      = z.string().trim().toLowerCase().min(1).max(40)
const position = z.string().trim().min(1).max(100)

export const createProjectSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200),
  abstract: z.string().trim().min(50, 'Abstract must be at least 50 characters').max(5000),
  tags: z.array(tag).max(10, 'At most 10 tags'),
  status: z.enum(['active', 'completed', 'seeking', 'paused']).default('active'),
  visibility: z.enum(['public', 'university', 'private']).default('university'),
  department: z.string().trim().min(1, 'Department is required'),
  fundingSource: z.string().trim().max(200).optional(),
  fundingAmount: z.number().positive().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  openPositions: z.array(position).max(10, 'At most 10 open positions').default([]),
})

/**
 * Every field optional, and only what is sent is changed.
 *
 * `.partial()` wraps each field in ZodOptional, which returns before an inner
 * `.default()` runs — so omitting status does not reset it to 'active'. The
 * optional fields also accept null, meaning "clear this", because leaving a
 * key out has to mean "leave it alone".
 */
export const updateProjectSchema = createProjectSchema
  .omit({ fundingSource: true, fundingAmount: true, endDate: true })
  .partial()
  .extend({
    fundingSource: z.string().trim().max(200).nullable().optional(),
    fundingAmount: z.number().positive().nullable().optional(),
    endDate:       z.string().nullable().optional(),
  })

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