import { describe, expect, it } from 'vitest'
import {
  buildGstr1Sections,
  buildGstr3bSummary,
  buildPaymentSummary,
  buildRegisterPayload,
  canLockReturn,
  canMarkFiledExternal,
  canPrepareReturn,
  canUnlockReturn,
  isExportOrSez,
  isPeriodSourceImmutable,
  type LedgerRowLike,
} from '../src/modules/accounting/tax-compliance/gstr-registers.util.js'

function row(partial: Partial<LedgerRowLike> & Pick<LedgerRowLike, 'documentId' | 'taxType' | 'taxableValue' | 'taxAmount'>): LedgerRowLike {
  return {
    documentNumber: partial.documentNumber ?? 'DOC-1',
    documentDate: partial.documentDate ?? '2026-08-10',
    documentType: partial.documentType ?? 'SALES_INVOICE',
    documentLineId: partial.documentLineId ?? 'L1',
    direction: partial.direction ?? 'OUTWARD',
    partyGstin: partial.partyGstin ?? '27AAAAA0000A1Z5',
    companyGstin: partial.companyGstin ?? '27BBBBB0000B1Z5',
    placeOfSupply: partial.placeOfSupply ?? '27-Maharashtra',
    hsnSacCode: partial.hsnSacCode ?? '998314',
    taxRate: partial.taxRate ?? 9,
    isReverseCharge: partial.isReverseCharge ?? false,
    itcEligibility: partial.itcEligibility ?? null,
    filingStatus: partial.filingStatus ?? 'NOT_FILED',
    ...partial,
  }
}

describe('gstr-registers.util', () => {
  it('classifies export / SEZ place of supply', () => {
    expect(isExportOrSez('EXPORT')).toBe(true)
    expect(isExportOrSez('SEZ Unit - GIFT')).toBe(true)
    expect(isExportOrSez('27-Maharashtra')).toBe(false)
  })

  it('builds sales register totals from output components', () => {
    const rows: LedgerRowLike[] = [
      row({ documentId: 'si1', taxType: 'OUTPUT_CGST', taxableValue: 1000, taxAmount: 90 }),
      row({ documentId: 'si1', taxType: 'OUTPUT_SGST', taxableValue: 1000, taxAmount: 90 }),
    ]
    const payload = buildRegisterPayload('SALES', rows) as { items: Array<{ totalTax: number; taxableValue: number }> }
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].taxableValue).toBe(1000)
    expect(payload.items[0].totalTax).toBe(180)
  })

  it('builds GSTR-1 B2B section and HSN', () => {
    const rows: LedgerRowLike[] = [
      row({ documentId: 'si1', taxType: 'OUTPUT_IGST', taxableValue: 500, taxAmount: 90, taxRate: 18 }),
    ]
    const g1 = buildGstr1Sections(rows)
    expect(g1.b2b).toHaveLength(1)
    expect(g1.totals.outwardTaxable).toBe(500)
    expect(g1.totals.taxLiability).toBe(90)
    expect(g1.hsn[0].hsnSacCode).toBe('998314')
  })

  it('builds GSTR-3B liability and ITC net', () => {
    const rows: LedgerRowLike[] = [
      row({ documentId: 'si1', taxType: 'OUTPUT_IGST', taxableValue: 1000, taxAmount: 180 }),
      row({
        documentId: 'vi1',
        documentType: 'VENDOR_INVOICE',
        direction: 'INWARD',
        taxType: 'INPUT_IGST',
        taxableValue: 200,
        taxAmount: 36,
        partyGstin: '24CCCCC0000C1Z5',
      }),
      row({
        documentId: 'vi2',
        documentType: 'VENDOR_INVOICE',
        direction: 'INWARD',
        taxType: 'RCM_IGST',
        taxableValue: 100,
        taxAmount: 18,
        isReverseCharge: true,
      }),
    ]
    const s = buildGstr3bSummary(rows)
    expect(s.taxLiability).toBe(198)
    expect(s.itcAvailable).toBe(36)
    expect(s.netPayable).toBe(162)

    const pay = buildPaymentSummary(rows)
    expect(pay.netPayable).toBe(162)
    expect(pay.note).toContain('Preparation-only')
  })

  it('enforces prepare / lock / unlock / filed state machine', () => {
    expect(canPrepareReturn('OPEN')).toBe(true)
    expect(canPrepareReturn('LOCKED')).toBe(false)
    expect(canLockReturn('DRAFT')).toBe(true)
    expect(canLockReturn('OPEN')).toBe(false)
    expect(canUnlockReturn('LOCKED')).toBe(true)
    expect(canUnlockReturn('MARKED_FILED_EXTERNAL')).toBe(false)
    expect(canMarkFiledExternal('LOCKED')).toBe(true)
    expect(isPeriodSourceImmutable('LOCKED')).toBe(true)
    expect(isPeriodSourceImmutable('DRAFT')).toBe(false)
  })
})
