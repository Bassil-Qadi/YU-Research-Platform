import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { EVENTS } from '@/lib/realtime/channels'
import { onRealtime, subscribeProject } from '@/lib/realtime/client'

export interface ProjectFile {
  _id:          string
  projectId:    string
  name:         string
  url:          string
  bytes:        number
  format?:      string
  contentType:  string
  resourceType: 'image' | 'raw'
  createdAt:    string
  uploadedBy: {
    _id:        string
    name:       string
    avatarUrl?: string
  }
}

export function useProjectFiles(projectId: string, enabled: boolean) {
  const queryClient = useQueryClient()

  const query = useQuery<{ files: ProjectFile[] }>({
    queryKey: ['project-files', projectId],
    queryFn:  () => apiFetch(`/api/projects/${projectId}/files`),
    enabled:  !!projectId && enabled,
  })

  useEffect(() => {
    if (!projectId || !enabled) return
    const leaveChannel = subscribeProject(projectId)

    const onUploaded = (file: ProjectFile) => {
      if (file.projectId !== projectId) return
      queryClient.setQueryData(
        ['project-files', projectId],
        (old: { files: ProjectFile[] } | undefined) => ({
          files: [file, ...(old?.files ?? []).filter((f) => f._id !== file._id)],
        })
      )
    }

    const onDeleted = ({ fileId }: { fileId: string }) => {
      queryClient.setQueryData(
        ['project-files', projectId],
        (old: { files: ProjectFile[] } | undefined) => ({
          files: (old?.files ?? []).filter((f) => f._id !== fileId),
        })
      )
    }

    const unbind = [
      onRealtime(EVENTS.fileUploaded, onUploaded),
      onRealtime(EVENTS.fileDeleted, onDeleted),
    ]

    return () => {
      unbind.forEach((off) => off())
      leaveChannel()
    }
  }, [projectId, enabled, queryClient])

  return query
}

export function useDeleteProjectFile(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch(`/api/projects/${projectId}/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] }),
  })
}
