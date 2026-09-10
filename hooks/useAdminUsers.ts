import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { UserRole, UserStatus } from '@/types'

export interface AdminUser {
  _id:          string
  name:         string
  email:        string
  role:         UserRole
  status:       UserStatus
  department?:  string
  position?:    string
  universityId: string
  avatarUrl?:   string
  createdAt:    string
  rejectionReason?: string
}

export interface AdminUsersResponse {
  users: AdminUser[]
  pagination: { total: number; page: number; limit: number; pages: number }
  counts: Partial<Record<UserStatus | 'unknown', number>>
}

export interface AdminUserFilters {
  q?:      string
  status?: UserStatus | 'all'
  role?:   UserRole | 'all'
  page?:   number
}

export function useAdminUsers(filters: AdminUserFilters) {
  const params = new URLSearchParams()
  if (filters.q)      params.set('q', filters.q)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.role   && filters.role   !== 'all') params.set('role', filters.role)
  if (filters.page)   params.set('page', String(filters.page))

  return useQuery<AdminUsersResponse>({
    queryKey: ['admin-users', filters],
    queryFn:  () => apiFetch(`/api/admin/users?${params.toString()}`),
  })
}

export interface AdminUserUpdate {
  userId:  string
  status?: UserStatus
  role?:   UserRole
  reason?: string
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, ...changes }: AdminUserUpdate) =>
      apiFetch<AdminUser>(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body:   JSON.stringify(changes),
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        // The pending queue and the headline stats both show the same people.
        queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]),
  })
}
