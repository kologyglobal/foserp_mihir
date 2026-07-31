import { Prisma } from '@prisma/client'

export type QtyInput = Prisma.Decimal | string | number | null | undefined

export function toQty(value: unknown, fallback = '0'): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(fallback)
  if (typeof value === 'number' || typeof value === 'string') return new Prisma.Decimal(value)
  return new Prisma.Decimal(String(value))
}

export function addQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  return toQty(a).add(toQty(b))
}

export function subQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  return toQty(a).sub(toQty(b))
}

export function mulQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  return toQty(a).mul(toQty(b))
}

export function divQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  const divisor = toQty(b)
  if (divisor.isZero()) throw new Error('Division by zero')
  return toQty(a).div(divisor)
}

export function cmpQty(a: QtyInput, b: QtyInput): -1 | 0 | 1 {
  const result = toQty(a).cmp(toQty(b))
  if (result < 0) return -1
  if (result > 0) return 1
  return 0
}

export function isZeroQty(value: QtyInput): boolean {
  return toQty(value).isZero()
}

export function isPositiveQty(value: QtyInput): boolean {
  return toQty(value).gt(0)
}

export function maxQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  const da = toQty(a)
  const db = toQty(b)
  return da.gte(db) ? da : db
}

export function minQty(a: QtyInput, b: QtyInput): Prisma.Decimal {
  const da = toQty(a)
  const db = toQty(b)
  return da.lte(db) ? da : db
}

export function pctOf(base: QtyInput, pct: QtyInput): Prisma.Decimal {
  return mulQty(base, divQty(pct, 100))
}

export function qtyToNumber(value: QtyInput): number {
  return toQty(value).toNumber()
}

export function qtyToString(value: QtyInput, decimalPlaces = 4): string {
  return toQty(value).toFixed(decimalPlaces)
}
