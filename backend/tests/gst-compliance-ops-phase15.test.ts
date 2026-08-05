/**
 * Phase 15 — compliance ops pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  buildAuditPackManifest,
  buildGstr9AnnualSkeleton,
  buildPhase15CapabilityMatrix,
  evaluateNoticeDue,
  indianFyPeriods,
  isPhase15ComplianceOpsEnabled,
  listReturnPeriodsInclusive,
  scorePeriodHealth,
  summarizeMultiPeriodHealth,
} from '../src/modules/accounting/tax-compliance/gst-compliance-ops.util.js'

describe('Phase 15 — periods & FY', () => {
  it('lists inclusive return periods', () => {
    expect(listReturnPeriodsInclusive('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('builds Indian FY months April–March', () => {
    const m = indianFyPeriods('2025-26')
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('2025-04')
    expect(m[11]).toBe('2026-03')
  })
})

describe('Phase 15 — period health scoring', () => {
  it('flags overdue notices as BLOCKED', () => {
    const h = scorePeriodHealth({
      returnPeriod: '2026-04',
      ledgerOutwardDocs: 2,
      ledgerInwardDocs: 1,
      gstr1Status: 'LOCKED',
      gstr3bStatus: 'LOCKED',
      noticeOverdueCount: 1,
    })
    expect(h.grade).toBe('BLOCKED')
    expect(h.issues.some((i) => i.code === 'NOTICE_OVERDUE')).toBe(true)
  })

  it('summarizes multi-period grades', () => {
    const a = scorePeriodHealth({
      returnPeriod: '2026-01',
      ledgerOutwardDocs: 1,
      ledgerInwardDocs: 0,
      gstr1Status: 'MARKED_FILED_EXTERNAL',
      gstr3bStatus: 'MARKED_FILED_EXTERNAL',
    })
    const b = scorePeriodHealth({
      returnPeriod: '2026-02',
      ledgerOutwardDocs: 1,
      ledgerInwardDocs: 0,
      gstr1Status: 'DRAFT',
      gstr3bStatus: 'OPEN',
    })
    const s = summarizeMultiPeriodHealth([a, b])
    expect(s.notFullGstCompliant).toBe(true)
    expect(s.verdict).toBe('READY_WITH_CONDITIONS')
    expect(s.atRiskCount + s.blockedCount + s.healthyCount).toBeGreaterThan(0)
  })
})

describe('Phase 15 — audit pack & notices & GSTR-9 foundation', () => {
  it('builds audit pack manifest without claiming portal or full compliance', () => {
    const m = buildAuditPackManifest({
      periodFrom: '2026-01',
      periodTo: '2026-03',
      sectionCounts: { gstr1_prep: 2, ledger_outward: 10, notices: 1 },
    })
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.notPortalFiling).toBe(true)
    expect(m.sections.find((s) => s.id === 'gstr1_prep')?.status).toBe('INCLUDED')
  })

  it('evaluates notice due statuses', () => {
    expect(evaluateNoticeDue({ dueDate: '2020-01-01', status: 'OPEN', asOf: '2026-08-05' }).isOverdue).toBe(
      true,
    )
    expect(evaluateNoticeDue({ dueDate: '2030-01-01', status: 'CLOSED' }).statusSuggested).toBe('CLOSED')
  })

  it('builds GSTR-9 annual foundation skeleton', () => {
    const sk = buildGstr9AnnualSkeleton({
      financialYearLabel: '2025-26',
      monthly: [
        {
          returnPeriod: '2025-04',
          gstr1Status: 'LOCKED',
          gstr3bStatus: 'LOCKED',
          outwardTaxable: 1000,
          outwardTax: 180,
        },
      ],
    })
    expect(sk.monthsExpected).toHaveLength(12)
    expect(sk.notGstr9c).toBe(true)
    expect(sk.notPortalFile).toBe(true)
    expect(sk.notFullGstCompliant).toBe(true)
    expect(sk.coveragePct).toBeLessThan(100)
  })

  it('capability matrix never claims full GST compliance', () => {
    const m = buildPhase15CapabilityMatrix()
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.capabilities.some((c) => c.id === 'portal_live' && c.status === 'NOT_IN_SCOPE')).toBe(true)
    expect(isPhase15ComplianceOpsEnabled({ GST_PHASE15_COMPLIANCE_OPS_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(
      true,
    )
    expect(isPhase15ComplianceOpsEnabled({ GST_PHASE15_COMPLIANCE_OPS_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(
      false,
    )
  })
})
