/**
 * Phase 13 — go-live UAT gate + period books readiness pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  buildEmptyUatChecklist,
  buildPhase13ReadinessMatrix,
  evaluateGoLiveGate,
  evaluatePreFileReadiness,
  extractTaxTotalFromSnapshot,
  isPhase13HardeningEnabled,
  reconcilePeriodBooks,
  returnStatusIsLockedOrFiled,
  scorePeriodHealth,
  type PeriodComplianceFacts,
} from '../src/modules/accounting/tax-compliance/gst-compliance-hardening.util.js'

function baseFacts(over: Partial<PeriodComplianceFacts> = {}): PeriodComplianceFacts {
  return {
    returnPeriod: '2026-04',
    companyGstin: '27AAAAA0000A1Z5',
    ledgerRowCount: 10,
    ledgerUnfiledCount: 0,
    ledgerFiledCount: 10,
    ledgerNullCompanyGstinCount: 0,
    booksLiabilityTotal: 1000,
    booksItcTotal: 200,
    booksNetTaxPayable: 800,
    gstr1TotalTax: 1000,
    gstr3bTotalLiability: 1000,
    returns: [
      { returnType: 'GSTR1', status: 'LOCKED', hasSnapshot: true, lockedOrFiled: true },
      { returnType: 'GSTR3B', status: 'LOCKED', hasSnapshot: true, lockedOrFiled: true },
    ],
    payment: {
      activeCount: 1,
      bestStatus: 'PROPOSED',
      netTaxPayable: 800,
      totalPayable: 800,
    },
    openGstr2bFollowUps: 0,
    gstr2bUnmatchedRows: 0,
    openNotices: 0,
    filingSessions: [
      { returnType: 'GSTR1', sessionStatus: null, providerMode: null },
      { returnType: 'GSTR3B', sessionStatus: null, providerMode: null },
    ],
    ...over,
  }
}

describe('isPhase13HardeningEnabled', () => {
  it('defaults true', () => {
    expect(isPhase13HardeningEnabled({})).toBe(true)
  })
  it('respects false', () => {
    expect(isPhase13HardeningEnabled({ GST_PHASE13_HARDENING_ENABLED: 'false' })).toBe(false)
  })
})

describe('reconcilePeriodBooks', () => {
  it('returns PASS for clean locked period', () => {
    const findings = reconcilePeriodBooks(baseFacts())
    const health = scorePeriodHealth(findings)
    expect(health.blockerCount).toBe(0)
    expect(health.notFullGstCompliant).toBe(true)
    expect(findings.some((f) => f.code === 'GSTR1_LOCKED_OR_FILED')).toBe(true)
    expect(findings.some((f) => f.code === 'NOT_FULL_GST_COMPLIANT')).toBe(true)
  })

  it('flags unfiled ledger after lock as BLOCKER', () => {
    const findings = reconcilePeriodBooks(baseFacts({ ledgerUnfiledCount: 3 }))
    const health = scorePeriodHealth(findings)
    expect(health.blockerCount).toBeGreaterThan(0)
    expect(health.overall).toBe('NOT_READY')
    expect(findings.some((f) => f.code === 'UNFILED_LEDGER_AFTER_LOCK')).toBe(true)
  })

  it('warns on GSTR-1 vs 3B tax mismatch', () => {
    const findings = reconcilePeriodBooks(
      baseFacts({ gstr1TotalTax: 1000, gstr3bTotalLiability: 1500 }),
    )
    expect(findings.some((f) => f.code === 'GSTR1_3B_TAX_MISMATCH')).toBe(true)
    expect(scorePeriodHealth(findings).overall).toBe('READY_WITH_WARNINGS')
  })

  it('warns on null company GSTIN rows', () => {
    const findings = reconcilePeriodBooks(baseFacts({ ledgerNullCompanyGstinCount: 2 }))
    expect(findings.some((f) => f.code === 'NULL_COMPANY_GSTIN')).toBe(true)
  })
})

describe('evaluatePreFileReadiness', () => {
  it('allows package when locked and no blockers', () => {
    const facts = baseFacts()
    const health = scorePeriodHealth(reconcilePeriodBooks(facts))
    const pre = evaluatePreFileReadiness(health, facts)
    expect(pre.canCreateFilingPackage).toBe(true)
  })

  it('blocks when GSTR-1 still DRAFT', () => {
    const facts = baseFacts({
      returns: [
        { returnType: 'GSTR1', status: 'DRAFT', hasSnapshot: true, lockedOrFiled: false },
        { returnType: 'GSTR3B', status: 'LOCKED', hasSnapshot: true, lockedOrFiled: true },
      ],
    })
    const health = scorePeriodHealth(reconcilePeriodBooks(facts))
    const pre = evaluatePreFileReadiness(health, facts)
    expect(pre.canCreateFilingPackage).toBe(false)
    expect(pre.reasons.some((r) => r.includes('GSTR-1'))).toBe(true)
  })
})

describe('evaluateGoLiveGate', () => {
  it('never claims full GST compliance even when all axes pass', () => {
    const gate = evaluateGoLiveGate({
      liveIrnTested: true,
      liveEwayTested: true,
      gstrReconTested: true,
      gstr2bReconTested: true,
      paymentTested: true,
      multiGstinTested: true,
      signedAxisIds: [
        'LIVE_IRN',
        'LIVE_EWAY',
        'GSTR_1_3B_RECON',
        'GSTR_2B_RECON',
        'PAYMENT',
        'MULTI_GSTIN',
        'STATUTORY_UAT',
      ],
      env: {},
    })
    expect(gate.canClaimFullGstCompliant).toBe(false)
    expect(gate.notFullGstCompliant).toBe(true)
    expect(gate.axes).toHaveLength(7)
    expect(gate.passedCount).toBe(7)
    expect(gate.filingProviderMode).toBe('SIMULATED')
  })

  it('blocks when axes missing', () => {
    const gate = evaluateGoLiveGate({
      liveIrnTested: false,
      liveEwayTested: false,
      gstrReconTested: false,
      gstr2bReconTested: false,
      paymentTested: false,
      multiGstinTested: false,
      signedAxisIds: [],
      env: {},
    })
    expect(gate.overall).toBe('NOT_READY')
    expect(gate.blockers.length).toBeGreaterThan(0)
  })
})

describe('matrix honesty', () => {
  it('marks full compliance NOT_IN_SCOPE', () => {
    const m = buildPhase13ReadinessMatrix()
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.capabilities.some((c) => c.id === 'full_gst_compliant' && c.status === 'NOT_IN_SCOPE')).toBe(
      true,
    )
    expect(m.capabilities.some((c) => c.id === 'gstr9_worksheet' && c.status === 'DEFERRED')).toBe(true)
  })
})

describe('helpers', () => {
  it('returnStatusIsLockedOrFiled', () => {
    expect(returnStatusIsLockedOrFiled('LOCKED')).toBe(true)
    expect(returnStatusIsLockedOrFiled('MARKED_FILED_EXTERNAL')).toBe(true)
    expect(returnStatusIsLockedOrFiled('DRAFT')).toBe(false)
  })

  it('extractTaxTotalFromSnapshot', () => {
    expect(extractTaxTotalFromSnapshot({ summary: { totalTax: 12.5 } }, 'gstr1')).toBe(12.5)
    expect(extractTaxTotalFromSnapshot({ summary: { totalLiability: 99 } }, 'gstr3b')).toBe(99)
    expect(extractTaxTotalFromSnapshot(null, 'gstr1')).toBeNull()
  })

  it('buildEmptyUatChecklist has 7 axes', () => {
    expect(Object.keys(buildEmptyUatChecklist())).toHaveLength(7)
  })
})
