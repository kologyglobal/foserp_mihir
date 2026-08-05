/**
 * Pure RCM lifecycle + pending-account codes (Phase 4).
 */
import { describe, expect, it } from 'vitest'
import {
  canTransitionRcmStatus,
  isRcmPayableComponent,
  nextRcmStatus,
  rcmAccountingPendingIssue,
  rcmItcGateNote,
  RCM_ACCOUNTING_PENDING_CODE,
  VENDOR_INVOICE_RCM_ACCOUNTING_PENDING,
} from '../src/modules/accounting/tax-compliance/rcm-lifecycle.util.js'
import { calculateVendorInvoiceSync } from '../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.service.js'
import { VENDOR_INVOICE_CALC_CODES } from '../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.errors.js'
import type {
  VendorInvoiceCalculationAccountsOverride,
  VendorInvoiceCalculationInput,
} from '../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.types.js'

function acct(id: string, code: string, name: string) {
  return { id, code, name }
}

function baseAccounts(withRcm = true): VendorInvoiceCalculationAccountsOverride {
  const a: VendorInvoiceCalculationAccountsOverride = {
    purchaseOrDebit: acct('acc-expense', '5100', 'Operating Expense'),
    vendorPayable: acct('acc-payable', '2100', 'Trade Payables'),
    inputCgst: acct('acc-cgst', '1461', 'Input CGST'),
    inputSgst: acct('acc-sgst', '1462', 'Input SGST'),
    inputIgst: acct('acc-igst', '1463', 'Input IGST'),
    inputCess: acct('acc-cess', '1464', 'Input Cess'),
    tdsPayable: acct('acc-tds', '2210', 'TDS Payable'),
    freight: acct('acc-freight', '5200', 'Freight Inward'),
    otherCharge: acct('acc-other-charge', '5300', 'Other Charges'),
    roundOff: acct('acc-round-off', '5900', 'Round Off'),
  }
  if (withRcm) {
    a.rcmCgstPayable = acct('acc-rcm-cgst', '2420', 'RCM CGST Payable')
    a.rcmSgstPayable = acct('acc-rcm-sgst', '2421', 'RCM SGST Payable')
    a.rcmIgstPayable = acct('acc-rcm-igst', '2422', 'RCM IGST Payable')
  }
  return a
}

function baseInput(overrides: Partial<VendorInvoiceCalculationInput> = {}): VendorInvoiceCalculationInput {
  return {
    legalEntityId: '00000000-0000-4000-8000-0000000000a1',
    companyStateCode: '27',
    placeOfSupply: '27',
    vendorId: 'vendor-a',
    taxTreatment: 'REGULAR',
    itcEligibility: 'ELIGIBLE',
    tdsRecognitionMode: 'NOT_APPLICABLE',
    currencyCode: 'INR',
    exchangeRate: '1',
    supplierInvoiceNumber: 'INV-001',
    configuration: { roundingMode: 'NONE', accounts: baseAccounts() },
    lines: [
      {
        lineNumber: 1,
        lineType: 'EXPENSE',
        description: 'Consulting',
        quantity: '1',
        unitPrice: '100000',
        gstRate: '18',
        debitAccountId: 'acc-expense',
      },
    ],
    ...overrides,
  }
}

describe('rcm-lifecycle.util', () => {
  it('flags RCM payable components', () => {
    expect(isRcmPayableComponent('RCM_CGST_PAYABLE')).toBe(true)
    expect(isRcmPayableComponent('INPUT_CGST')).toBe(false)
    const pending = rcmAccountingPendingIssue('RCM_IGST_PAYABLE')
    expect(pending.code).toBe(VENDOR_INVOICE_RCM_ACCOUNTING_PENDING)
    expect(pending.message).toContain(RCM_ACCOUNTING_PENDING_CODE)
  })

  it('allows liability paid only from LIABILITY_POSTED', () => {
    expect(canTransitionRcmStatus('LIABILITY_POSTED', 'MARK_LIABILITY_PAID')).toBe(true)
    expect(canTransitionRcmStatus('LIABILITY_PAID', 'MARK_LIABILITY_PAID')).toBe(false)
    expect(canTransitionRcmStatus('LIABILITY_PAID', 'RECOGNIZE_ITC')).toBe(true)
    expect(canTransitionRcmStatus('LIABILITY_POSTED', 'RECOGNIZE_ITC')).toBe(false)
    expect(nextRcmStatus('MARK_LIABILITY_PAID')).toBe('LIABILITY_PAID')
    expect(nextRcmStatus('RECOGNIZE_ITC')).toBe('ITC_RECOGNIZED')
  })

  it('gates ITC claim until liability paid', () => {
    const pending = rcmItcGateNote({ status: 'LIABILITY_POSTED', itcEligibility: 'ELIGIBLE' })
    expect(pending.claimBlocked).toBe(true)
    expect(pending.reasons.some((r) => r.toLowerCase().includes('liability'))).toBe(true)

    const ready = rcmItcGateNote({ status: 'LIABILITY_PAID', itcEligibility: 'ELIGIBLE' })
    expect(ready.claimBlocked).toBe(false)
  })
})

describe('Phase 4 RCM on vendor invoice calculation', () => {
  it('blocks post when RCM accounts missing with RCM_ACCOUNTING_PENDING', () => {
    const result = calculateVendorInvoiceSync(
      baseInput({
        taxTreatment: 'REVERSE_CHARGE',
        configuration: { roundingMode: 'NONE', accounts: baseAccounts(false) },
      }),
    )

    expect(result.isReverseCharge).toBe(true)
    expect(result.accountReadiness.isReady).toBe(false)
    expect(result.validation.isValid).toBe(false)
    expect(
      result.validation.errors.some((e) => e.code === VENDOR_INVOICE_CALC_CODES.RCM_ACCOUNTING_PENDING),
    ).toBe(true)
    expect(result.validation.errors.some((e) => e.message.includes(RCM_ACCOUNTING_PENDING_CODE))).toBe(true)
  })

  it('posts balanced RCM preview when RCM accounts configured', () => {
    const result = calculateVendorInvoiceSync(baseInput({ taxTreatment: 'REVERSE_CHARGE' }))
    expect(result.validation.isValid).toBe(true)
    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.totals.vendorPayableAmount).toBe('100000.0000')
    expect(result.totals.rcmTotalTaxAmount).toBe('18000.0000')
    expect(
      result.validation.information.some(
        (i) => i.code === VENDOR_INVOICE_CALC_CODES.REVERSE_CHARGE_TAX_EXCLUDED_FROM_PAYABLE,
      ),
    ).toBe(true)
  })
})
