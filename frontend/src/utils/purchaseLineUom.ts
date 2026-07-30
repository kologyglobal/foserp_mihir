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

/** Base / stock UOM code from Item Master (NOS, etc.). */
export function getPurchaseLineBaseUomCode(itemId: string | null | undefined): string {
  if (!itemId) return ''
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!master?.baseUomId) return ''
  return resolveUomCode(master.baseUomId, '')
}

/** True when purchase unit differs from base (e.g. MTR vs NOS). */
export function purchaseLineHasDualUom(line: {
  itemId?: string | null
  uomConversionFactor?: number | null
}): boolean {
  const factor = Number(line.uomConversionFactor ?? 1)
  if (factor !== 1) return true
  if (!line.itemId) return false
  const master = useMasterStore.getState().items.find((i) => i.id === line.itemId)
  if (!master) return false
  return Boolean(master.purchaseUomId && master.purchaseUomId !== master.baseUomId)
}

export function formatPurchaseQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}
