import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, AlertCircle, MapPin, User, Phone, Mail, Calendar } from 'lucide-react'
import { JobStatusBadge, JobPriorityBadge } from '#/components/jobs/JobStatusBadge'
import { JobTimeline } from '#/components/jobs/JobTimeline'
import { AssignmentWorkflow } from '#/components/jobs/AssignmentWorkflow'
import { JobDetailSkeleton } from '#/components/ui/Skeleton'
import { useJobDetailQuery } from '#/hooks/use-jobs-query'
import { useJobsStore } from '#/stores/jobs-store'
import { useSessionStore } from '#/stores/session-store'
import { useKeyboardShortcut } from '#/hooks/use-keyboard-shortcuts'

export const Route = createFileRoute('/jobs/$jobId/')({
  component: JobDetailPage,
  errorComponent: JobDetailError,
})

function StaleBanner({ jobId }: { jobId: number }) {
  const staleJobIds = useJobsStore((s) => s.staleJobIds)
  const clearStaleJob = useJobsStore((s) => s.clearStaleJob)

  if (!staleJobIds.has(jobId)) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[rgba(79,184,178,0.3)] bg-[rgba(79,184,178,0.08)] px-4 py-2.5 text-sm text-[var(--lagoon-deep)]"
    >
      <span>This job was updated — data has been refreshed.</span>
      <button
        onClick={() => clearStaleJob(jobId)}
        className="text-xs font-semibold underline hover:no-underline"
        aria-label="Dismiss update notification"
      >
        Dismiss
      </button>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-[var(--sea-ink-soft)]" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span className="sr-only">{label}: </span>
        <span className="text-[var(--sea-ink)]">{value}</span>
      </div>
    </div>
  )
}

function JobDetailPage() {
  const { jobId } = Route.useParams()
  const id = Number(jobId)
  const { data: job, isLoading, isError, refetch } = useJobDetailQuery(id)
  const { currentUser } = useSessionStore()
  const canAssignRole = currentUser.role === 'dispatcher' || currentUser.role === 'admin'
  const router = useRouter()

  // b — back to dashboard
  useKeyboardShortcut('b', () => router.navigate({ to: '/jobs' }))
  // a — focus vendor assignment select
  useKeyboardShortcut('a', (e) => {
    e.preventDefault()
    const el = document.querySelector<HTMLSelectElement>('#vendor-select')
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  // t — scroll to timeline
  useKeyboardShortcut('t', () => {
    const el = document.querySelector<HTMLElement>('[data-timeline]')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  if (isLoading) {
    return (
      <main className="page-wrap px-4 pb-12 pt-8" aria-busy="true" aria-label="Loading job details">
        <Link
          to="/jobs"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to jobs
        </Link>
        <JobDetailSkeleton />
      </main>
    )
  }

  if (isError || !job) {
    return (
      <main className="page-wrap px-4 py-12">
        <div
          role="alert"
          className="island-shell flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
        >
          <AlertCircle size={36} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
          <p className="m-0 text-lg font-semibold text-[var(--sea-ink)]">Job not found</p>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            This job may have been removed or the ID is invalid.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="text-sm text-[var(--lagoon-deep)] underline"
            >
              Try again
            </button>
            <Link to="/jobs" className="text-sm text-[var(--lagoon-deep)] underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const canAssign = job.status === 'pending' || job.status === 'assigned'

  return (
    <main className="page-wrap px-4 pb-12 pt-8">
      <Link
        to="/jobs"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
        aria-label="Back to job dashboard"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to jobs
      </Link>

      <StaleBanner jobId={id} />

      {/* Header */}
      <div className="island-shell mb-4 rounded-2xl p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <h2 className="display-title m-0 text-2xl font-bold text-[var(--sea-ink)] sm:text-3xl">
            {job.title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <JobPriorityBadge priority={job.priority as 'low' | 'medium' | 'high' | 'urgent'} />
            <JobStatusBadge
              status={
                job.status as
                  | 'pending'
                  | 'assigned'
                  | 'in_progress'
                  | 'completed'
                  | 'cancelled'
              }
            />
          </div>
        </div>

        {job.description && (
          <p className="mb-4 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
            {job.description}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <MetaRow icon={<User size={14} />} label="Customer" value={job.customerName} />
          <MetaRow icon={<Mail size={14} />} label="Email" value={job.customerEmail} />
          <MetaRow icon={<Phone size={14} />} label="Phone" value={job.customerPhone} />
          <MetaRow icon={<MapPin size={14} />} label="Address" value={job.address} />
          {job.scheduledAt && (
            <MetaRow
              icon={<Calendar size={14} />}
              label="Scheduled"
              value={new Date(job.scheduledAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left: timeline */}
        <div className="island-shell rounded-2xl p-6" data-timeline>
          <h3 className="m-0 mb-4 text-base font-semibold text-[var(--sea-ink)]">
            Activity Timeline
          </h3>
          <JobTimeline entries={job.activityLog ?? []} />
        </div>

        {/* Right: assignment */}
        <div className="space-y-4">
          {canAssign && canAssignRole && (
            <div className="island-shell rounded-2xl p-6">
              <h3 className="m-0 mb-4 text-base font-semibold text-[var(--sea-ink)]">
                Vendor Assignment
              </h3>
              <AssignmentWorkflow
                jobId={job.id}
                currentVendorId={job.assignedVendorId ?? null}
                jobStatus={job.status}
              />
            </div>
          )}

          {job.assignedVendor && (
            <div className="island-shell rounded-2xl p-5">
              <p className="island-kicker mb-2">Assigned Vendor</p>
              <p className="m-0 font-semibold text-[var(--sea-ink)]">
                {job.assignedVendor.name}
              </p>
              <p className="m-0 mt-0.5 text-sm text-[var(--sea-ink-soft)]">
                Status:{' '}
                <span className="capitalize">{job.assignedVendor.status}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function JobDetailError({ error }: { error: Error }) {
  return (
    <main className="page-wrap px-4 py-12">
      <div
        role="alert"
        className="island-shell flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
      >
        <AlertCircle size={36} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
        <p className="m-0 text-lg font-semibold text-[var(--sea-ink)]">Something went wrong</p>
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{error.message}</p>
        <Link to="/jobs" className="text-sm text-[var(--lagoon-deep)] underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
