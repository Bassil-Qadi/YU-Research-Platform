import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { EVENTS } from '@/lib/realtime/channels'
import { onRealtime, subscribeProject } from '@/lib/realtime/client'

export type TaskStatus   = 'todo' | 'in-progress' | 'in-review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface ITask {
  _id:        string
  projectId:  string
  title:      string
  description?: string
  status:     TaskStatus
  priority:   TaskPriority
  order:      number
  dueDate?:   string
  assigneeId?: { _id: string; name: string; avatarUrl?: string } | null
  createdBy:  { _id: string; name: string }
  commentCount?: number
  createdAt:  string
  updatedAt:  string
}

export const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'bg-slate-500'  },
  { id: 'in-progress', label: 'In Progress',  color: 'bg-blue-500'   },
  { id: 'in-review',   label: 'In Review',    color: 'bg-amber-500'  },
  { id: 'done',        label: 'Done',         color: 'bg-emerald-500'},
]

export function useProjectTasks(projectId: string) {
  const queryClient = useQueryClient()

  const query = useQuery<{ tasks: ITask[] }>({
    queryKey: ['tasks', projectId],
    queryFn:  () => apiFetch(`/api/projects/${projectId}/tasks`),
    enabled:  !!projectId,
  })

  useEffect(() => {
    if (!projectId) return
    // Task events are published to the project channel, so the board has to
    // hold it. It used to rely on the chat having joined, which stopped
    // happening as soon as the two moved into separate tabs.
    const leaveChannel = subscribeProject(projectId)

    const onTaskCreated = (task: ITask) => {
      // This browser can hold several project channels at once.
      if (task.projectId !== projectId) return

      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: [...(old?.tasks ?? []), task],
        })
      )
    }

    const onTaskUpdated = (updated: ITask) => {
      if (updated.projectId !== projectId) return

      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: (old?.tasks ?? []).map((t) =>
            // The update payload has no comment count (only the list computes
            // it), so carry the one we already have across.
            t._id === updated._id ? { ...updated, commentCount: t.commentCount } : t
          ),
        })
      )
    }

    const onTaskDeleted = ({ taskId }: { taskId: string }) => {
      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: (old?.tasks ?? []).filter((t) => t._id !== taskId),
        })
      )
    }

    // Keep each card's comment count current without refetching the board.
    const bumpComments = (taskId: string, by: number) =>
      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: (old?.tasks ?? []).map((t) =>
            t._id === taskId
              ? { ...t, commentCount: Math.max(0, (t.commentCount ?? 0) + by) }
              : t
          ),
        })
      )
    const onCommentAdded   = ({ taskId }: { taskId: string }) => bumpComments(taskId, 1)
    const onCommentRemoved = ({ taskId }: { taskId: string }) => bumpComments(taskId, -1)

    // Each unbinds only its own listener, not the ones other hooks hold.
    const unbind = [
      onRealtime(EVENTS.taskCreated, onTaskCreated),
      onRealtime(EVENTS.taskUpdated, onTaskUpdated),
      onRealtime(EVENTS.taskDeleted, onTaskDeleted),
      onRealtime(EVENTS.commentNew, onCommentAdded),
      onRealtime(EVENTS.commentDeleted, onCommentRemoved),
    ]

    return () => {
      unbind.forEach((off) => off())
      leaveChannel()
    }
  }, [projectId, queryClient])

  return query
}