import { useJobsStore } from '#/stores/jobs-store'
import { useVendorsQuery } from '#/hooks/use-jobs-query'
import { Button } from '#/components/ui/Button'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const selectClass =
  'rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] focus:outline-2 focus:outline-[var(--lagoon)] cursor-pointer'

const inputClass =
  'rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] focus:outline-2 focus:outline-[var(--lagoon)]'

export function JobFilters() {
  const { filters, setFilter, resetFilters } = useJobsStore()
  const { data: vendors } = useVendorsQuery()

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.vendorId !== undefined ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined

  return (
    <div
      role="search"
      aria-label="Filter jobs"
      className="flex flex-wrap items-center gap-2"
    >
      <select
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value)}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by priority"
        value={filters.priority}
        onChange={(e) => setFilter('priority', e.target.value)}
        className={selectClass}
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {vendors && vendors.length > 0 && (
        <select
          aria-label="Filter by vendor"
          value={filters.vendorId ?? ''}
          onChange={(e) =>
            setFilter('vendorId', e.target.value ? Number(e.target.value) : undefined)
          }
          className={selectClass}
        >
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} aria-label="Clear all filters">
          Clear filters
        </Button>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="Filter from date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilter('dateFrom', e.target.value || undefined)}
          className={inputClass}
          title="From date"
        />
        <span className="text-xs text-[var(--sea-ink-soft)]">–</span>
        <input
          type="date"
          aria-label="Filter to date"
          value={filters.dateTo ?? ''}
          min={filters.dateFrom}
          onChange={(e) => setFilter('dateTo', e.target.value || undefined)}
          className={inputClass}
          title="To date"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} aria-label="Clear all filters">
          Clear filters
        </Button>
      )}
    </div>
  )
}
