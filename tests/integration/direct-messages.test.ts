import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { useDatabase } from '../helpers/db'
import { jsonRequest, makeUser } from '../helpers/factories'
import { signedInAs, signedOut } from '../helpers/session'

useDatabase()

const body = (res: Response) => res.json()

async function routes() {
  return {
    listConversations:  (await import('@/app/api/conversations/route')).GET,
    startConversation:  (await import('@/app/api/conversations/route')).POST,
    readThread:  (await import('@/app/api/conversations/[id]/messages/route')).GET,
    sendMessage: (await import('@/app/api/conversations/[id]/messages/route')).POST,
  }
}

async function openThreadBetween(a: { _id: mongoose.Types.ObjectId }, b: { _id: mongoose.Types.ObjectId }) {
  const { startConversation } = await routes()
  await signedInAs(a)
  const res = await startConversation(
    jsonRequest('/x', { method: 'POST', body: { userId: b._id.toString() } })
  )
  return (await body(res)).id as string
}

describe('starting a conversation', () => {
  it('creates one and returns its id', async () => {
    const ada  = await makeUser({ name: 'Ada' })
    const grace = await makeUser({ name: 'Grace' })

    const { startConversation } = await routes()
    await signedInAs(ada)
    const res = await startConversation(
      jsonRequest('/x', { method: 'POST', body: { userId: grace._id.toString() } })
    )

    expect(res.status).toBe(201)
    expect((await body(res)).id).toBeTruthy()
  })

  it('returns the same thread when either person opens it again', async () => {
    const ada   = await makeUser({})
    const grace = await makeUser({})

    const first  = await openThreadBetween(ada, grace)
    const second = await openThreadBetween(ada, grace)
    // The other direction must land on the same thread, not a second one.
    const third  = await openThreadBetween(grace, ada)

    expect(second).toBe(first)
    expect(third).toBe(first)

    const Conversation = (await import('@/lib/db/models/Conversation')).default
    expect(await Conversation.countDocuments()).toBe(1)
  })

  it('refuses to message yourself', async () => {
    const ada = await makeUser({})
    const { startConversation } = await routes()

    await signedInAs(ada)
    const res = await startConversation(
      jsonRequest('/x', { method: 'POST', body: { userId: ada._id.toString() } })
    )

    expect(res.status).toBe(409)
  })

  it('refuses an unknown or unapproved recipient', async () => {
    const ada     = await makeUser({})
    const pending = await makeUser({ status: 'pending' })
    const { startConversation } = await routes()

    await signedInAs(ada)

    const missing = await startConversation(
      jsonRequest('/x', { method: 'POST', body: { userId: new mongoose.Types.ObjectId().toString() } })
    )
    expect(missing.status).toBe(404)

    const notApproved = await startConversation(
      jsonRequest('/x', { method: 'POST', body: { userId: pending._id.toString() } })
    )
    expect(notApproved.status).toBe(404)
  })

  it('refuses an anonymous caller', async () => {
    await signedOut()
    const { startConversation } = await routes()

    const res = await startConversation(
      jsonRequest('/x', { method: 'POST', body: { userId: new mongoose.Types.ObjectId().toString() } })
    )
    expect(res.status).toBe(401)
  })
})

describe('sending and reading', () => {
  it('delivers a message to the other participant', async () => {
    const ada   = await makeUser({ name: 'Ada' })
    const grace = await makeUser({ name: 'Grace' })
    const id    = await openThreadBetween(ada, grace)
    const { sendMessage, readThread } = await routes()

    await signedInAs(ada)
    const sent = await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: 'Hello Grace' } }),
      { params: { id } }
    )
    expect(sent.status).toBe(201)

    await signedInAs(grace)
    const thread = await readThread(jsonRequest('/x'), { params: { id } })
    const messages = (await body(thread)).messages

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Hello Grace')
    expect(messages[0].senderId.name).toBe('Ada')
  })

  it('keeps a non-participant out, without confirming the thread exists', async () => {
    const ada      = await makeUser({})
    const grace    = await makeUser({})
    const outsider = await makeUser({})
    const id       = await openThreadBetween(ada, grace)
    const { readThread, sendMessage } = await routes()

    await signedInAs(outsider)

    // 404, not 403 — a stranger should not learn that this conversation exists.
    expect((await readThread(jsonRequest('/x'), { params: { id } })).status).toBe(404)
    expect((await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: 'butting in' } }),
      { params: { id } }
    )).status).toBe(404)
  })

  it('rejects empty and oversized messages', async () => {
    const ada   = await makeUser({})
    const grace = await makeUser({})
    const id    = await openThreadBetween(ada, grace)
    const { sendMessage } = await routes()

    await signedInAs(ada)

    expect((await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: '   ' } }),
      { params: { id } }
    )).status).toBe(422)

    expect((await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: 'x'.repeat(5001) } }),
      { params: { id } }
    )).status).toBe(422)
  })

  it('rejects a malformed conversation id', async () => {
    const ada = await makeUser({})
    const { readThread } = await routes()

    await signedInAs(ada)
    expect((await readThread(jsonRequest('/x'), { params: { id: 'nonsense' } })).status).toBe(404)
  })
})

