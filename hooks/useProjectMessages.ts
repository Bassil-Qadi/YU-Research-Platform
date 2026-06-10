import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getSocket } from '@/lib/socket-client'

export interface IMessagePopulated {
  _id:       string
  projectId: string
  content:   string
  createdAt: string
  senderId: {
    _id:       string
    name:      string
    avatarUrl?: string
    position?: string
  }
}

export function useProjectMessages(projectId: string) {
  const queryClient = useQueryClient()

  const query = useQuery<{ messages: IMessagePopulated[] }>({
    queryKey: ['messages', projectId],
    queryFn:  () => apiFetch(`/api/projects/${projectId}/messages`),
    enabled:  !!projectId,
  })

  useEffect(() => {
    if (!projectId) return
    const socket = getSocket()

    socket.emit('join-project', projectId)

    // When a new message arrives via socket, append it to the cache
    socket.on('new-message', (message: IMessagePopulated) => {
      queryClient.setQueryData(
        ['messages', projectId],
        (old: { messages: IMessagePopulated[] } | undefined) => ({
          messages: [...(old?.messages ?? []), message],
        })
      )
    })

    return () => {
      socket.emit('leave-project', projectId)
      socket.off('new-message')
    }
  }, [projectId, queryClient])

  return query
}