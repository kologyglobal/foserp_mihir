/**
 * Unit tests for SO line tax snapshot persistence (HSN + scheme breakup).
 * Reuses buildLinesFromInput — no parallel tax engine.
 */
import { describe, expect, it } from 'vitest'
import { buildLinesFromInput } from '../src/modules/crm/sales-orders/sales-order.workflow.js'

const itemId = '11111111-1111-4111-8111-111111111111'

describe('sales-order buildLinesFromInput tax snapshot', () => {
  it('persists HSN and CGST+SGST component rates on intra-state line', () => {
    const { lines, summary } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Trailer chassis',
          description: 'Chassis',
          itemId,
          qty: 2,
          uom: 'NOS',
          unitPrice: 1000,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8716',
          taxScheme: 'cgst_sgst',
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
        },
      ],
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]!.hsnCode).toBe('8716')
    expect(lines[0]!.taxScheme).toBe('cgst_sgst')
    expect(lines[0]!.cgstRate).toBe(9)
    expect(lines[0]!.sgstRate).toBe(9)
    expect(lines[0]!.igstRate).toBe(0)
    expect(lines[0]!.taxableValue).toBe(2000)
    expect(lines[0]!.cgstAmount).toBe(180)
    expect(lines[0]!.sgstAmount).toBe(180)
    expect(lines[0]!.igstAmount).toBe(0)
    expect(lines[0]!.gstAmount).toBe(360)
    expect(summary.gstAmount).toBe(360)
  })

  it('clears CGST/SGST amounts and uses IGST for inter-state scheme', () => {
    const { lines } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Part',
          itemId,
          qty: 1,
          unitPrice: 1000,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8708',
          taxScheme: 'igst',
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 18,
        },
      ],
    })

    expect(lines[0]!.taxScheme).toBe('igst')
    expect(lines[0]!.cgstRate).toBe(0)
    expect(lines[0]!.sgstRate).toBe(0)
    expect(lines[0]!.igstRate).toBe(18)
    expect(lines[0]!.cgstAmount).toBe(0)
    expect(lines[0]!.sgstAmount).toBe(0)
    expect(lines[0]!.igstAmount).toBe(180)
    expect(lines[0]!.gstAmount).toBe(180)
  })

  it('requires taxPct (no silent invent)', () => {
    expect(() =>
      buildLinesFromInput({
        lines: [
          {
            productOrItem: 'X',
            itemId,
            qty: 1,
            unitPrice: 100,
          } as never,
        ],
      }),
    ).toThrow(/taxPct is required/)
  })
})
