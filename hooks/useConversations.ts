import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { EVENTS, isPartial } from '@/lib/realtime/channels'
import { onRealtime } from '@/lib/realtime/client'

export interface Conversation {
  id:         string
  title:      string
  department: string
  members:    { userId: { _id: string; name: string; avatarUrl?: string }; role: string }[]
  lastMessage: {
    content:    string
    senderName: string
    createdAt:  string
  } | null
  unreadCount: number
}

export function useConversations() {
  const queryClient = useQueryClient()

  const query = useQuery<{ conversations: Conversation[] }>({
    queryKey: ['conversations'],
    queryFn:  () => apiFetch('/api/messages/conversations'),
  })

  useEffect(() => {
    // When a new message arrives in any project channel this browser holds,
    // update that conversation's last message in the list
    const onNewMessage = (message: {
      projectId:  string
      content:    string
      createdAt:  string
      senderId?:  { name?: string }
    }) => {
      // Too large to publish whole: refetch the list rather than guess.
      if (isPartial(message)) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        return
      }

      queryClient.setQueryData(
        ['conversations'],
        (old: { conversations: Conversation[] } | undefined) => {
          if (!old) return old
          return {
            conversations: old.conversations.map((conv) =>
              conv.id === message.projectId
                ? {
                    ...conv,
                    lastMessage: {
                      content:    message.content,
                      senderName: message.senderId?.name ?? 'Unknown',
                      createdAt:  message.createdAt,
                    },
                    unreadCount: conv.unreadCount + 1,
                  }
                : conv
            ),
          }
        }
      )
    }
    // Unbinds only this listener, not the ones other hooks hold for the event.
    return onRealtime(EVENTS.messageNew, onNewMessage)
  }, [queryClient])

  return query
}