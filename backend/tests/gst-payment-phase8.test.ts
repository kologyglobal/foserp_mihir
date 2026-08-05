/**
 * Phase 8 — GST payment liability proposal unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  buildLiabilityProposal,
  canClosePeriod,
  canConfirmExternal,
  canPostGl,
  canProposePayment,
  canVoidChallan,
  distributeCashSettlement,
} from '../src/modules/accounting/tax-compliance/gst-payment-liability.util.js'
import type { LedgerRowLike } from '../src/modules/accounting/tax-compliance/gstr-registers.util.js'

function row(partial: Partial<LedgerRowLike> & { taxType: string; taxAmount: number }): LedgerRowLike {
  return {
    documentId: partial.documentId ?? 'd1',
    documentNumber: 'DOC-1',
    documentDate: '2026-07-15',
    documentType: partial.documentType ?? 'SALES_INVOICE',
    documentLineId: partial.documentLineId ?? 'l1',
    direction: partial.direction ?? 'OUTWARD',
    partyGstin: '27BBBBB0000B1Z5',
    companyGstin: '27AAAAA0000A1Z5',
    placeOfSupply: '27',
    hsnSacCode: '9983',
    taxType: partial.taxType,
    taxableValue: partial.taxableValue ?? 1000,
    taxRate: partial.taxRate ?? 9,
    taxAmount: partial.taxAmount,
    isReverseCharge: partial.isReverseCharge ?? false,
    itcEligibility: partial.itcEligibility ?? null,
    filingStatus: 'NOT_FILED',
  }
}

describe('buildLiabilityProposal', () => {
  it('offsets ITC and adds interest/late fee', () => {
    const rows = [
      row({ taxType: 'OUTPUT_CGST', taxAmount: 100, documentLineId: 'a' }),
      row({ taxType: 'OUTPUT_SGST', taxAmount: 100, documentLineId: 'a' }),
      row({
        taxType: 'INPUT_CGST',
        taxAmount: 40,
        direction: 'INWARD',
        documentType: 'VENDOR_INVOICE',
        documentId: 'v1',
        documentLineId: 'b',
      }),
      row({
        taxType: 'INPUT_SGST',
        taxAmount: 40,
        direction: 'INWARD',
        documentType: 'VENDOR_INVOICE',
        documentId: 'v1',
        documentLineId: 'b',
      }),
    ]
    const p = buildLiabilityProposal(rows, { interestAmount: 5, lateFeeAmount: 2 })
    expect(p.totalLiability).toBe(200)
    expect(p.totalItc).toBe(80)
    expect(p.netTaxPayable).toBe(120)
    expect(p.totalPayable).toBe(127)
    expect(p.cashLedgerProposal.cgst + p.cashLedgerProposal.sgst).toBeGreaterThan(0)
  })
})

describe('payment period gates', () => {
  it('blocks propose when closed or active challan', () => {
    expect(canProposePayment(['CLOSED']).ok).toBe(false)
    expect(canProposePayment(['PROPOSED']).ok).toBe(false)
    expect(canProposePayment(['VOID']).ok).toBe(true)
  })
  it('status transitions', () => {
    expect(canConfirmExternal('PROPOSED')).toBe(true)
    expect(canPostGl('CONFIRMED_EXTERNAL')).toBe(true)
    expect(canClosePeriod('POSTED_GL')).toBe(true)
    expect(canVoidChallan('POSTED_GL')).toBe(false)
  })
})

describe('distributeCashSettlement', () => {
  it('scales to net when totals differ', () => {
    const d = distributeCashSettlement({ igst: 0, cgst: 50, sgst: 50, cess: 0 }, 80)
    expect(Math.round(d.cgst + d.sgst)).toBe(80)
  })
})
