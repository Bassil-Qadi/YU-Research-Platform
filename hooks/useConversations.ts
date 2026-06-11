import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getSocket } from '@/lib/socket-client'

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
    const socket = getSocket()

    // When a new message arrives in any project,
    // update that conversation's last message in the list
    socket.on('new-message', (message: any) => {
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
    })

    return () => {
      socket.off('new-message')
    }
  }, [queryClient])

  return query
}