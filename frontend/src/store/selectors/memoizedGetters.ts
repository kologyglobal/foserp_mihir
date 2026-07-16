/**
 * Reference-stable memoization for Zustand store getters.
 * When the source slice reference is unchanged, returns the same derived reference.
 * Prevents "Maximum update depth exceeded" from selectors that allocate arrays/objects.
 */

interface MemoEntry<T> {
  sourceRef: unknown
  value: T
}

const cache = new Map<string, MemoEntry<unknown>>()

export function memoizedOnSource<T>(sourceRef: unknown, cacheKey: string, compute: () => T): T {
  const hit = cache.get(cacheKey)
  if (hit && hit.sourceRef === sourceRef) return hit.value as T
  const value = compute()
  cache.set(cacheKey, { sourceRef, value })
  return value
}

/** Clear memo cache — for tests only */
export function clearMemoizedGetterCache(): void {
  cache.clear()
}
