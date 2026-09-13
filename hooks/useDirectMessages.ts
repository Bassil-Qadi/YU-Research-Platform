import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { EVENTS, isPartial } from '@/lib/realtime/channels'
import { onRealtime, subscribeUser } from '@/lib/realtime/client'

export interface DirectParticipant {
  _id:         string
  name:        string
  avatarUrl?:  string
  position?:   string
  department?: string
}

export interface DirectConversation {
  id:   string
  with: DirectParticipant | null
  lastMessage: {
    content:   string
    createdAt: string
    fromMe:    boolean
  } | null
  unreadCount: number
  updatedAt:   string
}

export interface DirectMessageItem {
  _id:            string
  conversationId: string
  content:        string
  createdAt:      string
  senderId: {
    _id:        string
    name:       string
    avatarUrl?: string
  }
}

/**
 * Direct threads arrive on the personal socket room, which the server joins
 * from the session — so unlike project chat there is no room to subscribe to.
 */
export function useDirectConversations() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const query = useQuery<{ conversations: DirectConversation[] }>({
    queryKey: ['direct-conversations'],
    queryFn:  () => apiFetch('/api/conversations'),
    enabled:  !!session?.user?.id,
  })

  useEffect(() => {
    if (!session?.user?.id) return
    // DMs arrive on the user's personal channel, which has to be held to hear them.
    const release = subscribeUser(session.user.id)

    const onNew = () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] })
    }

    const unbind = onRealtime(EVENTS.dmNew, onNew)
    return () => {
      unbind()
      release()
    }
  }, [session?.user?.id, queryClient])

  return query
}

export function useDirectThread(conversationId: string | null) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user?.id

  const query = useQuery<{ messages: DirectMessageItem[] }>({
    queryKey: ['direct-thread', conversationId],
    queryFn:  () => apiFetch(`/api/conversations/${conversationId}/messages`),
    enabled:  !!conversationId,
  })

  // Loading a thread marks it read on the server, so the unread badge in the
  // list is now stale — refresh it rather than leaving a count on a
  // conversation the reader is looking at.
  useEffect(() => {
    if (!conversationId || !query.data) return
    queryClient.invalidateQueries({ queryKey: ['direct-conversations'] })
  }, [conversationId, query.data, queryClient])

  useEffect(() => {
    if (!conversationId || !userId) return
    const release = subscribeUser(userId)

    const onNew = (payload: { conversationId: string; message: DirectMessageItem }) => {
      if (payload.conversationId !== conversationId) return

      // Too large to publish whole: fetch the thread rather than append a stub.
      if (isPartial(payload)) {
        queryClient
          .refetchQueries({ queryKey: ['direct-thread', conversationId] })
          .then(() => queryClient.invalidateQueries({ queryKey: ['direct-conversations'] }))
        return
      }

      let wasNew = false

      queryClient.setQueryData(
        ['direct-thread', conversationId],
        (old: { messages: DirectMessageItem[] } | undefined) => {
          const existing = old?.messages ?? []
          // The sender receives their own echo, so guard against duplicates.
          if (existing.some((m) => m._id === payload.message._id)) return { messages: existing }
          wasNew = true
          return { messages: [...existing, payload.message] }
        }
      )

      // The socket only updates this client; the server still has the message
      // down as unread. Refetching the open thread marks it read, so a
      // conversation you are looking at does not sit there with a badge.
      if (wasNew) {
        queryClient
          .refetchQueries({ queryKey: ['direct-thread', conversationId] })
          .then(() => queryClient.invalidateQueries({ queryKey: ['direct-conversations'] }))
      }
    }

    const unbind = onRealtime(EVENTS.dmNew, onNew)
    return () => {
      unbind()
      release()
    }
  }, [conversationId, userId, queryClient])

  return query
}

export function useSendDirectMessage(conversationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<DirectMessageItem>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body:   JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] })
    },
  })
}

/** Open (or create) the thread with someone and return its id. */
export function useStartConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ id: string }>('/api/conversations', {
        method: 'POST',
        body:   JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] })
    },
  })
}
