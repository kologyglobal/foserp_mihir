import type { InventoryValuationMethod, Prisma } from '@prisma/client'
import { toDecimal } from '../shared/quantity.helpers.js'

export function mapDefaultCostingMethodToValuationMethod(value: unknown): InventoryValuationMethod {
  if (value === 'fifo') return 'FIFO'
  if (value === 'standard') return 'STANDARD_COST'
  if (value === 'specific') return 'SPECIFIC_IDENTIFICATION'
  return 'MOVING_WEIGHTED_AVERAGE'
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
