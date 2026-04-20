import type { ActivityLog } from '../../../drizzle/schema/activity_log'

const EVENT_ICONS: Record<string, string> = {
  'job.created': '✦',
  'job.assigned': '→',
  'status.changed': '◎',
  'vendor.overridden': '⚡',
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function JobTimeline({ entries }: { entries: ActivityLog[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">No activity recorded yet.</p>
    )
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ol aria-label="Job activity timeline" className="space-y-4">
      {sorted.map((entry, i) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--chip-bg)] text-xs text-[var(--lagoon-deep)]"
            >
              {EVENT_ICONS[entry.eventType] ?? '•'}
            </span>
            {i < sorted.length - 1 && (
              <span
                aria-hidden="true"
                className="mt-1 w-px flex-1 bg-[var(--line)]"
              />
            )}
          </div>
          <div className="pb-4">
            <p className="m-0 text-sm text-[var(--sea-ink)]">{entry.summary}</p>
            <time
              dateTime={new Date(entry.createdAt).toISOString()}
              className="text-xs text-[var(--sea-ink-soft)]"
            >
              {formatDateTime(entry.createdAt)}
            </time>
            {entry.eventType === 'vendor.overridden' &&
              entry.metadata &&
              typeof entry.metadata === 'object' &&
              'reason' in entry.metadata &&
              entry.metadata.reason && (
                <p className="mt-1 rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-xs text-[var(--sea-ink-soft)]">
                  Reason: {String(entry.metadata.reason)}
                </p>
              )}
          </div>
        </li>
      ))}
    </ol>
  )
}
