import { Prisma } from '@prisma/client'

export type DecimalInput = Prisma.Decimal | number | string | null | undefined

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

export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero()
}

export function dec(value: DecimalInput): string {
  return toDecimal(value).toString()
}
