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

/** Purchase / vendor UOM code from Item Master (KG, MTR, etc.). */
export function getPurchaseLinePurchaseUomCode(itemId: string | null | undefined): string {
  if (!itemId) return ''
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!master) return ''
  const purchaseId = master.purchaseUomId || master.baseUomId
  return resolveUomCode(purchaseId, '')
}

export function resolvePurchaseLineFactor(line: {
  itemId?: string | null
  uomConversionFactor?: number | null
}): number {
  const lineFactor = Number(line.uomConversionFactor ?? 0)
  if (lineFactor > 0) return lineFactor
  if (!line.itemId) return 1
  const master = useMasterStore.getState().items.find((i) => i.id === line.itemId)
  return Number(master?.uomConversionFactor ?? master?.purchaseQtyPerUom ?? 1) || 1
}

/** Item has distinct purchase + stock UOM on this document line (uses line factor + UOM, not item master alone). */
export function purchaseLineHasDualUom(line: {
  itemId?: string | null
  uom?: string | null
  uomQuantity?: number | null
  quantity?: number | null
  uomConversionFactor?: number | null
  uomId?: string | null
}): boolean {
  const factor = resolvePurchaseLineFactor(line)
  if (!(factor > 1)) return false
  const baseUom = getPurchaseLineBaseUomCode(line.itemId).trim().toUpperCase()
  const lineUom = (line.uom || resolveUomCode(line.uomId ?? null, '')).trim().toUpperCase()
  if (!baseUom || !lineUom) return true
  return lineUom !== baseUom
}

/** @deprecated alias — prefer purchaseLineHasDualUom */
export function purchaseLineHasMuomItem(itemId: string | null | undefined): boolean {
  if (!itemId) return false
  const master = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!master?.purchaseUomId || !master.baseUomId) return false
  if (master.purchaseUomId === master.baseUomId) return false
  const purchaseCode = resolveUomCode(master.purchaseUomId, '').trim().toUpperCase()
  const baseCode = resolveUomCode(master.baseUomId, '').trim().toUpperCase()
  return Boolean(purchaseCode && baseCode && purchaseCode !== baseCode)
}

export type PurchaseLineQtyPresentation = {
  dual: boolean
  purchaseQty: number
  purchaseUom: string
  baseQty: number
  baseUom: string
}

/** Resolve PO/GRN line qty labels — vendor UOM on top, stock/base UOM beneath when MUOM applies. */
export function resolvePurchaseLineQtyPresentation(line: {
  itemId?: string | null
  uom?: string | null
  uomQuantity?: number | null
  quantity?: number | null
  uomConversionFactor?: number | null
  uomId?: string | null
}): PurchaseLineQtyPresentation {
  const factor = resolvePurchaseLineFactor(line)
  const baseUom = getPurchaseLineBaseUomCode(line.itemId) || (line.uom || '—').trim()
  const lineUom =
    (line.uom || resolveUomCode(line.uomId ?? null, '')).trim() || baseUom
  const baseQty = Number(line.quantity ?? 0) || 0
  const dual = purchaseLineHasDualUom(line)

  if (!dual) {
    const qty = baseQty || Number(line.uomQuantity ?? 0) || 0
    const uom = lineUom || baseUom || '—'
    return { dual: false, purchaseQty: qty, purchaseUom: uom, baseQty: qty, baseUom: uom }
  }

  let purchaseQty = Number(line.uomQuantity ?? 0) || 0
  const expectedPurchaseQty = toUomQuantityFromBase(baseQty, factor)
  if (
    !(purchaseQty > 0) ||
    (Math.abs(purchaseQty - baseQty) < 1e-6 && factor > 1) ||
    Math.abs(purchaseQty - expectedPurchaseQty) > Math.max(expectedPurchaseQty * 0.01, 0.05)
  ) {
    purchaseQty = expectedPurchaseQty
  }

  return {
    dual: true,
    purchaseQty,
    purchaseUom: lineUom,
    baseQty: baseQty || purchaseQtyToBaseQty(purchaseQty, factor),
    baseUom,
  }
}

/** Tracking columns (outstanding / received / invoiced) — derive vendor qty from base when needed. */
export function resolvePurchaseLineTrackingPresentation(
  line: {
    itemId?: string | null
    uom?: string | null
    uomConversionFactor?: number | null
    uomId?: string | null
  },
  purchaseQtyInput: number,
  baseQtyInput: number,
): PurchaseLineQtyPresentation {
  const factor = resolvePurchaseLineFactor(line)
  const baseUom = getPurchaseLineBaseUomCode(line.itemId) || (line.uom || '—').trim()
  const lineUom =
    (line.uom || resolveUomCode(line.uomId ?? null, '')).trim() || baseUom
  const baseQty = baseQtyInput || purchaseQtyInput
  const dual = purchaseLineHasDualUom({ ...line, quantity: baseQty, uomQuantity: purchaseQtyInput })

  if (!dual) {
    const qty = baseQty
    const uom = lineUom || baseUom || '—'
    return { dual: false, purchaseQty: qty, purchaseUom: uom, baseQty: qty, baseUom: uom }
  }

  const expectedPurchaseQty = toUomQuantityFromBase(baseQty, factor)
  let purchaseQty = purchaseQtyInput
  if (
    !(purchaseQty > 0) ||
    (Math.abs(purchaseQty - baseQty) < 1e-6 && factor > 1) ||
    Math.abs(purchaseQty - expectedPurchaseQty) > Math.max(expectedPurchaseQty * 0.01, 0.05)
  ) {
    purchaseQty = expectedPurchaseQty
  }

  return {
    dual: true,
    purchaseQty,
    purchaseUom: lineUom,
    baseQty,
    baseUom,
  }
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
