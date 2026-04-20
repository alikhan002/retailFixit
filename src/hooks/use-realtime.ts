import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobsStore } from '#/stores/jobs-store'

/**
 * Simulates SSE real-time job updates.
 * In production, replace the setInterval with an EventSource connection.
 */
export function useRealtimeJobs() {
  const qc = useQueryClient()
  const { markJobStale } = useJobsStore()
  const tickRef = useRef(0)

  useEffect(() => {
    // Simulate a job status update every 15 seconds
    const interval = setInterval(() => {
      tickRef.current += 1

      // Alternate between job 1 and job 3 for demo purposes
      const jobId = tickRef.current % 2 === 0 ? 1 : 3

      // Notify the user non-intrusively if they might have a form open
      markJobStale(jobId)

      // Invalidate query cache — UI updates automatically
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    }, 15_000)

    return () => clearInterval(interval)
  }, [qc, markJobStale])
}
