import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Pusher from 'pusher'
import { useDatabase } from '../helpers/db'
import { makeProject, makeUser } from '../helpers/factories'
import { signedInAs, signedOut } from '../helpers/session'

useDatabase()

// Fake credentials: authorizing a channel is a local HMAC, so nothing here
// reaches Pusher. Publishing is intercepted below.
const KEY    = 'test-key'
const SECRET = 'test-secret'

function configure() {
  process.env.PUSHER_APP_ID              = '123'
  process.env.PUSHER_SECRET              = SECRET
  process.env.NEXT_PUBLIC_PUSHER_KEY     = KEY
  process.env.NEXT_PUBLIC_PUSHER_CLUSTER = 'eu'
}

function unconfigure() {
  delete process.env.PUSHER_APP_ID
  delete process.env.PUSHER_SECRET
  delete process.env.NEXT_PUBLIC_PUSHER_KEY
  delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER
}

beforeEach(configure)
afterEach(() => {
  unconfigure()
  vi.restoreAllMocks()
})

const SOCKET_ID = '123456.7890123'

/** What pusher-js sends: a form, not JSON. */
function authRequest(channelName: string, socketId = SOCKET_ID) {
  return new NextRequest(new URL('/api/pusher/auth', 'http://localhost:3000'), {
    method:  'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ socket_id: socketId, channel_name: channelName }).toString(),
  })
}

const sign = (text: string) => createHmac('sha256', SECRET).update(text).digest('hex')

async function authorize(channelName: string, socketId?: string) {
  const { POST } = await import('@/app/api/pusher/auth/route')
  return POST(authRequest(channelName, socketId))
}

describe('POST /api/pusher/auth', () => {
  it('signs your own personal channel', async () => {
    const me = await makeUser({})
    await signedInAs(me)

    const channel = `private-user-${me._id}`
    const res = await authorize(channel)

    expect(res.status).toBe(200)
    // The signature Pusher will check: key:HMAC(secret, "socket_id:channel").
    expect((await res.json()).auth).toBe(`${KEY}:${sign(`${SOCKET_ID}:${channel}`)}`)
  })

  it("refuses someone else's personal channel", async () => {
    const me    = await makeUser({})
    const other = await makeUser({})
    await signedInAs(me)

    // Their DMs and notifications travel on it.
    expect((await authorize(`private-user-${other._id}`)).status).toBe(403)
  })

  it('lets a member into the project channel, named from the session', async () => {
    const pi      = await makeUser({ name: 'Priya PI' })
    const project = await makeProject(pi)
    await signedInAs(pi)

    const channel = `presence-project-${project._id}`
    const res  = await authorize(channel)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(JSON.parse(body.channel_data)).toEqual({
      user_id:   pi._id.toString(),
      user_info: { name: 'Priya PI' },
    })
    expect(body.auth).toBe(`${KEY}:${sign(`${SOCKET_ID}:${channel}:${body.channel_data}`)}`)
  })

  it('keeps a non-member out of the project channel', async () => {
    const pi       = await makeUser({})
    const outsider = await makeUser({})
    const project  = await makeProject(pi)
    await signedInAs(outsider)

    expect((await authorize(`presence-project-${project._id}`)).status).toBe(403)
  })

  it('refuses a project that does not exist', async () => {
    const me = await makeUser({})
    await signedInAs(me)

    expect((await authorize('presence-project-0123456789abcdef01234567')).status).toBe(403)
  })

  it('refuses any channel that is not one of ours', async () => {
    const me = await makeUser({})
    await signedInAs(me)

    for (const channel of [
      'public-chat',
      `private-project-${me._id}`,         // right id, wrong kind
      `presence-user-${me._id}`,            // right id, wrong kind
      `private-user-${me._id}-extra`,
      'presence-project-not-an-object-id',
    ]) {
      expect((await authorize(channel)).status, channel).toBe(403)
    }
  })

  it('rejects a malformed socket id', async () => {
    const me = await makeUser({})
    await signedInAs(me)

    expect((await authorize(`private-user-${me._id}`, 'not-a-socket')).status).toBe(400)
  })

  it('requires a session', async () => {
    await signedOut()
    expect((await authorize('private-user-0123456789abcdef01234567')).status).toBe(401)
  })

  it('says plainly when real-time is not configured', async () => {
    const me = await makeUser({})
    await signedInAs(me)
    unconfigure()

    expect((await authorize(`private-user-${me._id}`)).status).toBe(503)
  })
})

describe('publish()', () => {
  function captureTriggers() {
    return vi.spyOn(Pusher.prototype, 'trigger').mockResolvedValue({} as never)
  }

  it('does nothing at all without credentials', async () => {
    unconfigure()
    const trigger = captureTriggers()
    const { publish } = await import('@/lib/realtime/server')

    await publish('private-user-0123456789abcdef01234567', 'dm-new', { hello: 'world' })

    expect(trigger).not.toHaveBeenCalled()
  })

  it('sends the payload as-is when it fits', async () => {
    const trigger = captureTriggers()
    const { publish } = await import('@/lib/realtime/server')

    await publish('presence-project-x', 'task-created', { title: 'Small' })

    expect(trigger).toHaveBeenCalledWith(['presence-project-x'], 'task-created', { title: 'Small' })
  })

  it('sends the fallback instead when the payload is too large', async () => {
    const trigger = captureTriggers()
    const { publish } = await import('@/lib/realtime/server')

    // 5000 Arabic characters: allowed by the model, about 10 KB on the wire.
    const content = 'م'.repeat(5000)
    await publish('presence-project-x', 'message-new', { content }, { projectId: 'x' })

    expect(trigger).toHaveBeenCalledWith(
      ['presence-project-x'], 'message-new', { projectId: 'x', partial: true }
    )
  })

  it('drops an oversized event that has no fallback, rather than failing', async () => {
    const trigger = captureTriggers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { publish } = await import('@/lib/realtime/server')

    await publish('presence-project-x', 'task-updated', { blob: 'x'.repeat(20_000) })

    expect(trigger).not.toHaveBeenCalled()
  })

  it('splits more than 100 channels across triggers', async () => {
    const trigger = captureTriggers()
    const { publish } = await import('@/lib/realtime/server')

    const channels = Array.from({ length: 250 }, (_, i) => `private-user-${i}`)
    await publish(channels, 'notification-new', {})

    expect(trigger.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([100, 100, 50])
  })

  it('never lets a Pusher failure break the request', async () => {
    vi.spyOn(Pusher.prototype, 'trigger').mockRejectedValue(new Error('Pusher is down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { publish } = await import('@/lib/realtime/server')

    await expect(publish('presence-project-x', 'task-created', {})).resolves.toBeUndefined()
  })
})
