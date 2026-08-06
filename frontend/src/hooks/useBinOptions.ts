import { useEffect, useMemo, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { DEMO_BIN_OPTIONS } from '@/data/masters/demoBinSeed'
import { fetchLookup, fetchMasterBins } from '@/services/api/masterApi'

export type BinOption = {
  id: string
  code: string
  name: string
  warehouseId?: string
  storageLocationId?: string
}

/** Sync cache for mappers / save payloads (populated when bins load in API mode). */
let purchaseBinCache: BinOption[] = isApiMode() ? [] : DEMO_BIN_OPTIONS

export function getCachedPurchaseBins(): BinOption[] {
  return purchaseBinCache
}

export function setCachedPurchaseBins(bins: BinOption[]): void {
  purchaseBinCache = bins
}

function mapLookupBins(
  rows: Array<{
    id: string
    code?: string
    name: string
    warehouseId?: string
    storageLocationId?: string
  }>,
): BinOption[] {
  return rows
    .filter((b) => Boolean(b?.id))
    .map((b) => ({
      id: b.id,
      code: String(b.code ?? b.name ?? '').trim() || b.id,
      name: String(b.name ?? b.code ?? '').trim() || b.id,
      warehouseId: b.warehouseId ?? undefined,
      storageLocationId: b.storageLocationId ?? undefined,
    }))
}

/**
 * Active bins for transaction line drop-downs.
 * Prefer full master list (includes warehouseId), fall back to lookup.
 * When `warehouseId` is set: try warehouse-scoped first, then all bins if empty.
 */
export function useBinOptions(warehouseId?: string | null): BinOption[] {
  const [bins, setBins] = useState<BinOption[]>(() => (isApiMode() ? [] : DEMO_BIN_OPTIONS))

  useEffect(() => {
    if (!isApiMode()) {
      const demo = DEMO_BIN_OPTIONS.filter(
        (b) => !warehouseId || !b.warehouseId || b.warehouseId === warehouseId,
      )
      const next = demo.length ? demo : DEMO_BIN_OPTIONS
      setBins(next)
      setCachedPurchaseBins(next)
      return
    }

    let cancelled = false
    const wh = warehouseId?.trim() || undefined

    void (async () => {
      const loadMaster = async (params?: { warehouseId?: string }) => {
        const res = await fetchMasterBins(params)
        return mapLookupBins(
          res.map((b) => ({
            id: b.id,
            code: b.code ?? b.name,
            name: b.name,
            warehouseId: b.warehouseId as string | undefined,
            storageLocationId: b.storageLocationId as string | undefined,
          })),
        )
      }

      const loadLookup = async (params?: { warehouseId?: string }) => {
        const res = await fetchLookup('bins', params)
        return mapLookupBins(res.data)
      }

      try {
        // Full master list first — warehouse metadata + pagination
        let rows = await loadMaster(wh ? { warehouseId: wh } : undefined)
        if (cancelled) return
        // Scoped warehouse empty? load all so the field remains usable.
        if (wh && rows.length === 0) {
          rows = await loadMaster(undefined)
        }
        if (cancelled) return
        if (rows.length > 0) {
          setBins(rows)
          setCachedPurchaseBins(rows)
          return
        }
      } catch {
        /* try lookup */
      }

      try {
        let rows = await loadLookup(wh ? { warehouseId: wh } : undefined)
        if (cancelled) return
        if (wh && rows.length === 0) {
          rows = await loadLookup(undefined)
        }
        if (cancelled) return
        setBins(rows)
        setCachedPurchaseBins(rows)
      } catch {
        if (!cancelled) {
          setBins([])
          setCachedPurchaseBins([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [warehouseId])

  return bins
}

/** PR line dropdown — value is BIN code (legacy PR stores code, not id). */
export function useBinCodeOptions() {
  const bins = useBinOptions()
  return useMemo(
    () =>
      bins.map((b) => ({
        value: b.code,
        label: b.code && b.name && b.name !== b.code ? `${b.code} — ${b.name}` : b.code || b.name,
        text: b.name,
        attributes: {} as Record<string, string | number | boolean | null>,
      })),
    [bins],
  )
}

