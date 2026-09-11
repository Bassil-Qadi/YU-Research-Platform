import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getSocket, joinProjectRoom } from '@/lib/socket-client'

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
    const socket = getSocket()
    // Task events are broadcast to the project room, so the board has to be in
    // it. It used to rely on the chat having joined, which stopped happening as
    // soon as the two moved into separate tabs.
    const leaveRoom = joinProjectRoom(projectId)

    const onTaskCreated = (task: ITask) => {
      // The socket can be in several project rooms at once.
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

    socket.on('task-created', onTaskCreated)
    socket.on('task-updated', onTaskUpdated)
    socket.on('task-deleted', onTaskDeleted)
    socket.on('task-comment:new', onCommentAdded)
    socket.on('task-comment:deleted', onCommentRemoved)

    return () => {
      leaveRoom()
      // Detach only these listeners — off(event) would also drop the ones
      // other hooks registered on the shared socket.
      socket.off('task-created', onTaskCreated)
      socket.off('task-updated', onTaskUpdated)
      socket.off('task-deleted', onTaskDeleted)
      socket.off('task-comment:new', onCommentAdded)
      socket.off('task-comment:deleted', onCommentRemoved)
    }
  }, [projectId, queryClient])

  return query
}