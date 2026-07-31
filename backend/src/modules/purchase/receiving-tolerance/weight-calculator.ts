import { Prisma } from '@prisma/client'
import { mulQty, toQty } from './purchase-quantity-decimal.js'
import type { QtyInput } from './receiving-tolerance.types.js'

export function calculateExpectedWeight(input: {
  receivedUnitQuantity: QtyInput
  standardWeightPerBaseUnit: QtyInput
}): Prisma.Decimal {
  const rate = toQty(input.standardWeightPerBaseUnit)
  if (rate.isZero()) return new Prisma.Decimal(0)
  return mulQty(input.receivedUnitQuantity, rate)
}

export function calculateMaximumAllowedWeight(input: {
  expectedWeight: QtyInput
  tolerancePercentage: QtyInput
}): Prisma.Decimal {
  const expected = toQty(input.expectedWeight)
  if (expected.isZero()) return new Prisma.Decimal(0)
  const pct = toQty(input.tolerancePercentage)
  const factor = toQty(1).add(pct.div(100))
  return mulQty(expected, factor)
}
