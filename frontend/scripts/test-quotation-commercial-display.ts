/**
 * Regression: quotation commercial terms display (preview/PDF data path)
 *   npx tsx --tsconfig tsconfig.app.json scripts/test-quotation-commercial-display.ts
 */
import assert from 'node:assert/strict'
import {
  buildQuotationCommercialFields,
  formatQuotationCurrencyDisplay,
  formatValidityPeriodLabel,
  daysBetweenDates,
  resolveCommercialTermsForConversion,
  QUOTATION_COMMERCIAL_LABELS,
} from '../src/utils/quotationEngine/commercialTermsDisplay'
import { buildQuotationMergeMap } from '../src/utils/quotationEngine/placeholders'
import type { Quotation } from '../src/types/sales'
import type { QuotationDocument } from '../src/types/crm'

function sampleQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'q1',
    quotationNo: 'QUO-001',
    customerId: 'c1',
    productId: 'p1',
    qty: 1,
    revisionNo: 1,
    rootQuotationId: 'q1',
    isLatestRevision: true,
    locked: false,
    status: 'draft',
    customerApproval: 'pending',
    customerApprovalAt: null,
    customerApprovalBy: null,
    customerRejectionReason: null,
    terms: 'This quotation remains valid until the specified date.',
    paymentTerms: '50% Advance and 50% Before Dispatch',
    deliveryTerms: 'Ex-Works',
    deliveryTime: 'Within 4–6 Weeks from Purchase Order Confirmation',
    validityDate: '2026-08-31',
    pricing: { unitPrice: 100, discountPct: 0, subtotal: 100, gstPct: 18, gstAmount: 18, grandTotal: 118 },
    changeHistory: [],
    salesOrderId: null,
    salesOrderNo: null,
    createdById: 'u1',
    createdByName: 'User',
    createdAt: '2026-08-01T10:00:00.000Z',
    modifiedById: null,
    modifiedByName: null,
    modifiedAt: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
    ...overrides,
  }
}

function sampleDoc(): QuotationDocument {
  return {
    id: 'd1',
    quotationId: 'q1',
    revisionNo: 1,
    templateId: null,
    opportunityId: null,
    sections: [
      {
        id: 's-pay',
        sectionType: 'payment',
        title: 'Payment',
        content: 'Should not override header payment',
        sequenceNo: 1,
        editable: true,
      },
    ],
    priceLines: [
      {
        id: 'l1',
        productOrItem: 'Trailer',
        description: '',
        qty: 1,
        uom: 'NOS',
        unitPrice: 100,
        discountPct: 0,
        taxPct: 18,
        lineTotal: 118,
        isOptional: false,
      },
    ],
    freightAmount: 0,
    installationAmount: 0,
    customCharges: 0,
    status: 'draft',
    totalAmount: 118,
    revisionReason: null,
    locked: false,
    approvalHistory: [],
    contactId: null,
    salesOwnerId: null,
    salesOwnerName: null,
    commercialNotes: null,
    technicalNotes: null,
    createdById: 'u1',
    createdByName: 'User',
    createdAt: '2026-08-01T10:00:00.000Z',
    modifiedById: null,
    modifiedByName: null,
    modifiedAt: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

let passed = 0
function ok(name: string) {
  passed += 1
  console.log(`  PASS  ${name}`)
}

console.log('Quotation commercial display regressions\n')

{
  assert.equal(QUOTATION_COMMERCIAL_LABELS.validityPeriod, 'Validity Period')
  assert.notEqual(QUOTATION_COMMERCIAL_LABELS.validityPeriod.toLowerCase(), 'veiled period')
  ok('label is Validity Period (not Veiled Period)')
}

{
  const q = sampleQuotation()
  const fields = buildQuotationCommercialFields({ quotation: q, document: sampleDoc() })
  const labels = fields.map((f) => f.label)
  assert.ok(labels.includes('Commercial Validity'))
  assert.ok(labels.includes('Valid Until'))
  assert.ok(labels.includes('Validity Period'))
  assert.ok(labels.includes('Currency'))
  assert.ok(labels.includes('Payment Terms'))
  assert.ok(labels.includes('Delivery Terms'))
  assert.ok(labels.includes('Delivery Time'))
  const pay = fields.find((f) => f.key === 'paymentTerms')
  assert.equal(pay?.value, '50% Advance and 50% Before Dispatch')
  assert.equal(formatQuotationCurrencyDisplay('INR'), 'INR – Indian Rupee')
  assert.equal(daysBetweenDates('2026-08-01', '2026-08-31'), 30)
  assert.equal(formatValidityPeriodLabel(30), '30 Days')
  ok('all commercial fields map from saved quotation header')
}

{
  const empty = buildQuotationCommercialFields({
    quotation: sampleQuotation({
      terms: 'Standard manufacturing terms apply.',
      paymentTerms: '',
      deliveryTerms: '',
      deliveryTime: '',
      validityDate: '',
    }),
    includeDefaultCurrency: false,
  })
  assert.equal(empty.length, 0)
  ok('blank / generic values produce no rows (no N/A)')
}

{
  const q = sampleQuotation({ paymentTerms: 'Header payment wins' })
  const doc = sampleDoc()
  const conv = resolveCommercialTermsForConversion(q, doc)
  assert.equal(conv.paymentTerms, 'Header payment wins')
  assert.equal(conv.deliveryTerms, 'Ex-Works')
  assert.equal(conv.deliveryTime, 'Within 4–6 Weeks from Purchase Order Confirmation')
  ok('conversion prefers header commercial terms over section body')
}

{
  const doc = sampleDoc()
  const q = sampleQuotation()
  const map = buildQuotationMergeMap({ document: doc, quotation: q })
  assert.equal(map.payment_terms, '50% Advance and 50% Before Dispatch')
  assert.equal(map.delivery_terms, 'Ex-Works')
  assert.equal(map.delivery_time, 'Within 4–6 Weeks from Purchase Order Confirmation')
  assert.equal(map.validity_days, '30')
  assert.ok(!map.payment_terms.includes('As per commercial'))
  assert.ok(map.validity_days !== '30' || map.validity_days === String(daysBetweenDates('2026-08-01', '2026-08-31')))
  // no invented defaults when fields empty and sections empty
  const emptyDoc = { ...doc, sections: [] as typeof doc.sections }
  const emptyMap = buildQuotationMergeMap({
    document: emptyDoc,
    quotation: sampleQuotation({
      paymentTerms: '',
      deliveryTerms: '',
      deliveryTime: '',
      terms: '',
      validityDate: '',
    }),
  })
  assert.equal(emptyMap.payment_terms, '')
  assert.equal(emptyMap.delivery_time, '')
  assert.equal(emptyMap.validity_days, '')
  ok('merge map uses saved values without hardcoded commercial fallbacks')
}

console.log(`\n${passed} checks passed.`)
