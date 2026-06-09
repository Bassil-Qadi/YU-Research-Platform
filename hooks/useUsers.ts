import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface UserSummary {
  _id: string
  name: string
  email: string
  department?: string
  position?: string
  researchInterests: string[]
  avatarUrl?: string
  role: string
  bio?: string
}

interface UsersResponse {
  users: UserSummary[]
  pagination: { total: number; page: number; limit: number; pages: number }
}

interface UseUsersParams {
  q?: string
  department?: string
  role?: string
  page?: number
}

export function useUsers(params: UseUsersParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.q)          searchParams.set('q', params.q)
  if (params.department) searchParams.set('department', params.department)
  if (params.role)       searchParams.set('role', params.role)
  if (params.page)       searchParams.set('page', String(params.page))

  return useQuery<UsersResponse>({
    queryKey: ['users', params],
    queryFn: () => apiFetch(`/api/users?${searchParams.toString()}`),
  })
}