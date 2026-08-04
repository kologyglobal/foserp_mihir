import { getPurchaseLineBaseUomCode, resolveUomCode } from '@/utils/purchaseLineUom'
import { useMasterStore } from '@/store/masterStore'

export type DualQtyPrintValues = {
  purchaseQty: number
  purchaseUom: string
  stockQty: number
  stockUom: string
  showDual: boolean
}

function purchaseUomCodeForItem(itemId: string | null | undefined, fallback: string): string {
  if (!itemId) return fallback.trim().toUpperCase() || 'NOS'
  const item = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!item) return fallback.trim().toUpperCase() || 'NOS'
  const purchaseId = item.purchaseUomId || item.baseUomId
  return (resolveUomCode(purchaseId, fallback) || fallback).trim().toUpperCase() || 'NOS'
}

function conversionFactorForItem(
  itemId: string | null | undefined,
  lineFactor: number | null | undefined,
): number {
  const factor = Number(lineFactor ?? 0)
  if (factor > 0) return factor
  if (!itemId) return 1
  const item = useMasterStore.getState().items.find((i) => i.id === itemId)
  if (!item) return 1
  const sameUom = !item.purchaseUomId || item.purchaseUomId === item.baseUomId
  if (sameUom) return 1
  return Number(item.uomConversionFactor ?? item.purchaseQtyPerUom ?? 1) || 1
}

/** Resolve stacked purchase + stock qty for purchase document print/PDF. */
export function resolveDualQtyForPrint(input: {
  stockQty: number
  stockUom?: string | null
  purchaseQty?: number | null
  purchaseUom?: string | null
  uomConversionFactor?: number | null
  itemId?: string | null
}): DualQtyPrintValues {
  const stockQty = Number(input.stockQty) || 0
  const stockUom =
    (input.stockUom || getPurchaseLineBaseUomCode(input.itemId) || input.purchaseUom || 'NOS')
      .trim()
      .toUpperCase() || 'NOS'
  const factor = conversionFactorForItem(input.itemId, input.uomConversionFactor)
  const purchaseUom = (
    input.purchaseUom ||
    purchaseUomCodeForItem(input.itemId, input.stockUom || stockUom)
  )
    .trim()
    .toUpperCase() || stockUom

  let purchaseQty = input.purchaseQty != null ? Number(input.purchaseQty) : NaN
  if (!Number.isFinite(purchaseQty)) {
    purchaseQty = factor === 1 ? stockQty : stockQty * factor
  }

  const showDual =
    purchaseUom !== stockUom || Math.abs(purchaseQty - stockQty) > 1e-6

  return { purchaseQty, purchaseUom, stockQty, stockUom, showDual }
}
