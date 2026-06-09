import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { UserSummary } from './useUsers'
import type { ProjectSummary } from './useProjects'

interface UserProfileResponse {
  user: UserSummary & {
    orcidId?: string
    publicationsUrl?: string
    isPublic: boolean
    createdAt: string
  }
  projects: ProjectSummary[]
}

export function useUserProfile(id: string) {
  return useQuery<UserProfileResponse>({
    queryKey: ['user', id],
    queryFn: () => apiFetch(`/api/users/${id}`),
    enabled: !!id,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<UserSummary> & { isPublic?: boolean }) =>
      apiFetch('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
    },
  })
}