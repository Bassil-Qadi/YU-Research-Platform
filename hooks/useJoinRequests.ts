import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'
export type MemberRole = 'co-pi' | 'contributor' | 'observer'

export interface JoinRequest {
  _id:       string
  projectId: string
  message?:  string
  position?: string
  status:    JoinRequestStatus
  createdAt: string
  userId: {
    _id:        string
    name:       string
    email?:     string
    avatarUrl?: string
    department?: string
    position?:  string
    researchInterests?: string[]
  }
}

/** The review queue. Only PI and co-PIs may load it, so it stays disabled otherwise. */
export function useJoinRequests(projectId: string, enabled: boolean) {
  return useQuery<{ requests: JoinRequest[] }>({
    queryKey: ['join-requests', projectId],
    queryFn:  () => apiFetch(`/api/projects/${projectId}/join-requests`),
    enabled:  !!projectId && enabled,
  })
}

/** The caller's own pending request on this project, if they have one. */
export function useMyJoinRequest(projectId: string, enabled: boolean) {
  return useQuery<{ request: { _id: string; status: JoinRequestStatus } | null }>({
    queryKey: ['join-request', projectId, 'mine'],
    queryFn:  () => apiFetch(`/api/projects/${projectId}/join-requests?mine=true`),
    enabled:  !!projectId && enabled,
  })
}

export function useJoinRequestActions(projectId: string) {
  const queryClient = useQueryClient()

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['join-requests', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['join-request', projectId, 'mine'] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    ])

  const request = useMutation({
    mutationFn: (input: { message?: string; position?: string }) =>
      apiFetch(`/api/projects/${projectId}/join-requests`, {
        method: 'POST',
        body:   JSON.stringify(input),
      }),
    onSuccess: refresh,
  })

  const withdraw = useMutation({
    mutationFn: (requestId: string) =>
      apiFetch(`/api/projects/${projectId}/join-requests/${requestId}`, {
        method: 'DELETE',
      }),
    onSuccess: refresh,
  })

  const review = useMutation({
    mutationFn: ({
      requestId,
      ...body
    }:
      | { requestId: string; status: 'approved'; role: MemberRole }
      | { requestId: string; status: 'declined'; reason?: string }) =>
      apiFetch(`/api/projects/${projectId}/join-requests/${requestId}`, {
        method: 'PATCH',
        body:   JSON.stringify(body),
      }),
    onSuccess: refresh,
  })

  return { request, withdraw, review }
}

export function useTransferPi(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/projects/${projectId}/transfer-pi`, {
        method: 'POST',
        body:   JSON.stringify({ userId }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })
}
