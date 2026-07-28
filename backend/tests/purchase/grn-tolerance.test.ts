import { describe, expect, it } from 'vitest'
import {
  evaluateGrnDocumentTolerance,
  evaluateGrnLineTolerance,
  lineRequiresToleranceApproval,
  resolveReceivingTolerancePct,
} from '../../src/modules/purchase/shared/grn-tolerance.js'

describe('grn-tolerance', () => {
  it('resolves item tolerance over setup', () => {
    expect(
      resolveReceivingTolerancePct({
        itemTolerancePct: 2,
        setupTolerancePct: 5,
        allowOverReceipt: true,
      }),
    ).toBe(2)
  })

  it('falls back to setup when item is 0 and over-receipt allowed', () => {
    expect(
      resolveReceivingTolerancePct({
        itemTolerancePct: 0,
        setupTolerancePct: 5,
        allowOverReceipt: true,
      }),
    ).toBe(5)
  })

  it('does not use setup when over-receipt disallowed', () => {
    expect(
      resolveReceivingTolerancePct({
        itemTolerancePct: 0,
        setupTolerancePct: 10,
        allowOverReceipt: false,
      }),
    ).toBe(0)
  })

  it('marks exact / within band as OK', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 990,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('OK')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks intentional under-receipt as PARTIAL', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 600,
      itemTolerancePct: 2,
      closeOpenQuantity: false,
    })
    expect(r.toleranceStatus).toBe('PARTIAL')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks zero as NOT_RECEIVED', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 0,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('NOT_RECEIVED')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks short close outside band as SHORT_OUTSIDE', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 900,
      itemTolerancePct: 2,
      closeOpenQuantity: true,
    })
    expect(r.toleranceStatus).toBe('SHORT_OUTSIDE')
    expect(r.requiresApproval).toBe(true)
  })

  it('marks excess within band as EXCESS_WITHIN', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 1015,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('EXCESS_WITHIN')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks excess outside band as EXCESS_OUTSIDE', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 1050,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE')
    expect(r.requiresApproval).toBe(true)
  })

  it('0% tol: any excess requires approval', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 100,
      receivedQuantity: 101,
      itemTolerancePct: 0,
    })
    expect(r.tolerancePercentage).toBe(0)
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE')
    expect(r.requiresApproval).toBe(true)
  })

  it('10% tol: +5% is within; +15% is outside', () => {
    const within = evaluateGrnLineTolerance({
      openQuantity: 100,
      receivedQuantity: 105,
      itemTolerancePct: 10,
    })
    expect(within.toleranceStatus).toBe('EXCESS_WITHIN')
    expect(within.requiresApproval).toBe(false)

    const outside = evaluateGrnLineTolerance({
      openQuantity: 100,
      receivedQuantity: 115,
      itemTolerancePct: 10,
    })
    expect(outside.toleranceStatus).toBe('EXCESS_OUTSIDE')
    expect(outside.requiresApproval).toBe(true)
  })

  it('computes variance vs open qty (not full ordered)', () => {
    // Second GRN: open remaining 40, receive 42 (+5%) with 10% tol → within
    const r = evaluateGrnLineTolerance({
      openQuantity: 40,
      receivedQuantity: 42,
      itemTolerancePct: 10,
    })
    expect(r.variancePercentage).toBe(5)
    expect(r.toleranceStatus).toBe('EXCESS_WITHIN')
  })

  it('lineRequiresToleranceApproval only for OUTSIDE statuses', () => {
    expect(lineRequiresToleranceApproval('OK')).toBe(false)
    expect(lineRequiresToleranceApproval('PARTIAL')).toBe(false)
    expect(lineRequiresToleranceApproval('EXCESS_WITHIN')).toBe(false)
    expect(lineRequiresToleranceApproval('NOT_RECEIVED')).toBe(false)
    expect(lineRequiresToleranceApproval('EXCESS_OUTSIDE')).toBe(true)
    expect(lineRequiresToleranceApproval('SHORT_OUTSIDE')).toBe(true)
  })
})

describe('grn-tolerance document (multi-line / 1-of-3)', () => {
  it('receive only 1 of 3 — others NOT_RECEIVED, no approval', () => {
    const doc = evaluateGrnDocumentTolerance([
      { itemCode: 'TOL-ITEM-0PCT', openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 0 },
      { itemCode: 'TOL-ITEM-2PCT', openQuantity: 100, receivedQuantity: 100, itemTolerancePct: 2 },
      { itemCode: 'TOL-ITEM-10PCT', openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 10 },
    ])
    expect(doc.lines.map((l) => l.toleranceStatus)).toEqual(['NOT_RECEIVED', 'OK', 'NOT_RECEIVED'])
    expect(doc.requiresApproval).toBe(false)
    expect(doc.notReceivedCount).toBe(2)
    expect(doc.receivableLineCount).toBe(1)
  })

  it('receive 1 of 3 outside → document requires approval', () => {
    const doc = evaluateGrnDocumentTolerance([
      { openQuantity: 100, receivedQuantity: 110, itemTolerancePct: 0 },
      { openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 2 },
      { openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 10 },
    ])
    expect(doc.requiresApproval).toBe(true)
    expect(doc.lines[0]!.toleranceStatus).toBe('EXCESS_OUTSIDE')
    expect(doc.outsideCount).toBe(1)
  })
})
