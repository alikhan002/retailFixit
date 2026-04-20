import { Badge } from '#/components/ui/Badge'

type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
type JobPriority = 'low' | 'medium' | 'high' | 'urgent'

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  assigned: { label: 'Assigned', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
}

const PRIORITY_CONFIG: Record<
  JobPriority,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' }
> = {
  low: { label: 'Low', variant: 'muted' },
  medium: { label: 'Medium', variant: 'default' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'danger' },
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function JobPriorityBadge({ priority }: { priority: JobPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
