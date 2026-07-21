import { useCallback, useRef } from 'react'

/**
 * Stable idempotency key per confirmation payload — reused on retry (network error / user
 * re-click), regenerated only when the underlying payload signature changes. Mirrors the pattern
 * used across treasury transfers / bank-reconciliation allocation & reversal pages.
 */
export function useIdempotencyKey(signature: string): () => string {
  const ref = useRef<{ signature: string; key: string } | null>(null)

  return useCallback((): string => {
    if (ref.current && ref.current.signature === signature) {
      return ref.current.key
    }
    const key = crypto.randomUUID()
    ref.current = { signature, key }
    return key
  }, [signature])
}
