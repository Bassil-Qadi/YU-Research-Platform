import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface ProjectSummary {
  _id: string
  title: string
  abstract: string
  department: string
  status: 'active' | 'completed' | 'seeking' | 'paused'
  visibility: string
  tags: string[]
  members: { userId: { _id: string; name: string; avatarUrl?: string }; role: string }[]
  openPositions: string[]
  createdAt: string
  updatedAt: string
}

interface ProjectsResponse {
  projects: ProjectSummary[]
  pagination: { total: number; page: number; limit: number; pages: number }
}

interface UseProjectsParams {
  q?: string
  status?: string
  department?: string
  mine?: boolean
  page?: number
}

export function useProjects(params: UseProjectsParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.q)          searchParams.set('q', params.q)
  if (params.status)     searchParams.set('status', params.status)
  if (params.department) searchParams.set('department', params.department)
  if (params.mine)       searchParams.set('mine', 'true')
  if (params.page)       searchParams.set('page', String(params.page))

  return useQuery<ProjectsResponse>({
    queryKey: ['projects', params],
    queryFn: () => apiFetch(`/api/projects?${searchParams.toString()}`),
  })
}