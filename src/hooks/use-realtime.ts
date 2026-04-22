import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobsStore } from '#/stores/jobs-store'

const CHANNEL_NAME = 'job-updates'

type JobUpdateMessage = {
  type: 'job.updated'
  jobId: number
  jobTitle?: string
  vendorName?: string
}

export function useRealtimeJobs() {
  const qc = useQueryClient()
  const { markJobStale } = useJobsStore()

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)

    // ── Receive updates from other tabs ──────────────────────────────────────
    channel.onmessage = (event: MessageEvent<JobUpdateMessage>) => {
      const { type, jobId, jobTitle, vendorName } = event.data
      if (type !== 'job.updated' || !jobId) return

      markJobStale(jobId, { jobTitle, vendorName })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    }

    // ── Broadcast when THIS tab completes a mutation ──────────────────────────
    const unsubscribeMutations = qc.getMutationCache().subscribe((event) => {
      if (event.mutation?.state.status !== 'success') return

      const vars = event.mutation.state.variables as Record<string, unknown> | undefined
      const jobId = vars?.jobId as number | undefined
      if (!jobId) return

      // Pull assignment detail from the mutation result if available
      const result = event.mutation.state.data as Record<string, unknown> | undefined
      const jobTitle = result?.title as string | undefined
      const vendorName = (result?.assignedVendor as Record<string, unknown> | undefined)
        ?.name as string | undefined

      // Invalidate locally (same tab)
      markJobStale(jobId, { jobTitle, vendorName })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })

      // Notify all other tabs
      channel.postMessage({ type: 'job.updated', jobId, jobTitle, vendorName } satisfies JobUpdateMessage)
    })

    return () => {
      unsubscribeMutations()
      channel.close()
    }
  }, [qc, markJobStale])
}
