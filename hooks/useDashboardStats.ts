import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface RecentProject {
  _id: string
  title: string
  status: string
  updatedAt: string
  department: string
}

interface DashboardStats {
  activeProjects: number
  recruitingProjects: number
  totalResearchers: number
  recentProjects: RecentProject[]
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch('/api/dashboard/stats'),
    staleTime: 30 * 1000, // 30 seconds
  })
}