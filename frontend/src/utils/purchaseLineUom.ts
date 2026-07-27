import { useMasterStore } from '@/store/masterStore'

export type PurchaseLineUomOption = {
  id: string
  code: string
  /** Vendor units per 1 primary unit when this option is selected. */
  factor: number
}

/**
 * Allowed PO/GRN units from Item Master:
 * - purchase UOM (default vendor unit) + base UOM when they differ
 * - single option when purchase is unset or equals base
 */
export function getPurchaseLineUomOptions(itemId: string | null | undefined): PurchaseLineUomOption[] {
  if (!itemId) return []
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!master?.baseUomId) return []
  const uoms = useMasterStore.getState().uoms
  const codeOf = (id: string) => {
    const u = uoms.find((row) => row.id === id)
    return (u?.uomCode || u?.uomName || '').trim()
  }

  const purchaseId = master.purchaseUomId || master.baseUomId
  const purchaseCode = codeOf(purchaseId)
  if (!purchaseCode) return []

  const sameUom = !master.purchaseUomId || master.purchaseUomId === master.baseUomId
  const purchaseFactor = sameUom
    ? 1
    : Number(master.uomConversionFactor ?? master.purchaseQtyPerUom ?? 1) || 1

  const options: PurchaseLineUomOption[] = [
    { id: purchaseId, code: purchaseCode, factor: purchaseFactor },
  ]

  if (!sameUom) {
    const baseCode = codeOf(master.baseUomId)
    if (baseCode) {
      options.push({ id: master.baseUomId, code: baseCode, factor: 1 })
    }
  }

  return options
}

export function resolveUomCode(uomId: string | null | undefined, fallback = ''): string {
  if (!uomId) return fallback
  const u = useMasterStore.getState().uoms.find((row) => row.id === uomId)
  return (u?.uomCode || u?.uomName || fallback).trim()
}
