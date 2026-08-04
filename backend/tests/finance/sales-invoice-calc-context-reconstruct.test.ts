/**
 * Unit tests: reconstruct SalesInvoice calculation context when JSON is missing
 * (CRM tax-invoice migration / legacy rows).
 */
import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  buildCalculationInputFromStoredInvoice,
  parseCalculationContext,
  reconstructCalculationContextFromStoredInvoice,
  resolveCalculationContext,
} from '../../src/modules/accounting/receivables/sales-invoices/sales-invoice-validation.service.js'
import type { SalesInvoiceWithLines } from '../../src/modules/accounting/receivables/sales-invoices/sales-invoice.types.js'
import { calculateSalesInvoice } from '../../src/modules/accounting/receivables/calculation/sales-invoice-calculation.service.js'

const d = (v: string) => new Prisma.Decimal(v)

function baseInvoice(
  overrides: Partial<SalesInvoiceWithLines> & { lines: SalesInvoiceWithLines['lines'] },
): SalesInvoiceWithLines {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    tenantId: '11111111-1111-1111-1111-111111111111',
    legalEntityId: '22222222-2222-2222-2222-222222222222',
    branchId: null,
    financialYearId: null,
    invoiceNumber: null,
    draftReference: 'AR-DRAFT-TEST',
    status: 'READY_TO_POST',
    customerId: '33333333-3333-3333-3333-333333333333',
    customerCodeSnapshot: null,
    customerNameSnapshot: 'Acme',
    customerGstinSnapshot: null,
    customerPanSnapshot: null,
    customerBillingAddressSnapshot: null,
    customerStateCodeSnapshot: '27',
    customerShippingAddressSnapshot: null,
    calculationContext: null,
    sourceType: 'DIRECT',
    sourceDocumentId: null,
    sourceDocumentSnapshot: null,
    projectRef: null,
    projectNameSnapshot: null,
    invoiceDate: new Date('2026-08-03'),
    postingDate: new Date('2026-08-03'),
    referenceNumber: 'INV-00004',
    customerPoNumber: null,
    paymentTermsDays: null,
    freightAmount: d('0'),
    otherChargesAmount: d('0'),
    dueDate: null,
    placeOfSupply: '27',
    supplyType: 'INTRA_STATE',
    taxTreatment: 'UNREGISTERED',
    currencyCode: 'INR',
    exchangeRate: d('1'),
    subtotalAmount: d('1000'),
    discountAmount: d('0'),
    taxableAmount: d('1000'),
    cgstAmount: d('90'),
    sgstAmount: d('90'),
    igstAmount: d('0'),
    cessAmount: d('0'),
    totalTaxAmount: d('180'),
    roundOffAmount: d('0'),
    totalAmount: d('1180'),
    baseSubtotalAmount: d('1000'),
    baseDiscountAmount: d('0'),
    baseTaxableAmount: d('1000'),
    baseCgstAmount: d('90'),
    baseSgstAmount: d('90'),
    baseIgstAmount: d('0'),
    baseCessAmount: d('0'),
    baseTotalTaxAmount: d('180'),
    baseRoundOffAmount: d('0'),
    baseTotalAmount: d('1180'),
    narration: null,
    accountingVoucherId: null,
    postingEventId: null,
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    reversalVoucherId: null,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    quotationId: null,
    quotationNo: null,
    proformaInvoiceId: null,
    proformaNo: null,
    salesOrderId: null,
    salesOrderNo: null,
    deliveryTerms: null,
    paymentTerms: null,
    legacyCrmTaxInvoiceId: null,
    legacyCrmInvoiceNo: null,
    createdChannel: 'CRM',
    commercialMetadata: null,
    ...overrides,
  } as SalesInvoiceWithLines
}

function sampleLine(partial?: Partial<SalesInvoiceWithLines['lines'][number]>): SalesInvoiceWithLines['lines'][number] {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: '11111111-1111-1111-1111-111111111111',
    legalEntityId: '22222222-2222-2222-2222-222222222222',
    salesInvoiceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    lineNumber: 1,
    sourceLineId: null,
    itemId: null,
    itemCodeSnapshot: 'SKU-1',
    itemNameSnapshot: 'Widget',
    hsnCodeSnapshot: '8471',
    uomSnapshot: 'NOS',
    description: 'Widget',
    quantity: d('1'),
    unitRate: d('1000'),
    grossAmount: d('1000'),
    discountPercent: d('0'),
    discountAmount: d('0'),
    taxableAmount: d('1000'),
    cgstRate: d('9'),
    cgstAmount: d('90'),
    sgstRate: d('9'),
    sgstAmount: d('90'),
    igstRate: d('0'),
    igstAmount: d('0'),
    cessRate: d('0'),
    cessAmount: d('0'),
    lineTotal: d('1180'),
    revenueAccountId: null,
    costCentreId: null,
    projectRef: null,
    projectNameSnapshot: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as SalesInvoiceWithLines['lines'][number]
}

describe('sales invoice calc context reconstruction', () => {
  it('parseCalculationContext rejects null and empty lines', () => {
    expect(parseCalculationContext(null)).toBeNull()
    expect(parseCalculationContext({})).toBeNull()
    expect(parseCalculationContext({ lines: [] })).toBeNull()
  })

  it('reconstructs context from stored lines when calculationContext is null', () => {
    const invoice = baseInvoice({ lines: [sampleLine()] })
    const ctx = reconstructCalculationContextFromStoredInvoice(invoice)
    expect(ctx).not.toBeNull()
    expect(ctx!.lines).toHaveLength(1)
    expect(ctx!.lines[0].unitPrice).toBe('1000')
    expect(ctx!.lines[0].gstRate).toBe('18')
    expect(ctx!.taxPricingMode).toBe('EXCLUSIVE')
  })

  it('buildCalculationInputFromStoredInvoice works without stored JSON', () => {
    const invoice = baseInvoice({ lines: [sampleLine()] })
    const input = buildCalculationInputFromStoredInvoice(invoice, '27')
    expect(input).not.toBeNull()
    const calc = calculateSalesInvoice(input!)
    expect(calc.valid).toBe(true)
    expect(calc.taxableAmount).toBe('1000.0000')
    expect(calc.totalTaxAmount).toBe('180.0000')
    expect(calc.totalAmount).toBe('1180.0000')
  })

  it('resolveCalculationContext prefers valid stored context over rebuild', () => {
    const stored = {
      taxPricingMode: 'EXCLUSIVE' as const,
      lines: [
        {
          lineNumber: 1,
          quantity: '2',
          unitPrice: '500',
          gstRate: '18',
        },
      ],
    }
    const invoice = baseInvoice({
      calculationContext: stored as unknown as Prisma.JsonValue,
      lines: [sampleLine()],
    })
    const resolved = resolveCalculationContext(invoice)
    expect(resolved?.lines[0].quantity).toBe('2')
    expect(resolved?.lines[0].unitPrice).toBe('500')
  })

  it('derives IGST rate for inter-state stored lines', () => {
    const invoice = baseInvoice({
      supplyType: 'INTER_STATE',
      placeOfSupply: '29',
      cgstAmount: d('0'),
      sgstAmount: d('0'),
      igstAmount: d('180'),
      lines: [
        sampleLine({
          cgstRate: d('0'),
          cgstAmount: d('0'),
          sgstRate: d('0'),
          sgstAmount: d('0'),
          igstRate: d('18'),
          igstAmount: d('180'),
        }),
      ],
    })
    const ctx = reconstructCalculationContextFromStoredInvoice(invoice)
    expect(ctx!.lines[0].gstRate).toBe('18')
  })
})
