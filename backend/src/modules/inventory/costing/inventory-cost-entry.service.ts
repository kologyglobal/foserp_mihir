import type {
  InventoryCostEntry,
  InventoryCostEntryType,
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
} from '@prisma/client'
import { toDecimal } from '../shared/quantity.helpers.js'
import { resolveInventoryValuationStrategy } from './inventory-valuation.strategy.js'
import { resolveValuationMethodInTx } from './inventory-costing.helpers.js'

function mapMovementTypeToEntryType(movementType: InventoryMovementType): InventoryCostEntryType {
  if (movementType === 'OPENING') return 'OPENING'
  if (movementType === 'INWARD') return 'RECEIPT'
  if (movementType === 'ISSUE') return 'ISSUE'
  return 'ADJUSTMENT'
}

function deriveSourceId(referenceNo?: string | null): string | null {
  const trimmed = referenceNo?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function deriveWorkOrderId(referenceType: InventoryReferenceType, workOrderId?: string | null): string | null {
  if (!workOrderId) return null
  if (
    referenceType === 'ISSUE_TO_WO' ||
    referenceType === 'RETURN_FROM_WO' ||
    referenceType === 'FG_RECEIPT' ||
    referenceType === 'SA_RECEIPT'
  ) {
    return workOrderId
  }
  return null
}

export interface RecordInventoryCostEntryInput {
  tenantId: string
  legalEntityId?: string | null
  costLayerId?: string | null
  /** Prefer posted valuation so entry matches InventoryStockMovement.value (avoids DB rate 2dp re-round). */
  unitCost?: Prisma.Decimal | number | string
  totalCost?: Prisma.Decimal | number | string
  movement: {
    id: string
    movementType: InventoryMovementType
    referenceType: InventoryReferenceType
    quantity: Prisma.Decimal
    rate: Prisma.Decimal
    itemId: string
    warehouseId: string
    movementDate: Date
    workOrderId?: string | null
    referenceNo?: string | null
    batchId?: string | null
    serialId?: string | null
    lotId?: string | null
    createdBy?: string | null
  }
}

export async function recordInventoryCostEntryInTx(
  tx: Prisma.TransactionClient,
  input: RecordInventoryCostEntryInput,
): Promise<InventoryCostEntry> {
  const valuationMethod = await resolveValuationMethodInTx(tx, input.tenantId)
  const strategy = resolveInventoryValuationStrategy(valuationMethod)
  const valuation = strategy.valueMovement({
    movementType: input.movement.movementType,
    quantity: toDecimal(input.movement.quantity),
    rate: toDecimal(input.movement.rate),
  })
  const unitCost = input.unitCost != null ? toDecimal(input.unitCost) : valuation.unitCost
  const totalCost =
    input.totalCost != null ? toDecimal(input.totalCost).toDecimalPlaces(2) : valuation.totalCost

  return tx.inventoryCostEntry.upsert({
    where: {
      tenantId_inventoryMovementId: {
        tenantId: input.tenantId,
        inventoryMovementId: input.movement.id,
      },
    },
    create: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId ?? null,
      itemId: input.movement.itemId,
      warehouseId: input.movement.warehouseId,
      inventoryMovementId: input.movement.id,
      entryType: mapMovementTypeToEntryType(input.movement.movementType),
      valuationMethod,
      quantity: input.movement.quantity,
      unitCost,
      totalCost,
      currencyCode: 'INR',
      postingDate: input.movement.movementDate,
      sourceType: input.movement.referenceType,
      sourceId: deriveSourceId(input.movement.referenceNo),
      sourceLineId: null,
      lotId: input.movement.lotId ?? null,
      serialId: input.movement.serialId ?? null,
      workOrderId: deriveWorkOrderId(input.movement.referenceType, input.movement.workOrderId),
      costLayerId: input.costLayerId ?? null,
      costCalculationReference: `MOV:${input.movement.id}`,
      reversalOfId: null,
      correctionOfId: null,
      isReversal: false,
      status: 'POSTED',
      createdBy: input.movement.createdBy ?? null,
    },
    update: {
      costLayerId: input.costLayerId ?? null,
      valuationMethod,
      unitCost,
      totalCost,
      quantity: input.movement.quantity,
      lotId: input.movement.lotId ?? null,
      serialId: input.movement.serialId ?? null,
    },
  })
}
