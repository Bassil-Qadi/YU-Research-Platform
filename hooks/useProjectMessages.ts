import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getSocket, joinProjectRoom } from '@/lib/socket-client'

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
    const leaveRoom = joinProjectRoom(projectId)

    // When a new message arrives via socket, append it to the cache
    const onNewMessage = (message: IMessagePopulated) => {
      // The socket can be in several project rooms at once.
      if (message.projectId !== projectId) return

      queryClient.setQueryData(
        ['messages', projectId],
        (old: { messages: IMessagePopulated[] } | undefined) => ({
          messages: [...(old?.messages ?? []), message],
        })
      )
    }
    socket.on('new-message', onNewMessage)

    return () => {
      leaveRoom()
      // Detach only this listener — off('new-message') would also drop the
      // ones other hooks registered on the shared socket.
      socket.off('new-message', onNewMessage)
    }
  }, [projectId, queryClient])

  return query
}