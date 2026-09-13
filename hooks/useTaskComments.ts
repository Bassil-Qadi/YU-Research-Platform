import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { EVENTS } from '@/lib/realtime/channels'
import { onRealtime, subscribeProject } from '@/lib/realtime/client'

export interface TaskCommentAttachment {
  name:         string
  url:          string
  bytes:        number
  contentType:  string
  resourceType: 'image' | 'raw'
}

export interface TaskCommentItem {
  _id:       string
  taskId:    string
  /** Empty when the comment is nothing but its attachment. */
  content:   string
  attachment?: TaskCommentAttachment
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
    // Comment events go to the project channel; hold it while the thread is open.
    const leaveChannel = subscribeProject(projectId)

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

    const unbind = [
      onRealtime(EVENTS.commentNew, onNew),
      onRealtime(EVENTS.commentUpdated, onUpdated),
      onRealtime(EVENTS.commentDeleted, onDeleted),
    ]

    return () => {
      unbind.forEach((off) => off())
      leaveChannel()
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

  // Text alone goes as JSON; a file rides along with it in one multipart
  // request, so an upload cannot succeed while its comment fails.
  const add = useMutation({
    mutationFn: ({ content, file }: { content: string; file?: File | null }) => {
      if (!file) {
        return apiFetch<TaskCommentItem>(base, {
          method: 'POST',
          body:   JSON.stringify({ content }),
        })
      }

      const form = new FormData()
      form.append('content', content)
      form.append('file', file)
      return apiFetch<TaskCommentItem>(base, { method: 'POST', body: form })
    },
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
