import { Prisma } from '@prisma/client'
import { roundAmount } from '../../../shared/finance-decimal.js'

export function formatDecimal4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}
