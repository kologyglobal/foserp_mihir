import { Prisma } from '@prisma/client'
import {
  add,
  assertNonNegative,
  compare,
  roundTax,
  subtract,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type { CalculationIssue, RoundingMode } from './sales-invoice-calculation.types.js'
import { calcError } from './sales-invoice-calculation.errors.js'
import { formatDecimal4 } from './sales-invoice-line-calculation.service.js'

export interface RoundingResult {
  roundOffAmount: string
  totalAmount: string
}

const DEFAULT_TOLERANCE = toDecimal('1.00')

function roundToNearestUnit(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(0, Prisma.Decimal.ROUND_HALF_UP))
}

function roundToNearest005(value: Prisma.Decimal): Prisma.Decimal {
  const scaled = value.mul(20)
  const rounded = new Prisma.Decimal(scaled.toFixed(0, Prisma.Decimal.ROUND_HALF_UP))
  return rounded.div(20)
}

export function applyRounding(
  preRoundTotal: string,
  roundingMode: RoundingMode,
  manualRoundOff: string | undefined,
  roundingTolerance: string | undefined,
  errors: CalculationIssue[],
): RoundingResult {
  const preTotal = toDecimal(preRoundTotal)
  let roundOff = new Prisma.Decimal(0)
  let total = preTotal

  switch (roundingMode) {
    case 'NEAREST_UNIT': {
      total = roundToNearestUnit(preTotal)
      roundOff = roundTax(subtract(total, preTotal))
      break
    }
    case 'NEAREST_0_05': {
      total = roundToNearest005(preTotal)
      roundOff = roundTax(subtract(total, preTotal))
      break
    }
    case 'MANUAL': {
      try {
        roundOff = roundTax(toDecimal(manualRoundOff ?? '0'))
      } catch {
        errors.push(calcError('INVALID_MANUAL_ROUND_OFF', 'Manual round-off must be a valid decimal', 'manualRoundOff'))
        roundOff = new Prisma.Decimal(0)
      }
      total = roundTax(add(preTotal, roundOff))
      const tolerance = roundingTolerance ? toDecimal(roundingTolerance) : DEFAULT_TOLERANCE
      if (compare(roundOff.abs(), tolerance) > 0) {
        errors.push(
          calcError(
            'ROUND_OFF_EXCEEDS_TOLERANCE',
            `Manual round-off ${roundOff.toFixed(4)} exceeds tolerance ${tolerance.toFixed(4)}`,
            'manualRoundOff',
          ),
        )
      }
      break
    }
    case 'NONE':
    default:
      roundOff = new Prisma.Decimal(0)
      total = preTotal
      break
  }

  try {
    assertNonNegative(total, 'Total amount')
  } catch {
    errors.push(calcError('NEGATIVE_TOTAL', 'Grand total cannot be negative', 'totalAmount'))
  }

  return {
    roundOffAmount: formatDecimal4(roundOff),
    totalAmount: formatDecimal4(total),
  }
}

export function needsRoundingAccount(roundOffAmount: string): boolean {
  return !toDecimal(roundOffAmount).isZero()
}
