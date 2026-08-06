import { describe, expect, it } from 'vitest'
import {
  evaluateGrnDocumentTolerance,
  evaluateGrnLineTolerance,
  lineRequiresToleranceApproval,
  resolveReceivingTolerancePct,
} from '../../src/modules/purchase/shared/grn-tolerance.js'

describe('grn-tolerance', () => {
  it('uses legacy item tolerance when over-receipt disallowed', () => {
    expect(
      resolveReceivingTolerancePct({
        itemTolerancePct: 2,
        setupTolerancePct: 5,
        allowOverReceipt: false,
      }),
    ).toBe(2)
  })

  it('uses master 0% when FK set — not setup fallback', () => {
    expect(
      resolveReceivingTolerancePct({
        receivingToleranceId: 'id',
        masterTolerance: { id: 'id', code: 'EXACT', name: 'Exact', percentage: 0 },
        setupTolerancePct: 10,
        allowOverReceipt: true,
      }),
    ).toBe(0)
  })

  it('falls back to setup when FK null and over-receipt allowed', () => {
    expect(
      resolveReceivingTolerancePct({
        itemTolerancePct: 0,
        setupTolerancePct: 5,
        allowOverReceipt: true,
      }),
    ).toBe(5)
  })

  it('marks exact receipt as EXACT', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 1000,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('EXACT')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks under-receipt as PARTIAL (excess-only model)', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 990,
      itemTolerancePct: 2,
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

  it('short close requests approval without SHORT_OUTSIDE status', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 900,
      itemTolerancePct: 2,
      shortCloseRequested: true,
    })
    expect(r.toleranceStatus).toBe('PARTIAL')
    expect(r.requiresApproval).toBe(true)
    expect(r.approvalReasons).toContain('SHORT_CLOSE_REQUESTED')
  })

  it('marks excess within band as EXCESS_WITHIN_TOLERANCE', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 1015,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('EXCESS_WITHIN_TOLERANCE')
    expect(r.requiresApproval).toBe(false)
  })

  it('marks excess outside band as EXCESS_OUTSIDE_TOLERANCE', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 1000,
      receivedQuantity: 1050,
      itemTolerancePct: 2,
    })
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(r.requiresApproval).toBe(true)
    expect(r.approvalReasons).toContain('UNIT_OVER_TOLERANCE')
  })

  it('0% tol: any excess requires approval', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 100,
      receivedQuantity: 101,
      receivingToleranceId: 'exact-id',
      masterTolerance: { id: 'exact-id', code: 'EXACT', name: 'Exact', percentage: 0 },
    })
    expect(r.tolerancePercentage).toBe(0)
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(r.requiresApproval).toBe(true)
  })

  it('lineRequiresToleranceApproval only for EXCESS_OUTSIDE_TOLERANCE', () => {
    expect(lineRequiresToleranceApproval('EXACT')).toBe(false)
    expect(lineRequiresToleranceApproval('PARTIAL')).toBe(false)
    expect(lineRequiresToleranceApproval('EXCESS_WITHIN_TOLERANCE')).toBe(false)
    expect(lineRequiresToleranceApproval('NOT_RECEIVED')).toBe(false)
    expect(lineRequiresToleranceApproval('EXCESS_OUTSIDE_TOLERANCE')).toBe(true)
  })

  it('does not allow any receipt when open quantity is zero', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 0,
      receivedQuantity: 5,
      itemTolerancePct: 10,
    })
    expect(r.upperBound).toBe(0)
    expect(r.maximumAllowedUnitQuantity).toBe(0)
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
  })

  it('caps max receipt at open + tolerance (hard upper bound)', () => {
    const r = evaluateGrnLineTolerance({
      openQuantity: 10,
      receivedQuantity: 110,
      itemTolerancePct: 0,
    })
    expect(r.upperBound).toBe(10)
    expect(r.maximumAllowedUnitQuantity).toBe(10)
    expect(r.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(r.requiresApproval).toBe(true)
  })
})

describe('grn-tolerance document (multi-line)', () => {
  it('receive only 1 of 3 — others NOT_RECEIVED, no approval', () => {
    const doc = evaluateGrnDocumentTolerance([
      { itemCode: 'A', openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 0 },
      { itemCode: 'B', openQuantity: 100, receivedQuantity: 100, itemTolerancePct: 2 },
      { itemCode: 'C', openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 10 },
    ])
    expect(doc.lines.map((l) => l.toleranceStatus)).toEqual(['NOT_RECEIVED', 'EXACT', 'NOT_RECEIVED'])
    expect(doc.requiresApproval).toBe(false)
    expect(doc.exactCount).toBe(1)
  })

  it('receive 1 of 3 outside → document requires approval', () => {
    const doc = evaluateGrnDocumentTolerance([
      { openQuantity: 100, receivedQuantity: 110, itemTolerancePct: 0 },
      { openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 2 },
      { openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 10 },
    ])
    expect(doc.requiresApproval).toBe(true)
    expect(doc.lines[0]!.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
  })
})
