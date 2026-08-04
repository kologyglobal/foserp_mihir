import { ValidationError } from '../../../utils/errors.js'
import {
  loadItemPurchaseUomContext,
  resolvePurchaseLineUomFromMappings,
} from '../../items/item-uom-conversion.service.js'

export type PoLineUomInput = {
  itemId?: string | null
  uomId?: string | null
  uomConversionFactor?: number | null
}

/** Apply item UOM mappings to PO line inputs before quantity normalization. */
export async function enrichPoLinesWithItemUomMappings<
  T extends PoLineUomInput,
>(tenantId: string, lines: T[]): Promise<T[]> {
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter((v): v is string => Boolean(v)))]
  const ctxByItem = await loadItemPurchaseUomContext(tenantId, itemIds)

  return lines.map((line) => {
    if (!line.itemId) return line
    const ctx = ctxByItem.get(line.itemId)
    if (!ctx) return line
    const resolved = resolvePurchaseLineUomFromMappings({
      baseUomId: ctx.baseUomId,
      legacyPurchaseUomId: ctx.legacyPurchaseUomId,
      legacyFactor: ctx.legacyFactor,
      conversions: ctx.conversions,
      requestedUomId: line.uomId,
    })
    if (
      line.uomConversionFactor != null &&
      Number(line.uomConversionFactor) > 0 &&
      Math.abs(Number(line.uomConversionFactor) - resolved.conversionFactor) > 0.0001
    ) {
      throw new ValidationError(
        'UOM conversion factor does not match the item UOM mapping for the selected unit',
      )
    }
    return {
      ...line,
      uomId: resolved.uomId,
      uomConversionFactor: resolved.conversionFactor,
    }
  })
}

/** GRN lines inherit PO UOM — reject client attempts to override conversion factor. */
export function assertGrnLineMatchesPoUom(input: {
  poConversionFactor: number
  clientFactor?: unknown
}): void {
  const clientFactor =
    input.clientFactor == null || input.clientFactor === ''
      ? null
      : Number(input.clientFactor)
  if (clientFactor != null && Number.isFinite(clientFactor) && clientFactor > 0) {
    if (Math.abs(clientFactor - input.poConversionFactor) > 0.0001) {
      throw new ValidationError('GRN cannot change purchase UOM conversion — it must match the PO line')
    }
  }
}
