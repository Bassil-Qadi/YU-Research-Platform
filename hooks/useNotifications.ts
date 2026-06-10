import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { getSocket } from '@/lib/socket-client'

export interface INotification {
  _id:       string
  type:      string
  title:     string
  body:      string
  link?:     string
  read:      boolean
  createdAt: string
}

interface NotificationsResponse {
  notifications: INotification[]
  unreadCount:   number
}

export function useNotifications() {
  const { data: session }  = useSession()
  const queryClient        = useQueryClient()

  const query = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn:  () => apiFetch('/api/notifications'),
    enabled:  !!session?.user?.id,
    refetchInterval: 30_000, // poll every 30s as fallback
  })

  useEffect(() => {
    if (!session?.user?.id) return
    const socket = getSocket()

    // Join personal room for real-time notifications
    socket.emit('join-user-room', session.user.id)

    socket.on('new-notification', (notification: INotification) => {
      queryClient.setQueryData(
        ['notifications'],
        (old: NotificationsResponse | undefined) => ({
          notifications: [notification, ...(old?.notifications ?? [])],
          unreadCount:   (old?.unreadCount ?? 0) + 1,
        })
      )
    })

    return () => {
      socket.off('new-notification')
    }
  }, [session?.user?.id, queryClient])

  async function markAllRead() {
    await apiFetch('/api/notifications/read', { method: 'PATCH' })
    queryClient.setQueryData(
      ['notifications'],
      (old: NotificationsResponse | undefined) => ({
        notifications: (old?.notifications ?? []).map((n) => ({ ...n, read: true })),
        unreadCount:   0,
      })
    )
  }

  async function markOneRead(id: string) {
    await apiFetch(`/api/notifications/${id}`, { method: 'PATCH' })
    queryClient.setQueryData(
      ['notifications'],
      (old: NotificationsResponse | undefined) => ({
        notifications: (old?.notifications ?? []).map((n) =>
          n._id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max((old?.unreadCount ?? 1) - 1, 0),
      })
    )
  }

  return { ...query, markAllRead, markOneRead }
}