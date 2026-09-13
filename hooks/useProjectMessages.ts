import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { EVENTS, isPartial } from '@/lib/realtime/channels'
import { onRealtime, subscribeProject } from '@/lib/realtime/client'

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
    const leaveChannel = subscribeProject(projectId)

    // When a new message arrives, append it to the cache
    const onNewMessage = (message: IMessagePopulated) => {
      // This browser can hold several project channels at once.
      if (message.projectId !== projectId) return

      // Too large to publish whole: refetch rather than append a stub.
      if (isPartial(message)) {
        queryClient.invalidateQueries({ queryKey: ['messages', projectId] })
        return
      }

      queryClient.setQueryData(
        ['messages', projectId],
        (old: { messages: IMessagePopulated[] } | undefined) => ({
          messages: [...(old?.messages ?? []), message],
        })
      )
    }
    // Unbinds only this listener, not the ones other hooks hold for the event.
    const unbind = onRealtime(EVENTS.messageNew, onNewMessage)

    return () => {
      unbind()
      leaveChannel()
    }
  }, [projectId, queryClient])

  return query
}