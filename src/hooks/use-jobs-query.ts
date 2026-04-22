import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs, getJobById, getVendors, assignJob, getAiRecommendation, logAiOverride } from '#/lib/server-fns'
import { useJobsStore } from '#/stores/jobs-store'
import { useSessionStore } from '#/stores/session-store'

export function useJobsQuery() {
  const filters = useJobsStore((s) => s.filters)
  const currentUser = useSessionStore((s) => s.currentUser)

  // Vendor managers are scoped to their own vendor — enforced server-side
  const scopeVendorId =
    currentUser.role === 'vendor_manager' ? currentUser.managedVendorId : undefined

  return useQuery({
    queryKey: ['jobs', filters, scopeVendorId],
    queryFn: () =>
      getJobs({
        data: {
          status: filters.status,
          priority: filters.priority,
          vendorId: filters.vendorId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          scopeVendorId,
          page: filters.page,
          pageSize: 10,
        },
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useJobDetailQuery(jobId: number) {
  const currentUser = useSessionStore((s) => s.currentUser)
  const scopeVendorId =
    currentUser.role === 'vendor_manager' ? currentUser.managedVendorId : undefined

  return useQuery({
    queryKey: ['job', jobId, scopeVendorId],
    queryFn: () => getJobById({ data: { id: jobId, scopeVendorId } }),
    staleTime: 20_000,
    retry: false, // Don't retry 403s
  })
}

export function useVendorsQuery() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => getVendors(),
    staleTime: 60_000,
  })
}

export function useAiRecommendationQuery(jobId: number, enabled = true) {
  return useQuery({
    queryKey: ['ai-recommendation', jobId],
    queryFn: () => getAiRecommendation({ data: { jobId } }),
    enabled,
    retry: 1,
    staleTime: 60_000,
  })
}

export function useAssignJobMutation() {
  const qc = useQueryClient()
  const filters = useJobsStore((s) => s.filters)

  return useMutation({
    mutationFn: (vars: { jobId: number; vendorId: number }) =>
      assignJob({ data: vars }),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['job', vars.jobId] })
      const previous = qc.getQueryData(['job', vars.jobId])
      qc.setQueryData(['job', vars.jobId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        return { ...(old as object), status: 'assigned', assignedVendorId: vars.vendorId }
      })
      return { previous }
    },

    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['job', vars.jobId], ctx.previous)
      }
    },

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['job', vars.jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', filters] })
    },
  })
}

export function useLogAiOverrideMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      jobId: number
      aiVendorId: number
      chosenVendorId: number
      reason?: string
    }) => logAiOverride({ data: vars }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['job', vars.jobId] })
    },
  })
}
