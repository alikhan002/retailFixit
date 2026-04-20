import { useState } from 'react'
import { Sparkles, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { AiPanelSkeleton } from '#/components/ui/Skeleton'
import { Button } from '#/components/ui/Button'
import { useAiRecommendationQuery, useLogAiOverrideMutation } from '#/hooks/use-jobs-query'
import type { AiRecommendationResult } from '#/lib/server-fns'

type AiPanelState = 'loading' | 'success' | 'error' | 'overridden' | 'unavailable'

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 85 ? 'bg-[var(--palm)]' : pct >= 65 ? 'bg-[#c08000]' : 'bg-[var(--sea-ink-soft)]'
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--sea-ink-soft)]">Confidence</span>
        <span className="font-semibold text-[var(--sea-ink)]">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI confidence: ${pct}%`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type OverrideFormProps = {
  rec: AiRecommendationResult
  jobId: number
  vendors: { id: number; name: string }[]
  onDone: (chosenVendorId: number) => void
  onCancel: () => void
}

function OverrideForm({ rec, jobId, vendors, onDone, onCancel }: OverrideFormProps) {
  const [chosenId, setChosenId] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const logOverride = useLogAiOverrideMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chosenId) return
    await logOverride.mutateAsync({
      jobId,
      aiVendorId: rec.vendorId,
      chosenVendorId: Number(chosenId),
      reason: reason.trim() || undefined,
    })
    onDone(Number(chosenId))
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label
          htmlFor="override-vendor"
          className="mb-1 block text-xs font-semibold text-[var(--sea-ink)]"
        >
          Choose a different vendor
        </label>
        <select
          id="override-vendor"
          value={chosenId}
          onChange={(e) => setChosenId(e.target.value ? Number(e.target.value) : '')}
          required
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] focus:outline-2 focus:outline-[var(--lagoon)]"
        >
          <option value="">Select vendor…</option>
          {vendors
            .filter((v) => v.id !== rec.vendorId)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="override-reason"
          className="mb-1 block text-xs font-semibold text-[var(--sea-ink)]"
        >
          Reason (optional)
        </label>
        <textarea
          id="override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why are you overriding the AI suggestion?"
          className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:outline-2 focus:outline-[var(--lagoon)]"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={logOverride.isPending}
          disabled={!chosenId}
        >
          Confirm override
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

type Props = {
  jobId: number
  vendors: { id: number; name: string }[]
  onAccept: (vendorId: number) => void
}

export function AiRecommendationPanel({ jobId, vendors, onAccept }: Props) {
  const { data: rec, isLoading, isError } = useAiRecommendationQuery(jobId)
  const [panelState, setPanelState] = useState<AiPanelState>('loading')
  const [overriddenVendorName, setOverriddenVendorName] = useState<string | null>(null)
  const [showOverrideForm, setShowOverrideForm] = useState(false)

  // Sync query state → panel state
  if (isLoading && panelState === 'loading') {
    // still loading — skeleton shown below
  } else if (!isLoading && panelState === 'loading') {
    if (isError) setPanelState('error')
    else if (!rec) setPanelState('unavailable')
    else setPanelState('success')
  }

  if (isLoading) {
    return (
      <section aria-label="AI vendor recommendation — loading">
        <AiPanelSkeleton />
      </section>
    )
  }

  if (isError || panelState === 'error') {
    return (
      <section
        aria-label="AI vendor recommendation — unavailable"
        className="island-shell rounded-2xl p-5"
      >
        <div className="flex items-start gap-2 text-[var(--sea-ink-soft)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
              AI recommendation unavailable
            </p>
            <p className="m-0 mt-0.5 text-xs">
              The recommendation service is temporarily unavailable. You can still assign a vendor
              manually below.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (!rec || panelState === 'unavailable') {
    return (
      <section
        aria-label="AI vendor recommendation — no suggestion"
        className="island-shell rounded-2xl p-5"
      >
        <div className="flex items-start gap-2 text-[var(--sea-ink-soft)]">
          <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="m-0 text-sm">
            No AI recommendation available for this job. Assign a vendor manually.
          </p>
        </div>
      </section>
    )
  }

  if (panelState === 'overridden') {
    return (
      <section
        aria-label="AI vendor recommendation — overridden"
        className="island-shell rounded-2xl p-5 opacity-70"
      >
        <div className="mb-2 flex items-center gap-2">
          <XCircle size={14} className="text-[var(--sea-ink-soft)]" aria-hidden="true" />
          <span className="island-kicker text-[var(--sea-ink-soft)]">AI suggestion overridden</span>
        </div>
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          AI suggested <strong>{rec.vendorName}</strong> ({Math.round(rec.confidenceScore * 100)}%
          confidence). You chose{' '}
          <strong className="text-[var(--sea-ink)]">{overriddenVendorName}</strong>.
        </p>
        <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Override logged to activity timeline.</p>
      </section>
    )
  }

  return (
    <section
      aria-label="AI vendor recommendation"
      className="island-shell rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--lagoon-deep)]" aria-hidden="true" />
        <span className="island-kicker">AI Recommendation</span>
      </div>

      <p className="m-0 text-base font-semibold text-[var(--sea-ink)]">{rec.vendorName}</p>
      <ConfidenceBar score={rec.confidenceScore} />

      {rec.reasoning && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--sea-ink-soft)]">{rec.reasoning}</p>
      )}

      {!showOverrideForm ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onAccept(rec.vendorId)
              setPanelState('overridden')
              setOverriddenVendorName(rec.vendorName)
            }}
            aria-label={`Accept AI recommendation: assign ${rec.vendorName}`}
          >
            <CheckCircle size={13} aria-hidden="true" />
            Accept suggestion
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOverrideForm(true)}
            aria-label="Override AI recommendation and choose a different vendor"
          >
            <XCircle size={13} aria-hidden="true" />
            Override
          </Button>
        </div>
      ) : (
        <OverrideForm
          rec={rec}
          jobId={jobId}
          vendors={vendors}
          onDone={(chosenVendorId) => {
            const v = vendors.find((v) => v.id === chosenVendorId)
            setOverriddenVendorName(v?.name ?? 'Unknown')
            setPanelState('overridden')
            setShowOverrideForm(false)
            onAccept(chosenVendorId)
          }}
          onCancel={() => setShowOverrideForm(false)}
        />
      )}
    </section>
  )
}
