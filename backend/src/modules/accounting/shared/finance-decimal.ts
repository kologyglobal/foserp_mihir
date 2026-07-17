import { Prisma } from '@prisma/client'

export type DecimalInput = Prisma.Decimal | string | number

/** Coerce any numeric input to Prisma.Decimal — never use JS number arithmetic for money. */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(value)
}

export function add(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).add(toDecimal(b))
}

export function subtract(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).sub(toDecimal(b))
}

export function compare(a: DecimalInput, b: DecimalInput): -1 | 0 | 1 {
  const result = toDecimal(a).cmp(toDecimal(b))
  if (result < 0) return -1
  if (result > 0) return 1
  return 0
}

export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero()
}

export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).gt(0)
}

export function isNegative(value: DecimalInput): boolean {
  return toDecimal(value).lt(0)
}

export function assertNonNegative(value: DecimalInput, label = 'Amount'): Prisma.Decimal {
  const d = toDecimal(value)
  if (d.isNegative()) {
    throw new Error(`${label} must not be negative`)
  }
  return d
}

/** Round using ROUND_HALF_UP (bank-standard for currency). */
export function roundAmount(value: DecimalInput, precision: 2 | 4 = 2): Prisma.Decimal {
  const d = toDecimal(value)
  return new Prisma.Decimal(d.toFixed(precision, Prisma.Decimal.ROUND_HALF_UP))
}

/** Convert transaction currency amount to base currency: amount × exchangeRate. */
export function convertToBase(amount: DecimalInput, exchangeRate: DecimalInput): Prisma.Decimal {
  return toDecimal(amount).mul(toDecimal(exchangeRate))
}

export function sumDecimals(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.add(toDecimal(v)), new Prisma.Decimal(0))
}

export function multiply(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).mul(toDecimal(b))
}

/** Parse and validate a decimal string — rejects non-numeric input. */
export function parseDecimalString(value: string, label = 'Amount'): Prisma.Decimal {
  const trimmed = value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`${label} must be a valid decimal string`)
  }
  return new Prisma.Decimal(trimmed)
}

/** Persist monetary amounts at 4 decimal places. */
export function formatForPersistence(value: DecimalInput, precision: 2 | 4 = 4): string {
  return roundAmount(value, precision).toFixed(precision)
}

/** Exchange rates stored at 8 decimal places. */
export function roundExchangeRate(value: DecimalInput): Prisma.Decimal {
  const d = toDecimal(value)
  return new Prisma.Decimal(d.toFixed(8, Prisma.Decimal.ROUND_HALF_UP))
}
