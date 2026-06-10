import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface UsersByRole    { _id: string; count: number }
interface ProjectsByDept { _id: string; count: number }
interface ProjectsByStatus { _id: string; count: number }

export interface AdminStats {
  overview: {
    totalUsers:         number
    newUsersThisMonth:  number
    totalProjects:      number
    activeProjects:     number
    seekingProjects:    number
    totalMessages:      number
    messagesThisMonth:  number
    totalTasks:         number
    completedTasks:     number
  }
  charts: {
    usersByRole:        UsersByRole[]
    projectsByDepartment: ProjectsByDept[]
    projectsByStatus:   ProjectsByStatus[]
  }
  recentUsers: {
    _id:        string
    name:       string
    email:      string
    role:       string
    department?: string
    createdAt:  string
  }[]
  recentProjects: {
    _id:        string
    title:      string
    department: string
    status:     string
    members:    any[]
    createdAt:  string
  }[]
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn:  () => apiFetch('/api/admin/stats'),
    staleTime: 60 * 1000,
  })
}