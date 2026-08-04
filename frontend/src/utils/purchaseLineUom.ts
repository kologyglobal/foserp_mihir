/**
 * Allowed PO/GRN units from Item Master UOM conversion mappings.
 * Inventory and FIFO always use base UOM quantity.
 */
import { useMasterStore } from '@/store/masterStore'
import type { ItemUomConversion } from '@/types/master'

export type PurchaseLineUomOption = {
  id: string
  code: string
  /** Vendor units per 1 primary/base unit when this option is selected. */
  factor: number
}

function codeOf(uomId: string, uoms: ReturnType<typeof useMasterStore.getState>['uoms']) {
  const u = uoms.find((row) => row.id === uomId)
  return (u?.uomCode || u?.uomName || '').trim()
}

function optionsFromConversions(
  item: {
    baseUomId: string
    purchaseUomId?: string | null
    uomConversionFactor?: number
    purchaseQtyPerUom?: number
    uomConversions?: ItemUomConversion[]
  },
  uoms: ReturnType<typeof useMasterStore.getState>['uoms'],
): PurchaseLineUomOption[] {
  const purchaseRows = (item.uomConversions ?? []).filter((c) => c.isPurchaseAllowed)
  if (purchaseRows.length > 0) {
    return purchaseRows.map((row) => ({
      id: row.uomId,
      code: row.uomCode || codeOf(row.uomId, uoms),
      factor: row.uomId === item.baseUomId ? 1 : Number(row.conversionFactor) || 1,
    }))
  }

  const purchaseId = item.purchaseUomId || item.baseUomId
  const purchaseCode = codeOf(purchaseId, uoms)
  if (!purchaseCode) return []

  const sameUom = !item.purchaseUomId || item.purchaseUomId === item.baseUomId
  const purchaseFactor = sameUom
    ? 1
    : Number(item.uomConversionFactor ?? item.purchaseQtyPerUom ?? 1) || 1

  const options: PurchaseLineUomOption[] = [
    { id: purchaseId, code: purchaseCode, factor: purchaseFactor },
  ]

  if (!sameUom) {
    const baseCode = codeOf(item.baseUomId, uoms)
    if (baseCode) {
      options.push({ id: item.baseUomId, code: baseCode, factor: 1 })
    }
  }

  return options
}

export function getPurchaseLineUomOptions(itemId: string | null | undefined): PurchaseLineUomOption[] {
  if (!itemId) return []
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!master?.baseUomId) return []
  return optionsFromConversions(master, useMasterStore.getState().uoms)
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
  uomId?: string | null
}): boolean {
  const factor = Number(line.uomConversionFactor ?? 1)
  if (factor !== 1) return true
  if (!line.itemId) return false
  const master = useMasterStore.getState().items.find((i) => i.id === line.itemId)
  if (!master) return false
  if (line.uomId && line.uomId !== master.baseUomId) return true
  return Boolean(master.purchaseUomId && master.purchaseUomId !== master.baseUomId)
}

export function formatPurchaseQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}
