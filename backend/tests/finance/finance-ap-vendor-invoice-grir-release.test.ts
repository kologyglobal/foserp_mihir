/**
 * FIN-CLOSE-1 — GR/IR release on vendor invoice post.
 *
 * Pure/DB-free: drives the account resolver + accounting preview with an explicit GR/IR
 * release plan (the plan itself is built from POSTED inventory accounting events at runtime).
 */
import { describe, it, expect } from 'vitest'
import { calculateVendorInvoiceAmounts } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-amounts.service.js'
import {
  buildRequiredAccountComponents,
  finalizeAccountReadiness,
} from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-account-resolver.service.js'
import { buildVendorInvoiceAccountingPreview } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-accounting-preview.service.js'
import type { VendorInvoiceGrirReleasePlan } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-grir-release.service.js'
import type {
  VendorInvoiceAccountComponent,
  VendorInvoiceCalculationInput,
  VendorInvoiceResolvedAccount,
} from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-calculation.types.js'

const GRN_ID = '00000000-0000-4000-8000-00000000ba01'
const GRN_LINE_ID = '00000000-0000-4000-8000-00000000ba02'

function receiptInput(): VendorInvoiceCalculationInput {
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
    supplierInvoiceNumber: 'INV-GRIR-1',
    configuration: { roundingMode: 'NONE' },
    lines: [
      {
        lineNumber: 1,
        lineType: 'ITEM',
        description: 'MS Sheet 5mm',
        quantity: '10',
        unitPrice: '100',
        gstRate: '18',
        sourceLinkType: 'GOODS_RECEIPT',
        sourceDocumentId: GRN_ID,
        sourceDocumentLineId: GRN_LINE_ID,
      },
    ],
  }
}

function planFor(grirAmount: string, varianceAmount: string): VendorInvoiceGrirReleasePlan {
  const line = {
    lineNumber: 1,
    goodsReceiptId: GRN_ID,
    goodsReceiptLineId: GRN_LINE_ID,
    grirAmount,
    varianceAmount,
  }
  return { lines: [line], byLineNumber: { 1: line } }
}

/** Stands in for the DefaultAccountMapping lookup that only runs with a live tenant. */
const ACCOUNT_BY_COMPONENT: Partial<Record<VendorInvoiceAccountComponent, string>> = {
  LINE_DEBIT: 'acc-purchase',
  GRIR_CLEARING: 'acc-grir',
  PURCHASE_PRICE_VARIANCE: 'acc-ppv',
  INPUT_CGST: 'acc-cgst',
  INPUT_SGST: 'acc-sgst',
  INPUT_IGST: 'acc-igst',
  INPUT_CESS: 'acc-cess',
  VENDOR_PAYABLE: 'acc-payable',
}

function resolveAll(entries: VendorInvoiceResolvedAccount[]): VendorInvoiceResolvedAccount[] {
  for (const entry of entries) {
    const accountId = ACCOUNT_BY_COMPONENT[entry.component]
    if (!accountId) continue
    entry.accountId = accountId
    entry.accountCode = accountId
    entry.accountName = accountId
    entry.source = 'DEFAULT_MAPPING'
    entry.isValid = true
  }
  return entries
}

function build(plan: VendorInvoiceGrirReleasePlan | null) {
  const amounts = calculateVendorInvoiceAmounts(receiptInput())
  const resolved = resolveAll(
    buildRequiredAccountComponents({
      amountsResult: amounts,
      configuration: undefined,
      tdsMode: 'NOT_APPLICABLE',
      grirReleasePlan: plan,
    }),
  )
  const accountReadiness = finalizeAccountReadiness(resolved)
  const preview = buildVendorInvoiceAccountingPreview({
    amountsResult: amounts,
    accountReadiness,
    input: { vendorId: 'vendor-a', currencyCode: 'INR', exchangeRate: '1', tdsRecognitionMode: 'NOT_APPLICABLE' },
    grirReleasePlan: plan,
  })
  return { amounts, accountReadiness, preview }
}

