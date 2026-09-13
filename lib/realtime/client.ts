import Pusher, { type PresenceChannel } from 'pusher-js'
import { projectChannel, userChannel } from '@/lib/realtime/channels'

/**
 * The browser side of real-time updates: one Pusher connection shared by every
 * hook. It replaced a Socket.io client that pointed at a server the hosting
 * platform never ran, and so failed on every page.
 *
 * Without keys this module does nothing at all. That is deliberate: a
 * connection that can never open should not retry in the console forever.
 *
 * Pusher re-subscribes held channels by itself after a reconnect, which the old
 * Socket.io client had to do by hand.
 */

// undefined: not decided yet. null: real-time is off for this build.
let client: Pusher | null | undefined

function getClient(): Pusher | null {
  if (typeof window === 'undefined') return null
  if (client !== undefined) return client

  const key     = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  client = key && cluster
    ? new Pusher(key, {
        cluster,
        // Same origin, so the session cookie goes with it and no CORS is involved.
        channelAuthorization: { endpoint: '/api/pusher/auth', transport: 'ajax' },
      })
    : null

  return client
}

/** How many mounted subscribers currently want each channel. */
const holders = new Map<string, number>()

/**
 * Subscribe to a channel for as long as the caller needs it; returns the release.
 *
 * Reference-counted because the connection is shared: the chat and the task
 * board both want a project's channel, and whichever unmounted first would
 * otherwise unsubscribe it out from under the other.
 */
function hold(channelName: string): () => void {
  const pusher = getClient()
  if (!pusher) return () => {}

  const count = holders.get(channelName) ?? 0
  holders.set(channelName, count + 1)
  if (count === 0) pusher.subscribe(channelName)

  let released = false

  return () => {
    if (released) return
    released = true

    const remaining = (holders.get(channelName) ?? 1) - 1
    if (remaining > 0) {
      holders.set(channelName, remaining)
      return
    }

    holders.delete(channelName)
    pusher.unsubscribe(channelName)
  }
}

export const subscribeProject = (projectId: string) => hold(projectChannel(projectId))
export const subscribeUser    = (userId: string)    => hold(userChannel(userId))

/**
 * Listen for `event` on every channel this browser holds; returns the unbind.
 * Handlers filter by project, task or conversation themselves, exactly as they
 * did on the shared socket. Unbinding removes only this handler.
 */
export function onRealtime<T>(event: string, handler: (data: T) => void): () => void {
  const pusher = getClient()
  if (!pusher) return () => {}

  pusher.bind(event, handler)
  return () => {
    pusher.unbind(event, handler)
  }
}

/**
 * A project's channel object, for the typing indicator. Client events carry the
 * sender's user id only when bound on the channel itself, not globally. Null
 * when real-time is off or the channel is not held.
 */
export function projectChannelHandle(projectId: string): PresenceChannel | null {
  const pusher = getClient()
  if (!pusher) return null

  return (pusher.channel(projectChannel(projectId)) as PresenceChannel | undefined) ?? null
}
