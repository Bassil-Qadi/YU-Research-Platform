import Pusher from 'pusher'

/**
 * Real-time publishing through Pusher Channels.
 *
 * This replaced a Socket.io server that lived in server.ts, which the hosting
 * platform never runs: serverless functions cannot hold connections open, so
 * the connections live with Pusher and routes only publish.
 *
 * Publishing is best-effort by design, like email. A task is saved whether or
 * not anyone is watching live, so a Pusher failure is logged and never thrown.
 */

/**
 * Pusher refuses events over 10 KB. Leave room for the envelope it adds. A
 * 5000-character message in Arabic is about 10 KB of UTF-8 on its own.
 */
export const PAYLOAD_LIMIT_BYTES = 9_000

export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_SECRET &&
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  )
}

let client: Pusher | null = null

/** Null when unconfigured, so local development and tests need no keys. */
export function getPusher(): Pusher | null {
  if (!isRealtimeConfigured()) return null

  if (!client) {
    client = new Pusher({
      appId:   process.env.PUSHER_APP_ID!,
      key:     process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret:  process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS:  true,
    })
  }

  return client
}

/**
 * Publish `event` to one or more channels.
 *
 * `fallback` is what goes out instead when `data` is too large: the ids a
 * subscriber needs to refetch. Without one, an oversized event is dropped with a
 * warning rather than failing the request that caused it.
 *
 * Awaited by callers on purpose. On serverless hosting the function can be
 * frozen as soon as the response is sent, taking an unawaited publish with it.
 */
export async function publish(
  channels: string | string[],
  event: string,
  data: unknown,
  fallback?: Record<string, unknown>
): Promise<void> {
  const pusher = getPusher()
  if (!pusher) return

  const list = Array.isArray(channels) ? channels : [channels]
  if (list.length === 0) return

  let payload = data
  const size = Buffer.byteLength(JSON.stringify(data ?? null), 'utf8')

  if (size > PAYLOAD_LIMIT_BYTES) {
    if (!fallback) {
      console.warn(`[realtime] dropped "${event}": ${size} bytes is over the limit`)
      return
    }
    payload = { ...fallback, partial: true }
  }

  try {
    // Pusher accepts at most 100 channels per trigger.
    for (let i = 0; i < list.length; i += 100) {
      await pusher.trigger(list.slice(i, i + 100), event, payload)
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[realtime] failed to publish "${event}":`, reason)
  }
}
