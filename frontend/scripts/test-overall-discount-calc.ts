/**
 * Overall discount must apply only to taxable amount (pre-tax), then GST recomputed.
 * Run: npx tsx --tsconfig tsconfig.app.json scripts/test-overall-discount-calc.ts
 */
import {
  applyOverallDiscountToLines,
  calcProductPricingSummary,
  computeOverallDiscountAmount,
  type OpportunityLine,
} from '../src/utils/opportunityLineCalc'
import { calcOrderDocumentTotals } from '../src/utils/orderAdjustmentsCalc'

let failed = 0

function assert(label: string, cond: boolean, detail = '') {
  if (!cond) {
    failed += 1
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    return
  }
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
}

function line(partial: Partial<OpportunityLine> & Pick<OpportunityLine, 'id' | 'qty' | 'unitPrice' | 'taxPct'>): OpportunityLine {
  return {
    lineNo: 1,
    productId: null,
    itemId: null,
    itemCode: '',
    productOrItem: 'Item',
    description: '',
    productFamily: '',
    itemType: '',
    uom: 'Nos',
    discountPct: 0,
    discountAmount: 0,
    taxableValue: 0,
    gstAmount: 0,
    lineTotal: 0,
    expectedDeliveryDate: null,
    remarks: '',
    ...partial,
  }
}

console.log('\nOverall discount — standard ERP calculation\n')

// Spec example: Taxable 100000, 10% overall → disc 10000 → taxable 90000 → GST 18% 16200 → grand 106200
const baseLines = [line({ id: 'l1', qty: 1, unitPrice: 100_000, taxPct: 18 })]
const percentDisc = computeOverallDiscountAmount(100_000, 'percent', 10)
assert('10% overall on taxable = 10,000', percentDisc === 10_000, String(percentDisc))

const summary = calcProductPricingSummary(baseLines, {
  orderDiscountMode: 'percent',
  orderDiscountInput: 10,
})
assert('taxable before overall = 100,000', summary.taxableBeforeOverallDiscount === 100_000)
assert('order discount amount = 10,000', summary.orderDiscountAmount === 10_000)
assert('taxable after overall = 90,000', summary.taxableAfterOverallDiscount === 90_000)
assert('GST on revised taxable = 16,200', summary.totalGst === 16_200)
assert('Grand total = 106,200 (not post-tax discount)', summary.grandTotal === 106_200)

// Incorrect post-tax path would be: (100k + 18k) * 10% = 11800 off → grand 106200 coincidentally same for 18% only?
// Wait: 118000 - 11800 = 106200. Same grand for single flat 18% rate when percent of taxable vs percent of (taxable+gst)...
// (T + 0.18T) * 0.1 = 1.18T * 0.1 = 0.118T
// T - 0.1T + 0.18*(0.9T) = 0.9T + 0.162T = 1.062T
// Post-tax: 1.18T - 0.118T = 1.062T — same when GST is uniform and % of full total!
// Distinguish with flat amount discount:
const flatSummary = calcProductPricingSummary(baseLines, {
  orderDiscountMode: 'flat',
  orderDiscountInput: 10_000,
})
assert('flat 10k overall → same as 10%', flatSummary.grandTotal === 106_200)

// Post-tax wrong path for flat: grand = 118000 - 10000 = 108000
assert(
  'flat discount is NOT off grand total (would be 108,000)',
  flatSummary.grandTotal !== 108_000 && flatSummary.grandTotal === 106_200,
)

// Flat discount cannot include freight base
const withFreight = calcProductPricingSummary(baseLines, {
  orderDiscountMode: 'flat',
  orderDiscountInput: 105_000,
  freightAmount: 5_000,
})
assert('flat overall caps at taxable only (100k)', withFreight.orderDiscountAmount === 100_000)
assert('revised taxable is 0', withFreight.taxableAfterOverallDiscount === 0)
assert('GST after full taxable disc = 0', withFreight.totalGst === 0)
assert('grand = freight only', withFreight.grandTotal === 5_000)

// Multi-rate: 50k@18 + 50k@28, 10% overall
const multi = [
  line({ id: 'a', qty: 1, unitPrice: 50_000, taxPct: 18 }),
  line({ id: 'b', qty: 1, unitPrice: 50_000, taxPct: 28 }),
]
const multiSummary = calcProductPricingSummary(multi, {
  orderDiscountMode: 'percent',
  orderDiscountInput: 10,
})
assert('multi-rate taxable after = 90,000', multiSummary.taxableAfterOverallDiscount === 90_000)
// After 10% disc: 45k@18 → GST 8100; 45k@28 → GST 12600; total GST 20700; grand 110700
assert('multi-rate GST recomputed by line rate', multiSummary.totalGst === 20_700, String(multiSummary.totalGst))
assert('multi-rate grand total', multiSummary.grandTotal === 110_700, String(multiSummary.grandTotal))

const applied = applyOverallDiscountToLines(multi, 10_000)
const shareSum = applied.discountedLines.reduce((s, l) => s + l.overallDiscountShare, 0)
assert('allocated overall shares sum to disc amount', Math.abs(shareSum - 10_000) < 0.01, String(shareSum))

// orderAdjustmentsCalc (quotation / API path) same formula
const adjTotals = calcOrderDocumentTotals(
  [{ qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 18 }],
  { orderDiscount: { calculationType: 'PERCENTAGE', value: 10 } },
)
assert('orderAdjustmentsCalc disc amount 10k', adjTotals.orderDiscount.calculatedAmount === 10_000)
assert('orderAdjustmentsCalc discounted taxable 90k', adjTotals.discountedTaxableAmount === 90_000)
assert('orderAdjustmentsCalc GST 16200', adjTotals.gstAmount === 16_200)
assert('orderAdjustmentsCalc grand 106200', adjTotals.grandTotal === 106_200)

// Line-level discount first, then overall on remaining taxable
const withLineDisc = calcProductPricingSummary(
  [line({ id: 'c', qty: 1, unitPrice: 100_000, discountPct: 10, taxPct: 18 })],
  { orderDiscountMode: 'percent', orderDiscountInput: 10 },
)
// Line disc → taxable 90k; overall 10% → 9k; taxable 81k; GST 14580; grand 95580
assert('line + overall: taxable before overall = 90,000', withLineDisc.taxableBeforeOverallDiscount === 90_000)
assert('line + overall: disc = 9,000', withLineDisc.orderDiscountAmount === 9_000)
assert('line + overall: taxable after = 81,000', withLineDisc.taxableAfterOverallDiscount === 81_000)
assert('line + overall: GST = 14,580', withLineDisc.totalGst === 14_580)
assert('line + overall: grand = 95,580', withLineDisc.grandTotal === 95_580)

console.log(failed ? `\nFAILED: ${failed} assertion(s)\n` : '\nAll overall-discount calc checks passed.\n')
process.exit(failed ? 1 : 0)
