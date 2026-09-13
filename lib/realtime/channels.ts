/**
 * Channel and event names shared by the server, which publishes, and the
 * browser, which subscribes. One client-safe module so the two cannot drift.
 *
 * Project channels are presence channels: Pusher attaches the sender's
 * authenticated user id to client events on them, so the typing indicator can
 * name who is typing without trusting a name the sender supplied.
 *
 * Names use hyphens only. Pusher is strict about the characters it accepts, and
 * the old Socket.io names (`task-comment:new`) used colons.
 */

export const projectChannel = (projectId: string) => `presence-project-${projectId}`
export const userChannel    = (userId: string)    => `private-user-${userId}`

export type ParsedChannel =
  | { kind: 'project'; id: string }
  | { kind: 'user';    id: string }

const PROJECT_CHANNEL = /^presence-project-([0-9a-f]{24})$/i
const USER_CHANNEL    = /^private-user-([0-9a-f]{24})$/i

/** Anything that is not exactly one of our two shapes is refused. */
export function parseChannel(name: string): ParsedChannel | null {
  const project = PROJECT_CHANNEL.exec(name)
  if (project) return { kind: 'project', id: project[1] }

  const user = USER_CHANNEL.exec(name)
  if (user) return { kind: 'user', id: user[1] }

  return null
}

export const EVENTS = {
  // project channel
  messageNew:     'message-new',
  taskCreated:    'task-created',
  taskUpdated:    'task-updated',
  taskDeleted:    'task-deleted',
  commentNew:     'task-comment-new',
  commentUpdated: 'task-comment-updated',
  commentDeleted: 'task-comment-deleted',
  fileUploaded:   'file-uploaded',
  fileDeleted:    'file-deleted',
  // user channel
  dmNew:           'dm-new',
  notificationNew: 'notification-new',
  // sent browser-to-browser; Pusher requires the `client-` prefix
  typing:     'client-typing',
  stopTyping: 'client-stop-typing',
} as const

export type RealtimeEvent = (typeof EVENTS)[keyof typeof EVENTS]

/**
 * Set on a payload that was too large to publish whole. It carries only the
 * ids a subscriber needs to refetch what it missed.
 */
export interface PartialPayload {
  partial: true
}

export function isPartial(payload: unknown): payload is PartialPayload {
  return typeof payload === 'object' && payload !== null && (payload as PartialPayload).partial === true
}
