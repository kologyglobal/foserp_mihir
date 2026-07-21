import { useCallback, useRef } from 'react'

/** Stable idempotency key per confirmation payload â€” mirrors treasury cheque/transfer pattern. */
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
