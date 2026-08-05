/**
 * Phase 18 — GST vs GL control recon pure unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  buildPhase18CapabilityMatrix,
  buildReconSummary,
  compareGstToGlBucket,
  glPeriodNet,
  isPhase18GlReconEnabled,
  returnPeriodToDateRange,
  scoreGlReconHealth,
  GST_GL_BUCKETS,
} from '../src/modules/accounting/tax-compliance/gst-gl-recon.util.js'

describe('isPhase18GlReconEnabled', () => {
  it('defaults on', () => {
    expect(isPhase18GlReconEnabled({})).toBe(true)
  })
  it('honours off', () => {
    expect(isPhase18GlReconEnabled({ GST_PHASE18_GL_RECON_ENABLED: 'false' })).toBe(false)
  })
})

describe('returnPeriodToDateRange', () => {
  it('computes month bounds', () => {
    expect(returnPeriodToDateRange('2026-02')).toEqual({ fromDate: '2026-02-01', toDate: '2026-02-28' })
    expect(returnPeriodToDateRange('2024-02')).toEqual({ fromDate: '2024-02-01', toDate: '2024-02-29' })
  })
})

describe('glPeriodNet', () => {
  it('credit net for liabilities', () => {
    expect(glPeriodNet('LIABILITY_CREDIT_NET', 100, 500)).toBe(400)
  })
  it('debit net for assets', () => {
    expect(glPeriodNet('ASSET_DEBIT_NET', 500, 100)).toBe(400)
  })
})

describe('compareGstToGlBucket', () => {
  const bucket = GST_GL_BUCKETS.find((b) => b.taxType === 'OUTPUT_CGST')!

  it('matches within tolerance', () => {
    const line = compareGstToGlBucket({
      bucket,
      gstLedgerAmount: 900,
      glDebit: 0,
      glCredit: 900.5,
      accountId: 'a1',
      accountCode: '220101',
      tolerance: 1,
    })
    expect(line.status).toBe('MATCH')
  })

  it('flags variance', () => {
    const line = compareGstToGlBucket({
      bucket,
      gstLedgerAmount: 900,
      glDebit: 0,
      glCredit: 800,
      accountId: 'a1',
      accountCode: '220101',
      tolerance: 1,
    })
    expect(line.status).toBe('VARIANCE')
    expect(line.variance).toBe(100)
  })

  it('flags unmapped with activity', () => {
    const line = compareGstToGlBucket({
      bucket,
      gstLedgerAmount: 50,
      glDebit: 0,
      glCredit: 0,
      accountId: null,
      tolerance: 1,
    })
    expect(line.status).toBe('UNMAPPED')
  })
})

describe('scoreGlReconHealth + capability', () => {
  it('never claims full compliance', () => {
    const m = buildPhase18CapabilityMatrix()
    expect(m.canClaimFullGstCompliant).toBe(false)
    expect(m.portalLive).toBe(false)
  })

  it('scores critical on many variances', () => {
    const lines = GST_GL_BUCKETS.map((bucket) =>
      compareGstToGlBucket({
        bucket,
        gstLedgerAmount: 1000,
        glDebit: 0,
        glCredit: 0,
        accountId: 'x',
        accountCode: '1',
        tolerance: 0.01,
      }),
    )
    const health = scoreGlReconHealth(lines)
    expect(health.overall).toBe('CRITICAL')
    const summary = buildReconSummary(lines, 0.01)
    expect(summary.fullGstCompliant).toBe(false)
    expect(summary.readyForCloseClaim).toBe(false)
  })
})
