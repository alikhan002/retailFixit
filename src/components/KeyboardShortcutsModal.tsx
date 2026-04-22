import { useEffect, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useJobsStore } from '#/stores/jobs-store'
import { useKeyboardShortcut } from '#/hooks/use-keyboard-shortcuts'

type ShortcutRow = {
  keys: string[]
  description: string
  context?: string
}

const SHORTCUTS: ShortcutRow[] = [
  // Global
  { keys: ['?'], description: 'Show / hide this help panel', context: 'Global' },
  { keys: ['g', 'j'], description: 'Go to Job Dashboard', context: 'Global' },
  { keys: ['Escape'], description: 'Close modal / go back', context: 'Global' },
  // Dashboard
  { keys: ['r'], description: 'Refresh job list', context: 'Dashboard' },
  { keys: ['/'], description: 'Focus status filter', context: 'Dashboard' },
  { keys: ['f'], description: 'Clear all filters', context: 'Dashboard' },
  { keys: ['n'], description: 'Next page', context: 'Dashboard' },
  { keys: ['p'], description: 'Previous page', context: 'Dashboard' },
  // Job Detail
  { keys: ['b'], description: 'Back to dashboard', context: 'Job Detail' },
  { keys: ['a'], description: 'Focus vendor assignment select', context: 'Job Detail' },
  { keys: ['t'], description: 'Scroll to activity timeline', context: 'Job Detail' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-[var(--line)] bg-[var(--chip-bg)] px-1.5 font-mono text-xs font-semibold text-[var(--sea-ink)] shadow-[0_1px_0_var(--line)]">
      {children === ' ' ? 'Space' : children}
    </kbd>
  )
}

export function KeyboardShortcutsModal() {
  const shortcutsOpen = useJobsStore((s) => s.shortcutsOpen)
  const closeShortcuts = useJobsStore((s) => s.closeShortcuts)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync open/close with <dialog>
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (shortcutsOpen && !el.open) el.showModal()
    if (!shortcutsOpen && el.open) el.close()
  }, [shortcutsOpen])

  // Close on backdrop click
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function onClick(e: MouseEvent) {
      if (e.target === el) closeShortcuts()
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [closeShortcuts])

  // Escape key closes (allowInInput so it works everywhere)
  useKeyboardShortcut('Escape', () => closeShortcuts(), { allowInInput: true, enabled: shortcutsOpen })

  const contexts = [...new Set(SHORTCUTS.map((s) => s.context))]

  return (
    <dialog
      ref={dialogRef}
      onClose={closeShortcuts}
      className="m-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-0 shadow-[0_24px_64px_rgba(23,58,64,0.22)] backdrop:bg-[rgba(10,20,24,0.5)] backdrop:backdrop-blur-sm"
      aria-label="Keyboard shortcuts"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
        <div className="flex items-center gap-2">
          <Keyboard size={16} className="text-[var(--lagoon-deep)]" aria-hidden="true" />
          <h2 className="m-0 text-base font-semibold text-[var(--sea-ink)]">
            Keyboard Shortcuts
          </h2>
        </div>
        <button
          onClick={closeShortcuts}
          className="rounded-lg p-1 text-[var(--sea-ink-soft)] hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)]"
          aria-label="Close shortcuts panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Shortcut groups */}
      <div className="divide-y divide-[var(--line)]">
        {contexts.map((ctx) => (
          <div key={ctx} className="px-6 py-4">
            <p className="island-kicker mb-3">{ctx}</p>
            <div className="space-y-2">
              {SHORTCUTS.filter((s) => s.context === ctx).map((s) => (
                <div key={s.description} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[var(--sea-ink-soft)]">{s.description}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-[var(--sea-ink-soft)]">then</span>
                        )}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="border-t border-[var(--line)] px-6 py-3">
        <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
          Shortcuts are disabled when typing in an input field.
        </p>
      </div>
    </dialog>
  )
}
