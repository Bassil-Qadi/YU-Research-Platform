import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { getSocket, joinProjectRoom } from '@/lib/socket-client'

export interface TaskCommentItem {
  _id:       string
  taskId:    string
  content:   string
  createdAt: string
  editedAt?: string
  authorId: {
    _id:        string
    name:       string
    avatarUrl?: string
  }
}

interface ThreadData {
  comments:    TaskCommentItem[]
  canModerate: boolean
}

const key = (taskId: string) => ['task-comments', taskId] as const

export function useTaskComments(projectId: string, taskId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery<ThreadData>({
    queryKey: key(taskId ?? ''),
    queryFn:  () => apiFetch(`/api/projects/${projectId}/tasks/${taskId}/comments`),
    enabled:  !!taskId,
  })

  useEffect(() => {
    if (!taskId) return
    const socket = getSocket()
    // Comment events go to the project room; hold it while the thread is open.
    const leaveRoom = joinProjectRoom(projectId)

    const update = (fn: (comments: TaskCommentItem[]) => TaskCommentItem[]) =>
      queryClient.setQueryData(key(taskId), (old: ThreadData | undefined) =>
        old ? { ...old, comments: fn(old.comments) } : old
      )

    const onNew = (p: { taskId: string; comment: TaskCommentItem }) => {
      if (p.taskId !== taskId) return
      // The author sees their own echo too, so guard against a duplicate.
      update((c) => (c.some((x) => x._id === p.comment._id) ? c : [...c, p.comment]))
    }
    const onUpdated = (p: { taskId: string; comment: TaskCommentItem }) => {
      if (p.taskId !== taskId) return
      update((c) => c.map((x) => (x._id === p.comment._id ? p.comment : x)))
    }
    const onDeleted = (p: { taskId: string; commentId: string }) => {
      if (p.taskId !== taskId) return
      update((c) => c.filter((x) => x._id !== p.commentId))
    }

    socket.on('task-comment:new', onNew)
    socket.on('task-comment:updated', onUpdated)
    socket.on('task-comment:deleted', onDeleted)

    return () => {
      leaveRoom()
      socket.off('task-comment:new', onNew)
      socket.off('task-comment:updated', onUpdated)
      socket.off('task-comment:deleted', onDeleted)
    }
  }, [projectId, taskId, queryClient])

  return query
}

export function useTaskCommentActions(projectId: string, taskId: string) {
  const queryClient = useQueryClient()
  const base = `/api/projects/${projectId}/tasks/${taskId}/comments`

  // The thread updates from the socket echo; this only covers the case where
  // the socket is down, so a post never silently fails to appear.
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(taskId) })

  const add = useMutation({
    mutationFn: (content: string) =>
      apiFetch<TaskCommentItem>(base, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: refresh,
  })

  const edit = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiFetch<TaskCommentItem>(`${base}/${commentId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ content }),
      }),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (commentId: string) => apiFetch(`${base}/${commentId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })

  return { add, edit, remove }
}
