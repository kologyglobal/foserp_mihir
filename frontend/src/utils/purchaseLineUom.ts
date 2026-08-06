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

/** Default purchase UOM from Item Master conversions (or legacy purchaseUomId). */
export function resolveDefaultPurchaseUom(
  itemId: string | null | undefined,
): PurchaseLineUomOption | null {
  if (!itemId) return null
  const options = getPurchaseLineUomOptions(itemId)
  if (!options.length) return null
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  const defaultConversion = master?.uomConversions?.find(
    (row) => row.isPurchaseAllowed && row.isDefaultPurchase,
  )
  if (defaultConversion) {
    const hit = options.find((o) => o.id === defaultConversion.uomId)
    if (hit) return hit
  }
  if (master?.purchaseUomId) {
    const hit = options.find((o) => o.id === master.purchaseUomId)
    if (hit) return hit
  }
  return options[0] ?? null
}

/** Primary/base qty from purchase qty + conversion factor (vendor units per 1 base). */
export function purchaseQtyToBaseQty(purchaseQty: number, factor: number): number {
  const f = Number(factor) > 0 ? Number(factor) : 1
  const q = Number(purchaseQty) || 0
  if (f === 1) return q
  return Number((q / f).toFixed(4))
}

/** Purchase/vendor qty from primary/base qty (mirror of purchaseQtyToBaseQty). */
export function toUomQuantityFromBase(baseQty: number, factor: number): number {
  const f = Number(factor) > 0 ? Number(factor) : 1
  const q = Number(baseQty) || 0
  if (f === 1) return q
  return Number((q * f).toFixed(4))
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

/** GRN conversion hint — e.g. "1 NOS = 3 MTR". */
export function formatGrnUomConversionLabel(
  factor: number,
  baseUom: string,
  purchaseUom: string,
): string {
  const f = Number(factor) || 1
  if (f === 1 || !baseUom || !purchaseUom || baseUom === purchaseUom) return '—'
  return `1 ${baseUom} = ${formatPurchaseQty(f)} ${purchaseUom}`
}

/** Plan alias: vendor qty → stock/base qty (uses existing conversion architecture). */
export function calculateGRNLineConversion(input: {
  receivedUomQuantity: number
  conversionFactor: number
  baseUom?: string | null
}): { receivedQuantity: number; baseUom: string } {
  const receivedQuantity = purchaseQtyToBaseQty(
    input.receivedUomQuantity,
    input.conversionFactor,
  )
  return {
    receivedQuantity,
    baseUom: input.baseUom?.trim() || '',
  }
}

export function formatPurchaseQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}
