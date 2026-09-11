import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { DEPARTMENTS } from '@/lib/departments'

/**
 * Departments to offer as filters: the shared list plus any in use that are
 * not on it. Starts from the shared list, so a filter never renders empty
 * while the request is in flight.
 */
export function useDepartments() {
  const query = useQuery<{ departments: string[] }>({
    queryKey: ['departments'],
    queryFn:  () => apiFetch('/api/departments'),
    staleTime: 5 * 60 * 1000,
  })

  return query.data?.departments ?? [...DEPARTMENTS]
}
