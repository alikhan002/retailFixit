import { create } from 'zustand'

export type JobFilters = {
  status: string
  priority: string
  vendorId: number | undefined
  dateFrom: string | undefined
  dateTo: string | undefined
  page: number
}

type JobsStore = {
  filters: JobFilters
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void
  resetFilters: () => void
  // Assignment modal
  assignModalJobId: number | null
  openAssignModal: (jobId: number) => void
  closeAssignModal: () => void
  // Stale update banner
  staleJobIds: Set<number>
  markJobStale: (jobId: number) => void
  clearStaleJob: (jobId: number) => void
}

const DEFAULT_FILTERS: JobFilters = {
  status: 'all',
  priority: 'all',
  vendorId: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  page: 1,
}

export const useJobsStore = create<JobsStore>((set) => ({
  filters: { ...DEFAULT_FILTERS },

  setFilter: (key, value) =>
    set((s) => ({
      filters: { ...s.filters, [key]: value, page: key === 'page' ? (value as number) : 1 },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  assignModalJobId: null,
  openAssignModal: (jobId) => set({ assignModalJobId: jobId }),
  closeAssignModal: () => set({ assignModalJobId: null }),

  staleJobIds: new Set(),
  markJobStale: (jobId) =>
    set((s) => ({ staleJobIds: new Set([...s.staleJobIds, jobId]) })),
  clearStaleJob: (jobId) =>
    set((s) => {
      const next = new Set(s.staleJobIds)
      next.delete(jobId)
      return { staleJobIds: next }
    }),
}))
