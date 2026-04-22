import { useEffect, useRef } from 'react'

type ShortcutHandler = (e: KeyboardEvent) => void

export type Shortcut = {
  /** Keys to display in the help modal, e.g. ['g', 'j'] or ['?'] */
  keys: string[]
  description: string
  /** If true, fires even when an input/textarea is focused */
  allowInInput?: boolean
}

/**
 * Returns true when the event target is an editable element.
 * Shortcuts should be suppressed in that case (unless allowInInput is set).
 */
function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  const isContentEditable = (e.target as HTMLElement)?.isContentEditable
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isContentEditable
}

/**
 * Register a keyboard shortcut.
 *
 * @param key        The key to listen for (e.target.key value, case-sensitive)
 * @param handler    Callback fired when the key is pressed
 * @param options    { allowInInput, meta, ctrl, shift, alt }
 */
export function useKeyboardShortcut(
  key: string,
  handler: ShortcutHandler,
  options: {
    allowInInput?: boolean
    meta?: boolean
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    enabled?: boolean
  } = {},
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (options.enabled === false) return

    function onKeyDown(e: KeyboardEvent) {
      if (!options.allowInInput && isEditableTarget(e)) return
      if (options.meta && !e.metaKey) return
      if (options.ctrl && !e.ctrlKey) return
      if (options.shift !== undefined && e.shiftKey !== options.shift) return
      if (options.alt && !e.altKey) return
      if (e.key !== key) return
      handlerRef.current(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, options.allowInInput, options.meta, options.ctrl, options.shift, options.alt, options.enabled])
}

/**
 * Two-key sequence shortcut (e.g. "g then j").
 * The second key must be pressed within 1 second of the first.
 */
export function useKeySequence(
  firstKey: string,
  secondKey: string,
  handler: () => void,
  options: { enabled?: boolean } = {},
) {
  const pendingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (options.enabled === false) return

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e)) return

      if (!pendingRef.current) {
        if (e.key === firstKey) {
          pendingRef.current = true
          timerRef.current = setTimeout(() => {
            pendingRef.current = false
          }, 1000)
        }
        return
      }

      // Second key window
      if (timerRef.current) clearTimeout(timerRef.current)
      pendingRef.current = false

      if (e.key === secondKey) {
        e.preventDefault()
        handlerRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [firstKey, secondKey, options.enabled])
}