describe('the inbox', () => {
  it('names the other person, not yourself', async () => {
    const ada   = await makeUser({ name: 'Ada' })
    const grace = await makeUser({ name: 'Grace' })
    const id    = await openThreadBetween(ada, grace)
    const { sendMessage, listConversations } = await routes()

    await signedInAs(ada)
    await sendMessage(
      jsonRequest('/x', { method: 'POST', body: { content: 'hi' } }),
      { params: { id } }
    )

    const mine = await body(await listConversations())
    expect(mine.conversations[0].with.name).toBe('Grace')

    await signedInAs(grace)
    const theirs = await body(await listConversations())
    expect(theirs.conversations[0].with.name).toBe('Ada')
  })

  it('counts what the recipient has not read, and clears it once they look', async () => {
    const ada   = await makeUser({})
    const grace = await makeUser({})
    const id    = await openThreadBetween(ada, grace)
    const { sendMessage, readThread, listConversations } = await routes()

    await signedInAs(ada)
    for (const text of ['one', 'two', 'three']) {
      await sendMessage(jsonRequest('/x', { method: 'POST', body: { content: text } }), { params: { id } })
    }

    // The sender has read their own messages.
    expect((await body(await listConversations())).conversations[0].unreadCount).toBe(0)

    await signedInAs(grace)
    expect((await body(await listConversations())).conversations[0].unreadCount).toBe(3)

    await readThread(jsonRequest('/x'), { params: { id } })
    expect((await body(await listConversations())).conversations[0].unreadCount).toBe(0)
  })

  it('marks who sent the last message', async () => {
    const ada   = await makeUser({})
    const grace = await makeUser({})
    const id    = await openThreadBetween(ada, grace)
    const { sendMessage, listConversations } = await routes()

    await signedInAs(ada)
    await sendMessage(jsonRequest('/x', { method: 'POST', body: { content: 'from ada' } }), { params: { id } })

    expect((await body(await listConversations())).conversations[0].lastMessage.fromMe).toBe(true)

    await signedInAs(grace)
    expect((await body(await listConversations())).conversations[0].lastMessage.fromMe).toBe(false)
  })

  it('puts the most recently active thread first', async () => {
    const ada = await makeUser({})
    const bob = await makeUser({ name: 'Bob' })
    const cat = await makeUser({ name: 'Cat' })

    const withBob = await openThreadBetween(ada, bob)
    const withCat = await openThreadBetween(ada, cat)
    const { sendMessage, listConversations } = await routes()

    await signedInAs(ada)
    await sendMessage(jsonRequest('/x', { method: 'POST', body: { content: 'hi bob' } }), { params: { id: withBob } })
    await new Promise((r) => setTimeout(r, 20))
    await sendMessage(jsonRequest('/x', { method: 'POST', body: { content: 'hi cat' } }), { params: { id: withCat } })

    const list = (await body(await listConversations())).conversations
    expect(list[0].id).toBe(withCat)
    expect(list[1].id).toBe(withBob)
  })

  it('shows nothing to someone with no conversations', async () => {
    await signedInAs(await makeUser({}))
    const { listConversations } = await routes()

    expect((await body(await listConversations())).conversations).toEqual([])
  })

  it('never leaks another pair’s thread into your inbox', async () => {
    const ada   = await makeUser({})
    const bob   = await makeUser({})
    const cat   = await makeUser({})
    await openThreadBetween(bob, cat)

    await signedInAs(ada)
    const { listConversations } = await routes()

    expect((await body(await listConversations())).conversations).toHaveLength(0)
  })
})
