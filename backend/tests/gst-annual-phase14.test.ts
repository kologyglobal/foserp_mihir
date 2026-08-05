/**
 * Phase 14 — GST annual worksheet / cockpit / FY archive pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  buildGstr9AnnualSnapshot,
  buildPhase14CapabilityMatrix,
  canArchiveAnnual,
  canLockAnnual,
  canMarkAnnualFiledExternal,
  canPrepareAnnual,
  evaluateNoticeUrgency,
  financialYearLabelFromReturnPeriod,
  isPhase14AnnualEnabled,
  listReturnPeriodsForFinancialYear,
  scoreComplianceHealth,
  sumTaxBuckets,
} from '../src/modules/accounting/tax-compliance/gst-annual-archive.util.js'

describe('financial year helpers', () => {
  it('maps Apr–Mar periods into FY labels', () => {
    expect(financialYearLabelFromReturnPeriod('2025-04')).toBe('2025-26')
    expect(financialYearLabelFromReturnPeriod('2025-12')).toBe('2025-26')
    expect(financialYearLabelFromReturnPeriod('2026-01')).toBe('2025-26')
    expect(financialYearLabelFromReturnPeriod('2026-03')).toBe('2025-26')
    expect(financialYearLabelFromReturnPeriod('2026-04')).toBe('2026-27')
  })

  it('lists 12 return periods for a FY', () => {
    const periods = listReturnPeriodsForFinancialYear('2025-26')
    expect(periods).toHaveLength(12)
    expect(periods[0]).toBe('2025-04')
    expect(periods[11]).toBe('2026-03')
  })
})

describe('annual lifecycle gates', () => {
  it('prepare/lock/file/archive transitions', () => {
    expect(canPrepareAnnual('OPEN')).toBe(true)
    expect(canPrepareAnnual('DRAFT')).toBe(true)
    expect(canPrepareAnnual('LOCKED')).toBe(false)
    expect(canLockAnnual('DRAFT')).toBe(true)
    expect(canMarkAnnualFiledExternal('LOCKED')).toBe(true)
    expect(canArchiveAnnual('LOCKED')).toBe(true)
    expect(canArchiveAnnual('MARKED_FILED_EXTERNAL')).toBe(true)
    expect(canArchiveAnnual('DRAFT')).toBe(false)
  })
})

describe('buildGstr9AnnualSnapshot', () => {
  it('rolls buckets and warns on incomplete monthly filing', () => {
    const snap = buildGstr9AnnualSnapshot({
      financialYear: '2025-26',
      companyGstin: '27AAAAA0000A1Z5',
      monthlyOutward: [{ taxableValue: 100, cgst: 9, sgst: 9, igst: 0, cess: 0, totalTax: 18 }],
      monthlyInward: [{ taxableValue: 50, cgst: 4.5, sgst: 4.5, igst: 0, cess: 0, totalTax: 9 }],
      monthlyRcm: [sumTaxBuckets([])],
      monthlyItc: [{ taxableValue: 50, cgst: 4.5, sgst: 4.5, igst: 0, cess: 0, totalTax: 9 }],
      monthlyPeriodMeta: [
        { returnPeriod: '2025-04', returnType: 'GSTR1', status: 'OPEN' },
        { returnPeriod: '2025-04', returnType: 'GSTR3B', status: 'DRAFT' },
      ],
    })
    expect(snap.outward.totalTax).toBe(18)
    expect(snap.gstr1OpenOrDraftCount).toBe(1)
    expect(snap.readinessWarnings.length).toBeGreaterThan(0)
    expect(snap.disclaimer.toLowerCase()).toContain('not full gst compliant')
  })
})

describe('scoreComplianceHealth', () => {
  it('penalises overdue notices and open monthly periods', () => {
    const health = scoreComplianceHealth({
      monthlyPeriods: [
        { returnPeriod: '2025-04', returnType: 'GSTR1', status: 'OPEN' },
        { returnPeriod: '2025-04', returnType: 'GSTR3B', status: 'OPEN' },
      ],
      notices: [{ status: 'OPEN', dueDate: '2020-01-01' }],
      rcmEntries: [{ status: 'OPEN' }],
      filingSessions: [{ status: 'SUBMITTED_SIMULATED' }],
      annualStatus: null,
      fyArchived: false,
    })
    expect(health.metrics.overdueNotices).toBe(1)
    expect(health.score).toBeLessThan(90)
    expect(health.issues.some((i) => i.code === 'NOTICES_OVERDUE')).toBe(true)
    expect(health.issues.some((i) => i.code === 'FILING_SIMULATED')).toBe(true)
  })

  it('scores higher when clean', () => {
    const health = scoreComplianceHealth({
      monthlyPeriods: [
        { returnPeriod: '2025-04', returnType: 'GSTR1', status: 'MARKED_FILED_EXTERNAL' },
        { returnPeriod: '2025-04', returnType: 'GSTR3B', status: 'MARKED_FILED_EXTERNAL' },
      ],
      notices: [],
      rcmEntries: [],
      annualStatus: 'DRAFT',
      fyArchived: false,
    })
    expect(health.score).toBeGreaterThanOrEqual(90)
    expect(health.grade).toBe('A')
  })
})

describe('evaluateNoticeUrgency', () => {
  it('flags overdue and due soon', () => {
    const asOf = new Date(Date.UTC(2026, 7, 5))
    expect(evaluateNoticeUrgency({ status: 'OPEN', dueDate: '2026-07-01' }, asOf)).toBe('OVERDUE')
    expect(evaluateNoticeUrgency({ status: 'IN_PROGRESS', dueDate: '2026-08-08' }, asOf)).toBe('DUE_SOON')
    expect(evaluateNoticeUrgency({ status: 'CLOSED', dueDate: '2026-07-01' }, asOf)).toBe('CLOSED')
  })
})

describe('capability matrix honesty', () => {
  it('never claims full GST compliant', () => {
    const m = buildPhase14CapabilityMatrix()
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.verdict).toBe('READY_WITH_CONDITIONS')
    expect(m.capabilities.some((c) => c.id === 'portal_annual' && c.status === 'deferred')).toBe(true)
  })

  it('feature flag defaults on', () => {
    expect(isPhase14AnnualEnabled({} as NodeJS.ProcessEnv)).toBe(true)
    expect(isPhase14AnnualEnabled({ GST_PHASE14_ANNUAL_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false)
  })
})
