/**
 * Smoke: purchase PO GST pure helpers (no Vitest required on frontend).
 * Run: npx tsx --tsconfig tsconfig.app.json src/utils/purchasePoGst.smoke.ts
 */
import assert from 'node:assert/strict'
import {
  aggregatePurchasePoGstTotals,
  computePurchasePoLineTax,
} from './purchasePoGst.ts'
import { determinePurchaseGstSupply } from './gstSupply.ts'

function main() {
  const intra = computePurchasePoLineTax({
    amount: 1000,
    gstRatePct: 18,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    gstScheme: 'cgst_sgst',
  })
  assert.equal(intra.cgst, 90)
  assert.equal(intra.sgst, 90)
  assert.equal(intra.igst, 0)
  assert.equal(intra.taxAmount, 180)

  const inter = computePurchasePoLineTax({
    amount: 1000,
    gstRatePct: 18,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 18,
    gstScheme: 'igst',
  })
  assert.equal(inter.igst, 180)
  assert.equal(inter.cgst, 0)

  const supply = determinePurchaseGstSupply({
    supplierGstin: '24AABCU9603R1ZM',
    placeOfSupply: 'Maharashtra (27)',
  })
  assert.equal(supply.isInterstate, true)
  assert.equal(supply.gstScheme, 'igst')

  const totals = aggregatePurchasePoGstTotals([intra, inter])
  assert.equal(totals.taxAmount, 360)

  console.log('purchasePoGst smoke OK')
}

main()
