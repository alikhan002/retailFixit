import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Button } from '#/components/ui/Button'
import { AiRecommendationPanel } from '#/components/jobs/AiRecommendationPanel'
import { useAssignJobMutation, useVendorsQuery } from '#/hooks/use-jobs-query'

type Props = {
  jobId: number
  currentVendorId: number | null
  jobStatus: string
}

export function AssignmentWorkflow({ jobId, currentVendorId, jobStatus }: Props) {
  const { data: vendors } = useVendorsQuery()
  const assignMutation = useAssignJobMutation()
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>(
    currentVendorId ?? '',
  )
  const [confirmed, setConfirmed] = useState(false)
  const [confirmStep, setConfirmStep] = useState(false)

  const isAssigned = jobStatus === 'assigned' || jobStatus === 'in_progress'
  const isCompleted = jobStatus === 'completed' || jobStatus === 'cancelled'

  const vendorList = (vendors ?? []).map((v) => ({ id: v.id, name: v.name }))

  async function handleAssign() {
    if (!selectedVendorId) return
    await assignMutation.mutateAsync({ jobId, vendorId: Number(selectedVendorId) })
    setConfirmed(true)
    setConfirmStep(false)
  }

  if (isCompleted) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        This job is {jobStatus} and cannot be reassigned.
      </p>
    )
  }

  if (confirmed || (isAssigned && !confirmStep)) {
    const vendor = vendors?.find((v) => v.id === (currentVendorId ?? Number(selectedVendorId)))
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--palm)]">
        <CheckCircle size={16} aria-hidden="true" />
        <span>
          Assigned to <strong>{vendor?.name ?? 'vendor'}</strong>
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* AI panel — isolated, never blocks manual flow */}
      <AiRecommendationPanel
        jobId={jobId}
        vendors={vendorList}
        onAccept={(vendorId) => setSelectedVendorId(vendorId)}
      />

      {/* Manual vendor selection */}
      <div>
        <label
          htmlFor="vendor-select"
          className="mb-1.5 block text-sm font-semibold text-[var(--sea-ink)]"
        >
          Assign vendor
        </label>
        <select
          id="vendor-select"
          value={selectedVendorId}
          onChange={(e) =>
            setSelectedVendorId(e.target.value ? Number(e.target.value) : '')
          }
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] focus:outline-2 focus:outline-[var(--lagoon)]"
          aria-label="Select a vendor to assign"
        >
          <option value="">Select a vendor…</option>
          {(vendors ?? []).map((v) => (
            <option key={v.id} value={v.id} disabled={v.status === 'offline'}>
              {v.name} — {v.specialty ?? 'General'} ({v.status})
            </option>
          ))}
        </select>
      </div>

      {!confirmStep ? (
        <Button
          variant="primary"
          disabled={!selectedVendorId}
          onClick={() => setConfirmStep(true)}
          aria-label="Proceed to confirm vendor assignment"
        >
          Assign vendor
        </Button>
      ) : (
        <div className="island-shell rounded-xl p-4">
          <p className="mb-3 text-sm text-[var(--sea-ink)]">
            Confirm assignment to{' '}
            <strong>
              {vendors?.find((v) => v.id === Number(selectedVendorId))?.name}
            </strong>
            ?
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              loading={assignMutation.isPending}
              onClick={handleAssign}
              aria-label="Confirm vendor assignment"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmStep(false)}
              disabled={assignMutation.isPending}
            >
              Cancel
            </Button>
          </div>
          {assignMutation.isError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              Assignment failed. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
