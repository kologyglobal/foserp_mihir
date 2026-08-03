import type { Prisma } from '@prisma/client'
import { decStatutory, roundStatutoryAmount } from './wage-basis.service.js'

export interface TdsCalculationResult {
  amount: number
  reviewRequired: boolean
  source: 'MANUAL_OVERRIDE' | 'PENDING_ANNUAL_ENGINE'
  notes: string | null
}

export interface TdsStatutoryDetailLike {
  tdsManualMonthly: Prisma.Decimal | number | null
  tdsManualReason: string | null
}

/**
 * Foundation-only TDS: no reliable annual IT-slab engine exists yet (old vs new
 * regime, Section 80C/80D declarations, surcharge/cess, etc. are not modeled).
 * We deliberately never invent a full IT calculation. If HR has declared an
 * authorized `tdsManualMonthly` override, use it; otherwise flag for manual review.
 */
export function calculateTds(statutoryDetail: TdsStatutoryDetailLike | null): TdsCalculationResult {
  const manual = decStatutory(statutoryDetail?.tdsManualMonthly ?? null)
  if (manual != null) {
    return {
      amount: roundStatutoryAmount(manual, 'NEAREST'),
      reviewRequired: false,
      source: 'MANUAL_OVERRIDE',
      notes: statutoryDetail?.tdsManualReason ?? 'Manual monthly TDS override',
    }
  }

  return {
    amount: 0,
    reviewRequired: true,
    source: 'PENDING_ANNUAL_ENGINE',
    notes: 'Annual TDS slab engine not implemented — set tdsManualMonthly on the employee profile for an accurate deduction',
  }
}
