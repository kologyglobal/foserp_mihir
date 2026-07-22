import { Prisma } from '@prisma/client'

export type DecimalInput = Prisma.Decimal | number | string | null | undefined

/** Coerce any decimal-ish input to a Prisma.Decimal, defaulting null/undefined to zero. */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0)
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

export function addDec(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).plus(toDecimal(b))
}

export function subDec(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).minus(toDecimal(b))
}

export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).greaterThan(0)
}

export function isNegative(value: DecimalInput): boolean {
  return toDecimal(value).lessThan(0)
}

/**
 * requiredQuantity = qtyPerBase * plannedOrderQty / baseQty
 * `quantityBasis` mirrors ManufacturingBomLine: PER_UNIT/PER_BATCH scale with the order
 * quantity against the BOM version's base quantity; FIXED_PER_ORDER lines take a flat
 * quantity regardless of order size. Scrap uplift is applied on top of the base requirement.
 */
export function computeBomLineRequiredQuantity(params: {
  quantityBasis: 'PER_UNIT' | 'FIXED_PER_ORDER' | 'PER_BATCH'
  quantityPerBase: DecimalInput
  fixedQuantity: DecimalInput
  plannedOrderQuantity: DecimalInput
  baseQuantity: DecimalInput
  scrapPercent: DecimalInput
}): Prisma.Decimal {
  const plannedOrderQuantity = toDecimal(params.plannedOrderQuantity)
  const baseQuantity = toDecimal(params.baseQuantity)
  const scrapPercent = toDecimal(params.scrapPercent)

  let base: Prisma.Decimal
  if (params.quantityBasis === 'FIXED_PER_ORDER') {
    base = toDecimal(params.fixedQuantity ?? params.quantityPerBase)
  } else {
    const safeBaseQuantity = baseQuantity.isZero() ? new Prisma.Decimal(1) : baseQuantity
    base = toDecimal(params.quantityPerBase).times(plannedOrderQuantity).dividedBy(safeBaseQuantity)
  }

  if (scrapPercent.greaterThan(0)) {
    const divisor = new Prisma.Decimal(1).minus(scrapPercent.dividedBy(100))
    if (divisor.greaterThan(0)) {
      base = base.dividedBy(divisor)
    }
  }

  return base
}

/** Clamp a percentage-style Decimal into [0, 100]. */
export function clampPercent(value: DecimalInput): Prisma.Decimal {
  const dec = toDecimal(value)
  if (dec.lessThan(0)) return new Prisma.Decimal(0)
  if (dec.greaterThan(100)) return new Prisma.Decimal(100)
  return dec
}

export function computeCompletionPercent(completedGoodQuantity: DecimalInput, plannedQuantity: DecimalInput): Prisma.Decimal {
  const planned = toDecimal(plannedQuantity)
  if (planned.isZero() || planned.isNegative()) return new Prisma.Decimal(0)
  const pct = toDecimal(completedGoodQuantity).dividedBy(planned).times(100)
  return clampPercent(pct)
}
