import type { InventoryMovementType, InventoryValuationMethod, Prisma } from '@prisma/client'
import { toDecimal } from '../shared/quantity.helpers.js'

export interface ValuationContext {
  movementType: InventoryMovementType
  quantity: Prisma.Decimal
  rate: Prisma.Decimal
}

export interface ValuationResult {
  unitCost: Prisma.Decimal
  totalCost: Prisma.Decimal
}

export interface InventoryValuationStrategy {
  method: InventoryValuationMethod
  valueMovement(ctx: ValuationContext): ValuationResult
}

export function resolveInventoryValuationStrategy(
  method: InventoryValuationMethod,
): InventoryValuationStrategy {
  // Phase A (Option A foundation): preserve existing moving-average math.
  // For Phase B FIFO layers, cost-entry math is still “unitCost * qty” at the movement-level
  // (FIFO allocation happens in stock posting / cost-layer code).
  return {
    method,
    valueMovement(ctx: ValuationContext): ValuationResult {
      const qty = toDecimal(ctx.quantity).abs()
      const unitCost = toDecimal(ctx.rate)
      return {
        unitCost,
        totalCost: qty.times(unitCost).toDecimalPlaces(2),
      }
    },
  }
}

