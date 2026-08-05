/**
 * Phase 8 — GST liability proposal + PMT-06 style challan plan (pure, no I/O).
 * Not a GST portal cash-ledger — books-side proposal only.
 */
import {
  buildItcSummary,
  buildLiabilitySummary,
  type ComponentTotals,
  type LedgerRowLike,
} from './gstr-registers.util.js'

export type GstPaymentChallanStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'CONFIRMED_EXTERNAL'
  | 'POSTED_GL'
  | 'CLOSED'
  | 'VOID'

export type LiabilityProposal = {
  output: ComponentTotals
  rcm: ComponentTotals
  itc: ComponentTotals
  totalOutputLiability: number
  totalRcmLiability: number
  totalLiability: number
  totalItc: number
  /** max(0, liability − ITC) before interest / late fee */
  netTaxPayable: number
  interestAmount: number
  lateFeeAmount: number
  roundOffAmount: number
  totalPayable: number
  /** Simulated electronic ledger utilisation suggestion (not portal). */
  cashLedgerProposal: {
    igst: number
    cgst: number
    sgst: number
    cess: number
  }
  creditLedgerProposal: {
    igst: number
    cgst: number
    sgst: number
    cess: number
  }
  note: string
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000
}

/**
 * Build books-side liability + cash payment proposal from posted GST ledger.
 * ITC offsets liability first (simplified one-pool); residual is cash payable.
 */
export function buildLiabilityProposal(
  rows: LedgerRowLike[],
  extras?: { interestAmount?: number; lateFeeAmount?: number; roundOffAmount?: number },
): LiabilityProposal {
  const liab = buildLiabilitySummary(rows)
  const itc = buildItcSummary(rows)
  const totalLiability = liab.totalLiability
  const totalItc = itc.totalItc
  const netTaxPayable = Math.max(0, round4(totalLiability - totalItc))
  const interestAmount = round4(Math.max(0, extras?.interestAmount ?? 0))
  const lateFeeAmount = round4(Math.max(0, extras?.lateFeeAmount ?? 0))
  const roundOffAmount = round4(extras?.roundOffAmount ?? 0)
  const totalPayable = round4(netTaxPayable + interestAmount + lateFeeAmount + roundOffAmount)

  // Credit ledger util = min(component liability, component ITC) as a rough proposal.
  const creditLedgerProposal = {
    igst: round4(Math.min(liab.output.igst + liab.rcm.igst, itc.input.igst)),
    cgst: round4(Math.min(liab.output.cgst + liab.rcm.cgst, itc.input.cgst)),
    sgst: round4(Math.min(liab.output.sgst + liab.rcm.sgst, itc.input.sgst)),
    cess: round4(Math.min(liab.output.cess + liab.rcm.cess, itc.input.cess)),
  }
  // Cash residual by component (not negative).
  const cashLedgerProposal = {
    igst: round4(Math.max(0, liab.output.igst + liab.rcm.igst - creditLedgerProposal.igst)),
    cgst: round4(Math.max(0, liab.output.cgst + liab.rcm.cgst - creditLedgerProposal.cgst)),
    sgst: round4(Math.max(0, liab.output.sgst + liab.rcm.sgst - creditLedgerProposal.sgst)),
    cess: round4(Math.max(0, liab.output.cess + liab.rcm.cess - creditLedgerProposal.cess)),
  }

  return {
    output: liab.output,
    rcm: liab.rcm,
    itc: itc.input,
    totalOutputLiability: liab.output.totalTax,
    totalRcmLiability: liab.rcm.totalTax,
    totalLiability,
    totalItc,
    netTaxPayable,
    interestAmount,
    lateFeeAmount,
    roundOffAmount,
    totalPayable,
    cashLedgerProposal,
    creditLedgerProposal,
    note:
      'Books-side liability proposal from posted GST ledger. Not a live GST portal cash ledger, PMT-06 portal generate, or GSTR filing confirmation.',
  }
}

export function canProposePayment(existingStatuses: GstPaymentChallanStatus[]): {
  ok: boolean
  reason?: string
} {
  if (existingStatuses.some((s) => s === 'CLOSED')) {
    return { ok: false, reason: 'GST payment period is CLOSED — reopen only via process owner policy (new draft not allowed)' }
  }
  if (existingStatuses.some((s) => s === 'PROPOSED' || s === 'CONFIRMED_EXTERNAL' || s === 'POSTED_GL' || s === 'DRAFT')) {
    return {
      ok: false,
      reason: 'An open/active challan already exists for this LE + GSTIN + period — void or complete it first',
    }
  }
  return { ok: true }
}

export function canConfirmExternal(status: GstPaymentChallanStatus): boolean {
  return status === 'DRAFT' || status === 'PROPOSED'
}

export function canPostGl(status: GstPaymentChallanStatus): boolean {
  return status === 'CONFIRMED_EXTERNAL' || status === 'PROPOSED'
}

export function canClosePeriod(status: GstPaymentChallanStatus): boolean {
  return status === 'POSTED_GL' || status === 'CONFIRMED_EXTERNAL'
}

export function canVoidChallan(status: GstPaymentChallanStatus): boolean {
  return status === 'DRAFT' || status === 'PROPOSED' || status === 'CONFIRMED_EXTERNAL'
}

/** Scale cash components so sum equals netTaxPayable if proportional drift exists. */
export function distributeCashSettlement(
  cash: { igst: number; cgst: number; sgst: number; cess: number },
  netTaxPayable: number,
): { igst: number; cgst: number; sgst: number; cess: number } {
  const sum = cash.igst + cash.cgst + cash.sgst + cash.cess
  if (sum <= 0 || netTaxPayable <= 0) {
    return { igst: 0, cgst: 0, sgst: 0, cess: 0 }
  }
  if (Math.abs(sum - netTaxPayable) < 0.02) return cash
  const factor = netTaxPayable / sum
  return {
    igst: round4(cash.igst * factor),
    cgst: round4(cash.cgst * factor),
    sgst: round4(cash.sgst * factor),
    cess: round4(cash.cess * factor),
  }
}
