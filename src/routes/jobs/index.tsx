import { createFileRoute, Link } from '@tanstack/react-router'
import { RefreshCw, AlertCircle, Briefcase, FilterX } from 'lucide-react'
import { JobCard } from '#/components/jobs/JobCard'
import { JobFilters } from '#/components/jobs/JobFilters'
import { JobCardSkeleton } from '#/components/ui/Skeleton'
import { Button } from '#/components/ui/Button'
import { useJobsQuery } from '#/hooks/use-jobs-query'
import { useJobsStore } from '#/stores/jobs-store'
import { useRealtimeJobs } from '#/hooks/use-realtime'
import { useKeyboardShortcut } from '#/hooks/use-keyboard-shortcuts'

export const Route = createFileRoute('/jobs/')({
  component: JobDashboard,
  errorComponent: JobDashboardError,
})

function RealtimeBanner() {
  const staleJobIds = useJobsStore((s) => s.staleJobIds)
  const clearStaleJob = useJobsStore((s) => s.clearStaleJob)

  if (staleJobIds.size === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(79,184,178,0.3)] bg-[rgba(79,184,178,0.08)] px-4 py-2.5 text-sm text-[var(--lagoon-deep)]"
    >
      <span className="flex items-center gap-2">
        <RefreshCw size={13} aria-hidden="true" />
        {staleJobIds.size === 1
          ? 'A job was updated in real-time.'
          : `${staleJobIds.size} jobs were updated in real-time.`}
      </span>
      <button
        onClick={() => staleJobIds.forEach((id) => clearStaleJob(id))}
        className="text-xs font-semibold underline hover:no-underline"
        aria-label="Dismiss real-time update notification"
      >
        Dismiss
      </button>
    </div>
  )
}

function Pagination({
  page,
  total,
  pageSize,
}: {
  page: number
  total: number
  pageSize: number
}) {
  const setFilter = useJobsStore((s) => s.setFilter)
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Job list pagination" className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => setFilter('page', page - 1)}
        aria-label="Previous page"
      >
        ← Prev
      </Button>
      <span className="text-sm text-[var(--sea-ink-soft)]">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => setFilter('page', page + 1)}
        aria-label="Next page"
      >
        Next →
      </Button>
    </nav>
  )
}

function EmptyState() {
  const { filters, resetFilters } = useJobsStore()
  const hasFilters =
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.vendorId !== undefined ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined

  if (hasFilters) {
    return (
      <div
        role="status"
        className="island-shell mt-4 flex flex-col items-center gap-3 rounded-2xl p-10 text-center"
      >
        <FilterX size={32} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
        <p className="m-0 font-semibold text-[var(--sea-ink)]">No jobs match your filters</p>
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          {filters.status !== 'all'
            ? `There are no ${filters.status.replace('_', ' ')} jobs`
            : filters.priority !== 'all'
              ? `There are no ${filters.priority} priority jobs`
              : 'No jobs match the selected criteria'}
          {(filters.dateFrom || filters.dateTo) ? ' in the selected date range' : ''}.
        </p>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="island-shell mt-4 flex flex-col items-center gap-3 rounded-2xl p-10 text-center"
    >
      <Briefcase size={32} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
      <p className="m-0 font-semibold text-[var(--sea-ink)]">No jobs yet</p>
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        New jobs will appear here as they come in. Check back soon.
      </p>
    </div>
  )
}

function JobDashboard() {
  useRealtimeJobs()
  const { data, isLoading, isError, refetch, isFetching } = useJobsQuery()
  const filters = useJobsStore((s) => s.filters)
  const { setFilter, resetFilters } = useJobsStore()

  // r — refresh
  useKeyboardShortcut('r', () => refetch())
  // f — clear filters
  useKeyboardShortcut('f', () => resetFilters())
  // / — focus status filter
  useKeyboardShortcut('/', (e) => {
    e.preventDefault()
    const el = document.querySelector<HTMLSelectElement>('[aria-label="Filter by status"]')
    el?.focus()
  })
  // n — next page
  useKeyboardShortcut('n', () => {
    if (!data) return
    const totalPages = Math.ceil(data.total / data.pageSize)
    if (filters.page < totalPages) setFilter('page', filters.page + 1)
  })
  // p — previous page
  useKeyboardShortcut('p', () => {
    if (filters.page > 1) setFilter('page', filters.page - 1)
  })

  return (
    <main className="page-wrap px-4 pb-12 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Operations</p>
          <h2 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
            Job Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <span
              aria-live="polite"
              aria-label="Refreshing jobs"
              className="flex items-center gap-1.5 text-xs text-[var(--sea-ink-soft)]"
            >
              <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
              Refreshing…
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            aria-label="Refresh job list"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <JobFilters />
      </div>

      <RealtimeBanner />

      {isLoading && (
        <div
          aria-label="Loading jobs"
          aria-busy="true"
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="island-shell mt-4 flex flex-col items-center gap-3 rounded-2xl p-10 text-center"
        >
          <AlertCircle size={32} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
          <p className="m-0 font-semibold text-[var(--sea-ink)]">Failed to load jobs</p>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Something went wrong fetching the job list.
          </p>
          <Button variant="primary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {data.jobs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <p className="mb-3 mt-4 text-sm text-[var(--sea-ink-soft)]">
                Showing {data.jobs.length} of {data.total} jobs
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              <div className="mt-6">
                <Pagination
                  page={filters.page}
                  total={data.total}
                  pageSize={data.pageSize}
                />
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}

function JobDashboardError({ error }: { error: Error }) {
  return (
    <main className="page-wrap px-4 py-12">
      <div
        role="alert"
        className="island-shell flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
      >
        <AlertCircle size={36} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
        <p className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
          Something went wrong
        </p>
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{error.message}</p>
        <Link to="/jobs" className="text-sm text-[var(--lagoon-deep)] underline">
          Reload dashboard
        </Link>
      </div>
    </main>
  )
}
