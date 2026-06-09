import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { ProjectSummary } from './useProjects'

export interface ProjectDetail extends ProjectSummary {
  abstract: string
  fundingSource?: string
  fundingAmount?: number
  startDate: string
  endDate?: string
  openPositions: string[]
  createdBy: {
    _id: string
    name: string
    avatarUrl?: string
    department?: string
    position?: string
    email?: string
  }
  members: {
    userId: {
      _id: string
      name: string
      avatarUrl?: string
      department?: string
      position?: string
      email?: string
    }
    role: 'pi' | 'co-pi' | 'contributor' | 'observer'
    joinedAt: string
  }[]
}

export function useProject(id: string) {
  return useQuery<ProjectDetail>({
    queryKey: ['project', id],
    queryFn: () => apiFetch(`/api/projects/${id}`),
    enabled: !!id,
  })
}