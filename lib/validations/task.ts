import { z } from 'zod'

export const TASK_STATUSES   = ['todo', 'in-progress', 'in-review', 'done'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

/** A 24-character hex id. Anything else reached Mongoose and became a 500. */
const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Not a valid id')

/** Rejected here rather than stored as an Invalid Date. */
const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a valid date')

export const createTaskSchema = z.object({
  title:       z.string().trim().min(1, 'A title is required').max(300),
  description: z.string().trim().max(2000).optional(),
  status:      z.enum(TASK_STATUSES).default('todo'),
  priority:    z.enum(TASK_PRIORITIES).default('medium'),
  assigneeId:  objectId.optional(),
  dueDate:     dateString.optional(),
})

/**
 * Every field optional: only what is sent changes. null clears a field, which
 * is how the assignee and the due date are removed — leaving a key out has to
 * keep meaning "leave it alone".
 */
export const updateTaskSchema = z
  .object({
    title:       z.string().trim().min(1, 'A title is required').max(300).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status:      z.enum(TASK_STATUSES).optional(),
    priority:    z.enum(TASK_PRIORITIES).optional(),
    assigneeId:  objectId.nullable().optional(),
    dueDate:     dateString.nullable().optional(),
    order:       z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' })

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
