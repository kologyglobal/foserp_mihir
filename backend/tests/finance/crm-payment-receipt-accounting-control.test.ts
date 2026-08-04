/**
 * Unit tests for CRM payment → Money In boundary helpers (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  assertCrmTaxInvoiceAllowsCommercialAllocation,
  isCrmTaxInvoiceAccountingControlled,
} from '../../src/modules/accounting/receivables/source/crm-payment-receipt-ar.service.js'
import { ValidationError } from '../../src/utils/errors.js'

describe('CRM payment receipt accounting control', () => {
  it('treats converted invoice as accounting-controlled', () => {
    expect(
      isCrmTaxInvoiceAccountingControlled({
        salesInvoiceId: 'si-1',
        accountingStatus: 'converted',
      }),
    ).toBe(true)
  })

  it('treats pending_review as accounting-controlled', () => {
    expect(
      isCrmTaxInvoiceAccountingControlled({
        salesInvoiceId: null,
        accountingStatus: 'pending_review',
      }),
    ).toBe(true)
  })

  it('allows pure commercial invoices', () => {
    expect(
      isCrmTaxInvoiceAccountingControlled({
        salesInvoiceId: null,
        accountingStatus: 'none',
      }),
    ).toBe(false)
  })

  it('blocks CRM allocation with Money In message', () => {
    expect(() =>
      assertCrmTaxInvoiceAllowsCommercialAllocation({
        invoiceNo: 'TI-1',
        salesInvoiceId: 'si-1',
        accountingStatus: 'converted',
      }),
    ).toThrow(ValidationError)
    try {
      assertCrmTaxInvoiceAllowsCommercialAllocation({
        invoiceNo: 'TI-1',
        salesInvoiceId: 'si-1',
        accountingStatus: 'converted',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      expect((e as ValidationError).message).toContain('Accounting Money In')
    }
  })
})
