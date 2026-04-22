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
  staleJobDetails: Map<number, { jobTitle?: string; vendorName?: string }>
  markJobStale: (jobId: number, detail?: { jobTitle?: string; vendorName?: string }) => void
  clearStaleJob: (jobId: number) => void
  // Keyboard shortcuts help modal
  shortcutsOpen: boolean
  openShortcuts: () => void
  closeShortcuts: () => void
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
  staleJobDetails: new Map(),
  markJobStale: (jobId, detail) =>
    set((s) => ({
      staleJobIds: new Set([...s.staleJobIds, jobId]),
      staleJobDetails: new Map([...s.staleJobDetails, [jobId, detail ?? {}]]),
    })),
  clearStaleJob: (jobId) =>
    set((s) => {
      const nextIds = new Set(s.staleJobIds)
      nextIds.delete(jobId)
      const nextDetails = new Map(s.staleJobDetails)
      nextDetails.delete(jobId)
      return { staleJobIds: nextIds, staleJobDetails: nextDetails }
    }),

  shortcutsOpen: false,
  openShortcuts: () => set({ shortcutsOpen: true }),
  closeShortcuts: () => set({ shortcutsOpen: false }),
}))
