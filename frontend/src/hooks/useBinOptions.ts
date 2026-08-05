import { useEffect, useMemo, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { DEMO_BIN_OPTIONS } from '@/data/masters/demoBinSeed'
import { fetchLookup } from '@/services/api/masterApi'

export type BinOption = {
  id: string
  code: string
  name: string
  warehouseId?: string
  storageLocationId?: string
}

export function useBinOptions(): BinOption[] {
  const [bins, setBins] = useState<BinOption[]>(() => (isApiMode() ? [] : DEMO_BIN_OPTIONS))

  useEffect(() => {
    if (!isApiMode()) {
      setBins(DEMO_BIN_OPTIONS)
      return
    }
    let cancelled = false
    fetchLookup('bins')
      .then((res) => {
        if (cancelled) return
        setBins(
          res.data.map((b) => ({
            id: b.id,
            code: b.code ?? b.name,
            name: b.name,
            warehouseId: b.warehouseId ?? undefined,
            storageLocationId: b.storageLocationId ?? undefined,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setBins([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return bins
}

/** PR line dropdown — value is BIN code (legacy PR stores code, not id). */
export function useBinCodeOptions() {
  const bins = useBinOptions()
  return useMemo(
    () =>
      bins.map((b) => ({
        value: b.code,
        label: b.name,
        text: b.name,
        attributes: {} as Record<string, string | number | boolean | null>,
      })),
    [bins],
  )
}
