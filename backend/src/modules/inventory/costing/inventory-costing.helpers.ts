import type { InventoryValuationMethod, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { toDecimal } from '../shared/quantity.helpers.js'

export function mapDefaultCostingMethodToValuationMethod(value: unknown): InventoryValuationMethod {
  if (value === 'fifo') return 'FIFO'
  if (value === 'standard') return 'STANDARD_COST'
  if (value === 'specific') return 'SPECIFIC_IDENTIFICATION'
  return 'MOVING_WEIGHTED_AVERAGE'
}

/**
 * @deprecated ManufacturingInventoryValuationMethod is legacy.
 * Map to canonical InventoryValuationMethod for display/adapters only.
 * Do not use for posting or WO material valuation decisions.
 */
export function mapLegacyManufacturingValuationMethod(
  value: unknown,
): InventoryValuationMethod {
  if (value === 'FIFO') return 'FIFO'
  // MOVING_AVERAGE and anything else → MA
  return 'MOVING_WEIGHTED_AVERAGE'
}

export type EffectiveValuationMethodResult = {
  method: InventoryValuationMethod
  source: 'TENANT_INVENTORY_SETTINGS'
  policyId: null
  effectiveDate: string
  /** Echo of settings JSON key when present */
  defaultCostingMethodKey: string | null
}

export async function resolveValuationMethodInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<InventoryValuationMethod> {
  const settings = await tx.inventorySettings.findUnique({
    where: { tenantId },
    select: { settings: true },
  })
  if (!settings || typeof settings.settings !== 'object' || settings.settings === null) {
    return 'MOVING_WEIGHTED_AVERAGE'
  }
  const root = settings.settings as Record<string, unknown>
  const general = root.general
  if (typeof general !== 'object' || general === null) {
    return 'MOVING_WEIGHTED_AVERAGE'
  }
  return mapDefaultCostingMethodToValuationMethod((general as Record<string, unknown>).defaultCostingMethod)
}

/**
 * Canonical effective inventory valuation method for a tenant.
 * Hierarchy today: tenant InventorySettings only (no item/LE override).
 * Manufacturing may read for visibility; must not recalculate inventory cost from this.
 */
export async function getEffectiveValuationMethod(params: {
  tenantId: string
  legalEntityId?: string | null
  itemId?: string | null
  warehouseId?: string | null
  postingDate?: Date | string | null
}): Promise<EffectiveValuationMethodResult> {
  const settings = await prisma.inventorySettings.findUnique({
    where: { tenantId: params.tenantId },
    select: { settings: true },
  })
  let key: string | null = null
  if (settings && typeof settings.settings === 'object' && settings.settings !== null) {
    const general = (settings.settings as Record<string, unknown>).general
    if (typeof general === 'object' && general !== null) {
      const raw = (general as Record<string, unknown>).defaultCostingMethod
      key = typeof raw === 'string' ? raw : null
    }
  }
  const method = mapDefaultCostingMethodToValuationMethod(key)
  const asOf =
    params.postingDate == null
      ? new Date()
      : params.postingDate instanceof Date
        ? params.postingDate
        : new Date(params.postingDate)
  return {
    method,
    source: 'TENANT_INVENTORY_SETTINGS',
    policyId: null,
    effectiveDate: asOf.toISOString().slice(0, 10),
    defaultCostingMethodKey: key,
  }
}

export type ManufacturingCostSource = 'actual_work_order' | 'standard'

export function resolveManufacturingCostSource(settingsJson: unknown): ManufacturingCostSource {
  if (!settingsJson || typeof settingsJson !== 'object') return 'actual_work_order'
  const root = settingsJson as Record<string, unknown>
  const general = root.general
  if (typeof general === 'object' && general !== null) {
    const src = (general as Record<string, unknown>).manufacturingCostSource
    if (src === 'standard') return 'standard'
  }
  const costing = root.costing
  if (typeof costing === 'object' && costing !== null) {
    const src = (costing as Record<string, unknown>).manufacturingCostSource
    if (src === 'standard') return 'standard'
  }
  return 'actual_work_order'
}

export async function resolveActiveStandardUnitCostInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  asOf: Date = new Date(),
): Promise<Prisma.Decimal> {
  const version = await tx.inventoryItemStandardCostVersion.findFirst({
    where: {
      tenantId,
      itemId,
      status: 'ACTIVE',
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    select: { unitCost: true },
  })
  if (version) return toDecimal(version.unitCost)

  const item = await tx.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: { standardRate: true },
  })
  return toDecimal(item?.standardRate)
}
