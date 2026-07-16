import { useMemo } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'

/**
 * Subscribe to a stable store slice, derive in useMemo.
 * Components stay read-only; never call allocating store getters inside selectors.
 */
export function useStoreSlice<TState, TSlice>(
  useStore: UseBoundStore<StoreApi<TState>>,
  sliceSelector: (state: TState) => TSlice,
): TSlice {
  return useStore(sliceSelector)
}

export function useDerivedStoreValue<TState, TSlice, TDerived>(
  useStore: UseBoundStore<StoreApi<TState>>,
  sliceSelector: (state: TState) => TSlice,
  derive: (slice: TSlice) => TDerived,
  extraDeps: readonly unknown[] = [],
): TDerived {
  const slice = useStore(sliceSelector)
  return useMemo(() => derive(slice), [slice, ...extraDeps])
}

/** Find entity by id from a stable array slice — never use .find() inside a Zustand selector. */
export function useEntityById<T extends { id: string }>(
  useStore: UseBoundStore<StoreApi<{ [key: string]: T[] }>>,
  collectionKey: string,
  id: string | undefined,
): T | undefined {
  const collection = useStore((s) => s[collectionKey as keyof typeof s] as T[])
  return useMemo(() => {
    if (!id) return undefined
    return collection.find((row) => row.id === id)
  }, [collection, id])
}