function componentAmount(
  preview: ReturnType<typeof build>['preview'],
  component: VendorInvoiceAccountComponent,
): { debit: string; credit: string } | null {
  const line = preview.lines.find((l) => l.component === component)
  if (!line) return null
  return { debit: line.debitAmount, credit: line.creditAmount }
}

describe('FIN-CLOSE-1 — vendor invoice GR/IR release', () => {
  it('1. no plan — GRN line still debits PURCHASE (unchanged behaviour)', () => {
    const { preview } = build(null)

    expect(preview.isBalanced).toBe(true)
    expect(componentAmount(preview, 'LINE_DEBIT')?.debit).toBe('1000.0000')
    expect(componentAmount(preview, 'GRIR_CLEARING')).toBeNull()
    expect(componentAmount(preview, 'PURCHASE_PRICE_VARIANCE')).toBeNull()
  })

  it('2. invoice price above receipt cost — GR/IR released at receipt cost, excess to variance', () => {
    // Received at 950, invoiced at 1000 → 50 unfavourable price variance.
    const { preview } = build(planFor('950.0000', '50.0000'))

    expect(preview.isBalanced).toBe(true)
    expect(componentAmount(preview, 'GRIR_CLEARING')?.debit).toBe('950.0000')
    expect(componentAmount(preview, 'PURCHASE_PRICE_VARIANCE')?.debit).toBe('50.0000')
    // Nothing left on PURCHASE — the goods value moved entirely to GR/IR + variance.
    expect(componentAmount(preview, 'LINE_DEBIT')).toBeNull()
  })

  it('3. invoice price below receipt cost — variance is a credit', () => {
    // Received at 1100, invoiced at 1000 → 100 favourable price variance.
    const { preview } = build(planFor('1100.0000', '-100.0000'))

    expect(preview.isBalanced).toBe(true)
    expect(componentAmount(preview, 'GRIR_CLEARING')?.debit).toBe('1100.0000')
    expect(componentAmount(preview, 'PURCHASE_PRICE_VARIANCE')?.credit).toBe('100.0000')
  })

  it('4. invoice price equals receipt cost — GR/IR clears with no variance line', () => {
    const { preview } = build(planFor('1000.0000', '0.0000'))

    expect(preview.isBalanced).toBe(true)
    expect(componentAmount(preview, 'GRIR_CLEARING')?.debit).toBe('1000.0000')
    expect(componentAmount(preview, 'PURCHASE_PRICE_VARIANCE')).toBeNull()
  })

  it('5. total debit is unchanged by the GR/IR split', () => {
    const withoutPlan = build(null).preview
    const withPlan = build(planFor('950.0000', '50.0000')).preview

    expect(withPlan.totalDebit).toBe(withoutPlan.totalDebit)
    expect(withPlan.totalCredit).toBe(withoutPlan.totalCredit)
    expect(withPlan.vendorPayableCreditAmount).toBe(withoutPlan.vendorPayableCreditAmount)
  })

  it('6. a variance credit keeps both sides equal', () => {
    const { preview } = build(planFor('1100.0000', '-100.0000'))

    const debit = preview.lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const credit = preview.lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(debit).toBeCloseTo(credit, 4)
  })

  it('7. GR/IR and variance accounts are required only when the plan needs them', () => {
    const withoutPlan = build(null).accountReadiness
    expect(withoutPlan.resolvedAccounts.some((e) => e.component === 'GRIR_CLEARING')).toBe(false)

    const noVariance = build(planFor('1000.0000', '0.0000')).accountReadiness
    expect(noVariance.resolvedAccounts.some((e) => e.component === 'GRIR_CLEARING')).toBe(true)
    expect(noVariance.resolvedAccounts.some((e) => e.component === 'PURCHASE_PRICE_VARIANCE')).toBe(false)
  })
})
