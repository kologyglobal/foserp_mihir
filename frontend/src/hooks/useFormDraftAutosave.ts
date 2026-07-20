import { useCallback, useEffect, useRef, useState } from 'react'

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseFormDraftAutosaveOptions<T> {
  key: string
  data: T
  enabled?: boolean
  debounceMs?: number
}

/** Local draft autosave — persists form state and shows save status */
export function useFormDraftAutosave<T>({
  key,
  data,
  enabled = true,
  debounceMs = 2000,
}: UseFormDraftAutosaveOptions<T>) {
  const [status, setStatus] = useState<DraftSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initial = useRef(true)
  /** Bumped on clear so any in-flight debounce write is ignored. */
  const writeGen = useRef(0)

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }, [key])

  const clearDraft = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    writeGen.current += 1
    localStorage.removeItem(key)
    setStatus('idle')
    setLastSavedAt(null)
  }, [key])

  useEffect(() => {
    if (!enabled) return
    if (initial.current) {
      initial.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)
    setStatus('saving')

    const gen = writeGen.current
    timer.current = setTimeout(() => {
      if (gen !== writeGen.current) return
      try {
        localStorage.setItem(key, JSON.stringify(data))
        setLastSavedAt(new Date())
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, debounceMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [data, key, enabled, debounceMs])

  const statusLabel =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved' && lastSavedAt
        ? `Saved ${formatRelativeSeconds(lastSavedAt)}`
        : status === 'error'
          ? 'Draft save failed'
          : 'Draft — not saved'

  return { status, statusLabel, lastSavedAt, loadDraft, clearDraft }
}

function formatRelativeSeconds(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec} seconds ago`
  const min = Math.floor(sec / 60)
  return `${min} minute${min === 1 ? '' : 's'} ago`
}
