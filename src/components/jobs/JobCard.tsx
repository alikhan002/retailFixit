import { Link } from '@tanstack/react-router'
import { MapPin, User, Clock } from 'lucide-react'
import { JobStatusBadge, JobPriorityBadge } from '#/components/jobs/JobStatusBadge'
import type { JobWithVendor } from '#/lib/server-fns'

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function JobCard({ job }: { job: JobWithVendor }) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: String(job.id) }}
      className="island-shell block rounded-2xl p-5 no-underline transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lagoon)]"
      aria-label={`View job: ${job.title}`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold leading-snug text-[var(--sea-ink)] sm:text-base">
          {job.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <JobPriorityBadge priority={job.priority as 'low' | 'medium' | 'high' | 'urgent'} />
          <JobStatusBadge status={job.status as 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'} />
        </div>
      </div>

      {job.description && (
        <p className="mb-3 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
          {job.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--sea-ink-soft)]">
        <span className="flex items-center gap-1">
          <User size={12} aria-hidden="true" />
          {job.customerName}
        </span>
        {job.address && (
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            <span className="max-w-[180px] truncate">{job.address}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden="true" />
          {formatDate(job.createdAt)}
        </span>
      </div>

      {job.assignedVendor && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--line)] pt-3 text-xs text-[var(--sea-ink-soft)]">
          <span
            className={`h-2 w-2 rounded-full ${
              job.assignedVendor.status === 'available'
                ? 'bg-[var(--palm)]'
                : job.assignedVendor.status === 'busy'
                  ? 'bg-[#c08000]'
                  : 'bg-[var(--sea-ink-soft)]'
            }`}
            aria-hidden="true"
          />
          <span>
            Assigned to <strong className="text-[var(--sea-ink)]">{job.assignedVendor.name}</strong>
          </span>
        </div>
      )}
    </Link>
  )
}
