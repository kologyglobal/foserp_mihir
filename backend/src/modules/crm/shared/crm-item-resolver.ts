import type { MasterItem } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { ValidationError } from '../../../utils/errors.js'

export interface SalesLineItemRef {
  itemId?: string | null
}

export interface ResolvedSalesItem {
  item: MasterItem
}

/**
 * Phase 10 write resolver: itemId required. Product Master is engineering-only.
 */
export async function resolveSalesLineItem(
  tenantId: string,
  ref: SalesLineItemRef,
): Promise<ResolvedSalesItem> {
  const directId = ref.itemId?.trim()
  if (!directId) throw new ValidationError('Select an Item for this line')

  const item = await prisma.masterItem.findFirst({
    where: { id: directId, ...tenantActiveFilter(tenantId) },
  })
  if (!item) throw new ValidationError(`Item not found: ${directId}`)
  if (!item.salesAllowed) {
    throw new ValidationError(`Item "${item.code}" is not allowed for sales`)
  }
  if (item.status !== 'ACTIVE' || item.isBlocked) {
    throw new ValidationError(`Item "${item.code}" is not active for sales`)
  }
  return { item }
}

/**
 * @deprecated Phase 10 — productId columns dropped from CRM. Kept for one-off backfill scripts only.
 */
export async function resolveSalesLineItemId(
  tenantId: string,
  ref: { itemId?: string | null; productId?: string | null },
): Promise<string | null> {
  if (ref.itemId?.trim()) return ref.itemId.trim()
  if (!ref.productId?.trim()) return null
  const product = await prisma.masterProduct.findFirst({
    where: { id: ref.productId, ...tenantActiveFilter(tenantId) },
    select: { fgItemId: true },
  })
  return product?.fgItemId?.trim() ?? null
}

export interface SalesLineSnapshots {
  itemId: string
  itemCode: string
  itemName: string
  description?: string
  uom: string
  hsnCode?: string | null
  defaultSalesRate?: number | null
}

export function buildSalesLineSnapshots(item: MasterItem, uomFallback = 'NOS'): SalesLineSnapshots {
  return {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    description: item.salesDescription ?? item.itemDescription ?? item.name,
    uom: uomFallback,
    hsnCode: item.hsnCode,
    defaultSalesRate: item.defaultSalesRate != null ? Number(item.defaultSalesRate) : null,
  }
}

/** Normalize a sales line for persistence — requires itemId; strips legacy productId if present. */
export async function normalizeSalesLineForWrite<T extends {
  itemId?: string | null
  productId?: string | null
  productOrItem?: string
  description?: string
  uom?: string
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
}>(
  tenantId: string,
  line: T,
): Promise<Omit<T, 'productId'> & { itemId: string }> {
  if (!line.itemId?.trim()) {
    throw new ValidationError('Select an Item for this line')
  }
  const resolved = await resolveSalesLineItem(tenantId, { itemId: line.itemId })
  const snaps = buildSalesLineSnapshots(resolved.item, line.uom ?? 'NOS')
  const { productId: _ignored, ...rest } = line as T & { productId?: string | null }
  void _ignored
  return {
    ...rest,
    itemId: resolved.item.id,
    productOrItem: line.productOrItem?.trim() || snaps.itemName,
    itemCodeSnapshot: snaps.itemCode,
    itemNameSnapshot: snaps.itemName,
  }
}
