import { Prisma } from '@prisma/client'
import { roundAmount, roundQuantity } from '../../../shared/finance-decimal.js'

/** Money/rate amounts persisted at 4 decimal places. */
export function formatDecimal4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}

/** Quantities persisted at 6 decimal places. */
export function formatDecimal6(value: Prisma.Decimal): string {
  return roundQuantity(value).toFixed(6)
}
