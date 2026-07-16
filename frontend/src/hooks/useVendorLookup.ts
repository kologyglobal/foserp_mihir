import { useCallback, useEffect, useMemo, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { searchVendorLookups, type VendorLookupRow } from '../services/api/masterBatchApi'
import { formatApiError } from '../services/api/apiErrors'
import { useMasterStore } from '../store/masterStore'
import type { Vendor } from '../types/master'
import { useDebouncedValue } from './useDebouncedValue'

export interface VendorLookupSelection {
  vendorId: string
  vendorCode: string
  vendorName: string
  gstin: string
  city: string
}

export interface VendorLookupOption extends VendorLookupSelection {
  label: string
  searchText: string
  isActive: boolean
}

function mapStoreVendor(v: Vendor): VendorLookupOption {
  return {
    vendorId: v.id,
    vendorCode: v.vendorCode,
    vendorName: v.vendorName,
    gstin: v.gstin,
    city: v.city,
    label: `${v.vendorCode} — ${v.vendorName}`,
    searchText: `${v.vendorCode} ${v.vendorName} ${v.searchName ?? ''} ${v.gstin} ${v.city}`.toLowerCase(),
    isActive: v.isActive,
  }
}

function mapApiRow(row: VendorLookupRow): VendorLookupOption {
  return {
    vendorId: row.id,
    vendorCode: row.code,
    vendorName: row.name,
    gstin: row.gstin,
    city: row.city,
    label: `${row.code} — ${row.name}`,
    searchText: `${row.code} ${row.name} ${row.searchName ?? ''} ${row.gstin} ${row.city}`.toLowerCase(),
    isActive: row.status === 'ACTIVE',
  }
}

export function useVendorLookup(options?: { activeOnly?: boolean; selectedId?: string; initialQuery?: string }) {
  const vendors = useMasterStore((s) => s.vendors)
  const getVendor = useMasterStore((s) => s.getVendor)
  const activeOnly = options?.activeOnly ?? true

  const [query, setQuery] = useState(options?.initialQuery ?? '')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [optionsList, setOptionsList] = useState<VendorLookupOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (!isApiMode()) {
      const needle = q.trim().toLowerCase()
      const filtered = vendors
        .filter((v) => (activeOnly ? v.isActive : true))
        .filter((v) => !needle || mapStoreVendor(v).searchText.includes(needle))
        .slice(0, 25)
        .map(mapStoreVendor)
      setOptionsList(filtered)
      return filtered
    }

    setLoading(true)
    setError(null)
    try {
      const res = await searchVendorLookups({
        search: q.trim() || undefined,
        activeOnly,
        limit: 25,
      })
      const rows = res.data.map(mapApiRow)
      setOptionsList(rows)
      return rows
    } catch (err) {
      setError(formatApiError(err))
      setOptionsList([])
      return []
    } finally {
      setLoading(false)
    }
  }, [vendors, activeOnly])

  useEffect(() => {
    void search(debouncedQuery)
  }, [debouncedQuery, search])

  const mergedOptions = useMemo(() => {
    const selectedId = options?.selectedId
    if (!selectedId) return optionsList
    if (optionsList.some((o) => o.vendorId === selectedId)) return optionsList
    const sel = getVendor(selectedId)
    if (!sel) return optionsList
    return [mapStoreVendor(sel), ...optionsList]
  }, [optionsList, options?.selectedId, getVendor])

  const selected = useMemo(() => {
    const id = options?.selectedId
    if (!id) return undefined
    return mergedOptions.find((o) => o.vendorId === id) ?? (getVendor(id) ? mapStoreVendor(getVendor(id)!) : undefined)
  }, [mergedOptions, options?.selectedId, getVendor])

  return { query, setQuery, options: mergedOptions, loading, error, search, selected }
}
