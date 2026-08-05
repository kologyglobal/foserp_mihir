/**
 * Phase 16 — GST rate master ops pure unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  buildPhase16CapabilityMatrix,
  buildRateChangeImpact,
  evaluateLedgerRateDrift,
  findExpiringRates,
  findRateCoverageGaps,
  findRateOverlaps,
  isPhase16RateOpsEnabled,
  isRateActiveAsOf,
  scoreRateOpsHealth,
  type RateMasterLike,
} from '../src/modules/accounting/tax-compliance/gst-rate-ops.util.js'

const baseRate = (partial: Partial<RateMasterLike> & { id: string; code: string }): RateMasterLike => ({
  id: partial.id,
  code: partial.code,
  gstGroupId: partial.gstGroupId ?? 'g1',
  gstGroupCode: partial.gstGroupCode ?? 'GST18',
  dateFrom: partial.dateFrom ?? '2024-04-01',
  dateTo: partial.dateTo ?? null,
  cgst: partial.cgst ?? 9,
  sgst: partial.sgst ?? 9,
  igst: partial.igst ?? 18,
  applicableFor: partial.applicableFor ?? 'BOTH',
  status: partial.status ?? 'ACTIVE',
})

describe('isRateActiveAsOf', () => {
  it('honours open-ended and closed ranges', () => {
    expect(isRateActiveAsOf(baseRate({ id: '1', code: 'A', dateTo: null }), '2026-07-01')).toBe(true)
    expect(
      isRateActiveAsOf(baseRate({ id: '1', code: 'A', dateFrom: '2026-04-01', dateTo: '2026-06-30' }), '2026-07-01'),
    ).toBe(false)
    expect(isRateActiveAsOf(baseRate({ id: '1', code: 'A', status: 'INACTIVE' }), '2026-07-01')).toBe(false)
  })
})

describe('findRateCoverageGaps', () => {
  it('flags missing SALES/PURCHASE coverage', () => {
    const gaps = findRateCoverageGaps({
      groups: [
        { id: 'g1', code: 'GST18', status: 'ACTIVE' },
        { id: 'g2', code: 'GST5', status: 'ACTIVE' },
      ],
      rates: [
        baseRate({ id: 'r1', code: 'R18', gstGroupId: 'g1', applicableFor: 'SALES' }),
        // no purchase for g1, nothing for g2
      ],
      asOfDate: '2026-07-15',
    })
    expect(gaps.some((g) => g.gstGroupCode === 'GST18' && g.missingFor.includes('PURCHASE'))).toBe(true)
    expect(gaps.some((g) => g.gstGroupCode === 'GST5')).toBe(true)
  })
})

describe('findExpiringRates', () => {
  it('returns critical within 7 days', () => {
    const exp = findExpiringRates({
      rates: [
        baseRate({ id: 'r1', code: 'R1', dateTo: '2026-07-10' }),
        baseRate({ id: 'r2', code: 'R2', dateTo: '2026-08-20' }),
      ],
      asOfDate: '2026-07-05',
      horizonDays: 30,
    })
    expect(exp.find((e) => e.code === 'R1')?.severity).toBe('CRITICAL')
    expect(exp.find((e) => e.code === 'R2')).toBeUndefined()
  })
})

describe('findRateOverlaps', () => {
  it('detects overlapping windows', () => {
    const conflicts = findRateOverlaps([
      baseRate({ id: 'a', code: 'A', dateFrom: '2024-04-01', dateTo: '2026-12-31' }),
      baseRate({ id: 'b', code: 'B', dateFrom: '2026-01-01', dateTo: null }),
    ])
    expect(conflicts.length).toBeGreaterThan(0)
  })
})

describe('evaluateLedgerRateDrift', () => {
  it('flags when ledger CGST differs from master', () => {
    const findings = evaluateLedgerRateDrift({
      samples: [
        {
          documentId: 'd1',
          documentNumber: 'INV-1',
          documentDate: '2026-07-10',
          documentLineId: 'l1',
          gstGroupId: 'g1',
          taxType: 'OUTPUT_CGST',
          taxRate: 6,
          taxAmount: 60,
        },
      ],
      rates: [baseRate({ id: 'r1', code: 'R18', cgst: 9, sgst: 9, igst: 18 })],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.masterRate).toBe(9)
    expect(findings[0]!.severity).toBe('CRITICAL')
  })

  it('is silent within tolerance', () => {
    const findings = evaluateLedgerRateDrift({
      samples: [
        {
          documentId: 'd1',
          documentDate: '2026-07-10',
          gstGroupId: 'g1',
          taxType: 'OUTPUT_CGST',
          taxRate: 9,
          taxAmount: 90,
        },
      ],
      rates: [baseRate({ id: 'r1', code: 'R18' })],
    })
    expect(findings).toHaveLength(0)
  })
})

describe('scoreRateOpsHealth', () => {
  it('blocks on gaps / critical drift', () => {
    expect(scoreRateOpsHealth({ gapCount: 1, expiringCount: 0, overlapCount: 0, driftCount: 0, criticalDriftCount: 0 }).overall).toBe(
      'BLOCKED',
    )
    expect(
      scoreRateOpsHealth({ gapCount: 0, expiringCount: 2, overlapCount: 0, driftCount: 1, criticalDriftCount: 0 }).overall,
    ).toBe('NEEDS_ATTENTION')
    expect(
      scoreRateOpsHealth({ gapCount: 0, expiringCount: 0, overlapCount: 0, driftCount: 0, criticalDriftCount: 0 }).overall,
    ).toBe('HEALTHY')
  })
})

describe('buildRateChangeImpact', () => {
  it('rolls up by group', () => {
    const rows = buildRateChangeImpact([
      {
        documentId: 'd1',
        documentDate: '2026-07-01',
        gstGroupId: 'g1',
        taxType: 'OUTPUT_CGST',
        taxRate: 9,
        taxAmount: 10,
      },
      {
        documentId: 'd1',
        documentDate: '2026-07-01',
        gstGroupId: 'g1',
        taxType: 'OUTPUT_SGST',
        taxRate: 9,
        taxAmount: 10,
      },
    ])
    expect(rows[0]!.documentCount).toBe(1)
    expect(rows[0]!.lineCount).toBe(2)
    expect(rows[0]!.totalTaxAmount).toBe(20)
  })
})

describe('capability honesty', () => {
  it('never claims full compliance or portal', () => {
    const m = buildPhase16CapabilityMatrix()
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.capabilities.some((c) => c.id === 'portal_filing' && c.status === 'NOT_IN_SCOPE')).toBe(true)
    expect(isPhase16RateOpsEnabled({ GST_PHASE16_RATE_OPS_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false)
  })
})
