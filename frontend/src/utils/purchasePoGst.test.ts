import { describe, expect, it } from 'vitest'
import {
  aggregatePurchasePoGstTotals,
  computePurchasePoLineTax,
} from './purchasePoGst'
import { determinePurchaseGstSupply } from './gstSupply'

describe('computePurchasePoLineTax', () => {
  it('splits CGST+SGST for intra-state when scheme is cgst_sgst', () => {
    const tax = computePurchasePoLineTax({
      amount: 1000,
      gstRatePct: 18,
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      gstScheme: 'cgst_sgst',
    })
    expect(tax.cgst).toBe(90)
    expect(tax.sgst).toBe(90)
    expect(tax.igst).toBe(0)
    expect(tax.taxAmount).toBe(180)
    expect(tax.lineTotal).toBe(1180)
    expect(tax.isInterstate).toBe(false)
  })

  it('applies full IGST for inter-state scheme', () => {
    const tax = computePurchasePoLineTax({
      amount: 1000,
      gstRatePct: 18,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 18,
      gstScheme: 'igst',
    })
    expect(tax.cgst).toBe(0)
    expect(tax.sgst).toBe(0)
    expect(tax.igst).toBe(180)
    expect(tax.taxAmount).toBe(180)
    expect(tax.isInterstate).toBe(true)
  })

  it('treats IGST-only rate rows as inter-state when scheme omitted', () => {
    const tax = computePurchasePoLineTax({
      amount: 500,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 12,
    })
    expect(tax.igst).toBe(60)
    expect(tax.cgst).toBe(0)
    expect(tax.gstScheme).toBe('igst')
  })

  it('returns zero tax when rate is 0', () => {
    const tax = computePurchasePoLineTax({ amount: 1000, gstRatePct: 0 })
    expect(tax.taxAmount).toBe(0)
    expect(tax.lineTotal).toBe(1000)
  })
})

describe('aggregatePurchasePoGstTotals', () => {
  it('sums component amounts across lines', () => {
    const a = computePurchasePoLineTax({
      amount: 1000,
      gstRatePct: 18,
      cgstRate: 9,
      sgstRate: 9,
      gstScheme: 'cgst_sgst',
    })
    const b = computePurchasePoLineTax({
      amount: 2000,
      gstRatePct: 18,
      cgstRate: 9,
      sgstRate: 9,
      gstScheme: 'cgst_sgst',
    })
    const totals = aggregatePurchasePoGstTotals([a, b])
    expect(totals.cgst).toBe(270)
    expect(totals.sgst).toBe(270)
    expect(totals.igst).toBe(0)
    expect(totals.taxAmount).toBe(540)
  })
})

describe('determinePurchaseGstSupply for PO', () => {
  it('marks intra-state when vendor and place of supply share state code', () => {
    const gst = determinePurchaseGstSupply({
      supplierState: 'Maharashtra',
      supplierGstin: '27AABCU9603R1ZM',
      placeOfSupply: 'Maharashtra (27)',
    })
    expect(gst.isInterstate).toBe(false)
    expect(gst.gstScheme).toBe('cgst_sgst')
  })

  it('marks inter-state when vendor GSTIN state differs from POS', () => {
    const gst = determinePurchaseGstSupply({
      supplierGstin: '24AABCU9603R1ZM',
      placeOfSupply: 'Maharashtra (27)',
    })
    expect(gst.isInterstate).toBe(true)
    expect(gst.gstScheme).toBe('igst')
  })
})
