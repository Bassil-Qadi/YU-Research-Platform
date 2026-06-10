import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getSocket } from '@/lib/socket-client'

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

    socket.on('task-created', (task: ITask) => {
      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: [...(old?.tasks ?? []), task],
        })
      )
    })

    socket.on('task-updated', (updated: ITask) => {
      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: (old?.tasks ?? []).map((t) =>
            t._id === updated._id ? updated : t
          ),
        })
      )
    })

    socket.on('task-deleted', ({ taskId }: { taskId: string }) => {
      queryClient.setQueryData(
        ['tasks', projectId],
        (old: { tasks: ITask[] } | undefined) => ({
          tasks: (old?.tasks ?? []).filter((t) => t._id !== taskId),
        })
      )
    })

    return () => {
      socket.off('task-created')
      socket.off('task-updated')
      socket.off('task-deleted')
    }
  }, [projectId, queryClient])

  return query
}