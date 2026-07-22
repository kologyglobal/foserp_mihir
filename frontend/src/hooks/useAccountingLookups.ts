import { useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import {
  listCustomerLookups,
  listVendorLookups,
  type AccountingCustomerLookup,
  type AccountingVendorLookup,
} from '../services/api/accountingLookupsApi'

/**
 * Party options for accounting document forms via the accounting lookup APIs
 * (`/accounting/lookups/customers|vendors`).
 *
 * Returns `null` while loading, on failure, or outside API mode — callers fall
 * back to the store-hydrated master list (real API data in API mode, demo data
 * only in demo mode). Never substitutes demo data in API mode.
 */
export function useAccountingCustomerLookups(enabled: boolean): AccountingCustomerLookup[] | null {
  const [items, setItems] = useState<AccountingCustomerLookup[] | null>(null)

  useEffect(() => {
    if (!enabled || !isApiMode()) return
    let cancelled = false
    listCustomerLookups({ limit: 100 })
      .then((res) => {
        if (!cancelled) setItems(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems(null)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return items
}

export function useAccountingVendorLookups(enabled: boolean): AccountingVendorLookup[] | null {
  const [items, setItems] = useState<AccountingVendorLookup[] | null>(null)

  useEffect(() => {
    if (!enabled || !isApiMode()) return
    let cancelled = false
    listVendorLookups({ limit: 100 })
      .then((res) => {
        if (!cancelled) setItems(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems(null)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return items
}
