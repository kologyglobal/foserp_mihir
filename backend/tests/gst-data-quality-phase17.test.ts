/**
 * Phase 17 — GST data quality / backfill / freeze checklist pure unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  analyzeLedgerDataQuality,
  buildPeriodFreezeChecklist,
  buildPhase17CapabilityMatrix,
  isPhase17DataQualityEnabled,
  proposeGstinBackfillPlan,
  scoreDataQualityHealth,
} from '../src/modules/accounting/tax-compliance/gst-data-quality.util.js'

const G1 = '27AAAAA0000A1Z5'
const G2 = '29BBBBB0000B1Z5'

describe('isPhase17DataQualityEnabled', () => {
  it('defaults on', () => {
    expect(isPhase17DataQualityEnabled({})).toBe(true)
  })
  it('honours off', () => {
    expect(isPhase17DataQualityEnabled({ GST_PHASE17_DATA_QUALITY_ENABLED: 'false' })).toBe(false)
  })
})

describe('buildPhase17CapabilityMatrix', () => {
  it('never claims full GST compliant', () => {
    const m = buildPhase17CapabilityMatrix()
    expect(m.canClaimFullGstCompliant).toBe(false)
    expect(m.fullGstCompliant).toBe(false)
    expect(m.portalLive).toBe(false)
  })
})

describe('analyzeLedgerDataQuality', () => {
  it('flags null and mixed GSTINs', () => {
    const q = analyzeLedgerDataQuality([
      { id: '1', documentId: 'd1', documentNumber: 'SI-1', companyGstin: null, filingStatus: 'NOT_FILED' },
      { id: '2', documentId: 'd2', documentNumber: 'SI-2', companyGstin: G1, filingStatus: 'FILED' },
      { id: '3', documentId: 'd3', documentNumber: 'SI-3', companyGstin: G2, filingStatus: 'NOT_FILED' },
    ])
    expect(q.nullCompanyGstinCount).toBe(1)
    expect(q.contaminated).toBe(true)
    expect(q.findings.some((f) => f.code === 'NULL_COMPANY_GSTIN')).toBe(true)
    expect(q.findings.some((f) => f.code === 'MULTI_GSTIN_MIX')).toBe(true)
  })

  it('blocks filed with null', () => {
    const q = analyzeLedgerDataQuality([
      { id: '1', documentId: 'd1', documentNumber: 'SI-1', companyGstin: null, filingStatus: 'FILED' },
    ])
    expect(q.filedWithNullGstinCount).toBe(1)
    expect(q.findings.some((f) => f.code === 'FILED_WITH_NULL_GSTIN' && f.severity === 'BLOCKER')).toBe(
      true,
    )
  })
})

describe('proposeGstinBackfillPlan', () => {
  it('skips populated and plans null rows', () => {
    const plan = proposeGstinBackfillPlan(
      [
        { id: 'a', documentId: 'd1', companyGstin: G1 },
        { id: 'b', documentId: 'd2', companyGstin: null, documentNumber: 'INV-2' },
        { id: 'c', documentId: 'd3', companyGstin: null },
      ],
      (row) => {
        if (row.id === 'c') return null
        return { toGstin: G1, source: 'LEGAL_ENTITY', reason: 'LE' }
      },
    )
    expect(plan.alreadyPopulated).toBe(1)
    expect(plan.candidates).toHaveLength(1)
    expect(plan.candidates[0].toGstin).toBe(G1)
    expect(plan.unresolvable).toHaveLength(1)
  })

  it('rejects short GSTIN tokens', () => {
    const plan = proposeGstinBackfillPlan([{ id: 'a', documentId: 'd1', companyGstin: null }], () => ({
      toGstin: '27A',
      source: 'BRANCH',
      reason: 'bad',
    }))
    expect(plan.candidates).toHaveLength(0)
    expect(plan.unresolvable[0].message).toMatch(/15-char/i)
  })
})

describe('scoreDataQualityHealth', () => {
  it('is healthy when clean', () => {
    expect(
      scoreDataQualityHealth({
        nullCompanyGstinCount: 0,
        filedWithNullGstinCount: 0,
        contaminated: false,
        unresolvableBackfill: 0,
      }).overall,
    ).toBe('HEALTHY')
  })
  it('critical when contaminated with nulls', () => {
    expect(
      scoreDataQualityHealth({
        nullCompanyGstinCount: 50,
        filedWithNullGstinCount: 5,
        contaminated: true,
        unresolvableBackfill: 10,
      }).overall,
    ).toBe('CRITICAL')
  })
})

describe('buildPeriodFreezeChecklist', () => {
  it('fails FULL GST claim always; ready false when nulls', () => {
    const quality = analyzeLedgerDataQuality([
      { id: '1', documentId: 'd1', companyGstin: null, filingStatus: 'NOT_FILED' },
    ])
    const cl = buildPeriodFreezeChecklist({
      quality,
      gstr1Status: 'LOCKED',
      gstr3bStatus: 'LOCKED',
      openRcmLiabilityCount: 0,
      backfillCandidateCount: 1,
      unresolvableCount: 0,
    })
    expect(cl.items.find((i) => i.id === 'honest_label')?.status).toBe('FAIL')
    expect(cl.ready).toBe(false)
  })

  it('ready when GSTIN complete and not contaminated', () => {
    const quality = analyzeLedgerDataQuality([
      { id: '1', documentId: 'd1', companyGstin: G1, filingStatus: 'NOT_FILED' },
    ])
    const cl = buildPeriodFreezeChecklist({
      quality,
      gstr1Status: 'LOCKED',
      gstr3bStatus: 'LOCKED',
      openRcmLiabilityCount: 0,
      backfillCandidateCount: 0,
      unresolvableCount: 0,
    })
    expect(cl.ready).toBe(true)
  })
})
