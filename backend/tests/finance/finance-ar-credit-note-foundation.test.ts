import { describe, expect, it } from 'vitest'
import { calculateCustomerCreditNote } from '../../src/modules/accounting/receivables/credit-notes/calculation/customer-credit-note-calculation.service.js'

const source = {
  id: 'line-1',
  quantity: '10',
  unitRate: '100',
  grossAmount: '1000',
  discountAmount: '0',
  taxableAmount: '1000',
  cgstRate: '9',
  cgstAmount: '90',
  sgstRate: '9',
  sgstAmount: '90',
  igstRate: '0',
  igstAmount: '0',
  cessRate: '0',
  cessAmount: '0',
  lineTotal: '1180',
  revenueAccountId: null,
  costCentreId: null,
}

describe('Finance Phase 3C1-3C3 — customer credit note foundation', () => {
  it('reverses a full invoice line with matching GST components', () => {
    const result = calculateCustomerCreditNote({
      exchangeRate: '1',
      lines: [{ lineNumber: 1, adjustmentMode: 'FULL_LINE', originalInvoiceLineId: 'line-1', source }],
    })
    expect(result.valid).toBe(true)
    expect(result.taxableAmount).toBe('1000.0000')
    expect(result.cgstAmount).toBe('90.0000')
    expect(result.sgstAmount).toBe('90.0000')
    expect(result.grandTotal).toBe('1180.0000')
  })

  it('reverses quantity and tax proportionally', () => {
    const result = calculateCustomerCreditNote({
      exchangeRate: '1',
      lines: [{ lineNumber: 1, adjustmentMode: 'QUANTITY', quantity: '2', originalInvoiceLineId: 'line-1', source }],
    })
    expect(result.valid).toBe(true)
    expect(result.taxableAmount).toBe('200.0000')
    expect(result.totalTaxAmount).toBe('36.0000')
    expect(result.grandTotal).toBe('236.0000')
  })

  it('rejects quantity above the invoice quantity', () => {
    const result = calculateCustomerCreditNote({
      exchangeRate: '1',
      lines: [{ lineNumber: 1, adjustmentMode: 'QUANTITY', quantity: '11', originalInvoiceLineId: 'line-1', source }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.field).toContain('quantity')
  })
})
