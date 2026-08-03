import { describe, expect, it } from 'vitest'
import {
  calcAdjustmentAmount,
  calcOrderDocumentTotals,
} from './orderAdjustmentsCalc'
import { calcPriceSummary } from './crmQuotationCalc'
import { calcProductPricingSummary } from './opportunityLineCalc'
import type { OpportunityLine } from '../types/crm'

const baseLine = (overrides: Partial<OpportunityLine> = {}): OpportunityLine => ({
  id: 'l1',
  lineNo: 1,
  productId: null,
  itemId: null,
  itemCode: '',
  productOrItem: 'Item',
  description: '',
  productFamily: '',
  itemType: '',
  qty: 1,
  uom: 'NOS',
  unitPrice: 100_000,
  discountPct: 0,
  discountAmount: 0,
  taxPct: 18,
  taxableValue: 100_000,
  gstAmount: 18_000,
  lineTotal: 118_000,
  expectedDeliveryDate: null,
  remarks: '',
  ...overrides,
})

describe('order adjustments (frontend shared service)', () => {
  it('user example: 10% order discount then 5% freight → 4,500', () => {
    const amount = calcAdjustmentAmount('PERCENTAGE', 5, 90_000)
    expect(amount).toBe(4_500)

    const totals = calcOrderDocumentTotals(
      [{ qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 18 }],
      {
        orderDiscount: { calculationType: 'PERCENTAGE', value: 10 },
        freight: { calculationType: 'PERCENTAGE', value: 5, isTaxable: false },
      },
    )
    expect(totals.freight.calculatedAmount).toBe(4_500)
  })

  it('calcPriceSummary and calcProductPricingSummary stay aligned', () => {
    const lines = [baseLine()]
    const pricing = calcProductPricingSummary(lines, {
      orderDiscountMode: 'percent',
      orderDiscountInput: 10,
      freight: { calculationType: 'percent', value: 5, isTaxable: false },
      installation: { calculationType: 'flat', value: 1_000, isTaxable: true, taxRate: 18 },
      otherCharges: { calculationType: 'flat', value: 200, isTaxable: false },
    })
    const summary = calcPriceSummary(
      [
        {
          id: 'p1',
          productOrItem: 'Item',
          description: '',
          qty: 1,
          uom: 'NOS',
          unitPrice: 100_000,
          discountPct: 0,
          taxPct: 18,
          lineTotal: 118_000,
          isOptional: false,
        },
      ],
      {
        orderDiscountCalcType: 'PERCENTAGE',
        orderDiscountValue: 10,
        freightCalcType: 'PERCENTAGE',
        freightValue: 5,
        freightIsTaxable: false,
        installationCalcType: 'FLAT',
        installationValue: 1_000,
        installationIsTaxable: true,
        installationTaxRate: 18,
        customChargesCalcType: 'FLAT',
        customChargesValue: 200,
        customChargesIsTaxable: false,
      },
    )
    expect(pricing.freightAmount).toBe(summary.freightAmount)
    expect(pricing.installationAmount).toBe(summary.installationAmount)
    expect(pricing.customCharges).toBe(summary.customCharges)
    expect(pricing.grandTotal).toBe(summary.grandTotal)
    expect(pricing.totalGst).toBe(summary.gstAmount)
  })
})
