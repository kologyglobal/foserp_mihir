import { useCallback, useEffect, useMemo, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { searchItemLookups, type ItemLookupRow } from '../services/api/masterBatchApi'
import { formatApiError } from '../services/api/apiErrors'
import { useMasterStore } from '../store/masterStore'
import type { Item } from '../types/master'
import { useDebouncedValue } from './useDebouncedValue'

export interface ItemLookupSelection {
  itemId: string
  itemCode: string
  itemName: string
  itemType: string
  uomId?: string
  uomName?: string
}

export interface ItemLookupOption extends ItemLookupSelection {
  label: string
  searchText: string
  isActive: boolean
}

function mapStoreItem(item: Item, getUomName: (id: string) => string): ItemLookupOption {
  const uomId = item.baseUomId
  return {
    itemId: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemType: item.itemType,
    uomId,
    uomName: uomId ? getUomName(uomId).split(' ')[0] : undefined,
    label: `${item.itemCode} — ${item.itemName}`,
    searchText: `${item.itemCode} ${item.itemName} ${item.itemType}`.toLowerCase(),
    isActive: item.isActive,
  }
}

function mapApiRow(row: ItemLookupRow, getUomName: (id: string) => string): ItemLookupOption {
  return {
    itemId: row.id,
    itemCode: row.code,
    itemName: row.name,
    itemType: row.itemType,
    uomId: row.baseUomId,
    uomName: row.baseUomId ? getUomName(row.baseUomId).split(' ')[0] : undefined,
    label: `${row.code} — ${row.name}`,
    searchText: `${row.code} ${row.name} ${row.itemType}`.toLowerCase(),
    isActive: row.status === 'ACTIVE',
  }
}

export function useItemLookup(options?: {
  itemType?: string
  activeOnly?: boolean
  selectedId?: string
  initialQuery?: string
}) {
  const storeItems = useMasterStore((s) => s.items)
  const getItem = useMasterStore((s) => s.getItem)
  const getUomName = useMasterStore((s) => s.getUomName)
  const activeOnly = options?.activeOnly ?? true
  const itemType = options?.itemType

  const [query, setQuery] = useState(options?.initialQuery ?? '')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [optionsList, setOptionsList] = useState<ItemLookupOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (!isApiMode()) {
      const needle = q.trim().toLowerCase()
      const filtered = storeItems
        .filter((i) => (activeOnly ? i.isActive : true))
        .filter((i) => !itemType || i.itemType === itemType)
        .filter((i) => !needle || i.itemCode.toLowerCase().includes(needle) || i.itemName.toLowerCase().includes(needle))
        .slice(0, 25)
        .map((i) => mapStoreItem(i, getUomName))
      setOptionsList(filtered)
      return filtered
    }

    setLoading(true)
    setError(null)
    try {
      const res = await searchItemLookups({
        search: q.trim() || undefined,
        itemType,
        activeOnly,
        limit: 25,
      })
      const rows = res.data.map((r) => mapApiRow(r, getUomName))
      setOptionsList(rows)
      return rows
    } catch (err) {
      setError(formatApiError(err))
      setOptionsList([])
      return []
    } finally {
      setLoading(false)
    }
  }, [storeItems, getUomName, activeOnly, itemType])

  useEffect(() => {
    void search(debouncedQuery)
  }, [debouncedQuery, search])

  const mergedOptions = useMemo(() => {
    const selectedId = options?.selectedId
    if (!selectedId) return optionsList
    if (optionsList.some((o) => o.itemId === selectedId)) return optionsList
    const sel = getItem(selectedId)
    if (!sel) return optionsList
    return [mapStoreItem(sel, getUomName), ...optionsList]
  }, [optionsList, options?.selectedId, getItem, getUomName])

  const selected = useMemo(() => {
    const id = options?.selectedId
    if (!id) return undefined
    return mergedOptions.find((o) => o.itemId === id) ?? (getItem(id) ? mapStoreItem(getItem(id)!, getUomName) : undefined)
  }, [mergedOptions, options?.selectedId, getItem, getUomName])

  return { query, setQuery, options: mergedOptions, loading, error, search, selected }
}
