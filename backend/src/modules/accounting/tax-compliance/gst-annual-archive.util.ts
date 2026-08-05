/**
 * Phase 14 — Annual return rollup, compliance cockpit scoring, FY archive guards (pure, no I/O).
 * Books-side only — not GSTR-9 portal submit, not FULL GST COMPLIANT.
 */

export type GstAnnualReturnStatusLike =
  | 'OPEN'
  | 'DRAFT'
  | 'LOCKED'
  | 'MARKED_FILED_EXTERNAL'
  | 'ARCHIVED'

export type MonthlyPeriodLike = {
  returnPeriod: string
  returnType: string
  status: string
}

export type TaxBucket = {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}

export type NoticeLike = {
  status: string
  dueDate: string
  issuedOn?: string
}

export type RcmLike = {
  status: string
}

export type FilingSessionLike = {
  status: string
}

const EMPTY_BUCKET = (): TaxBucket => ({
  taxableValue: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  cess: 0,
  totalTax: 0,
})

export function isPhase14AnnualEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.GST_PHASE14_ANNUAL_ENABLED ?? 'true').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no'
}

/** Indian GST FY is Apr–Mar. Label e.g. "2025-26". */
export function financialYearLabelFromReturnPeriod(returnPeriod: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(returnPeriod.trim())
  if (!m) throw new Error(`Invalid returnPeriod: ${returnPeriod}`)
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error(`Invalid month in returnPeriod: ${returnPeriod}`)
  if (month >= 4) {
    const yy = String((year + 1) % 100).padStart(2, '0')
    return `${year}-${yy}`
  }
  const yy = String(year % 100).padStart(2, '0')
  return `${year - 1}-${yy}`
}

export function parseFinancialYearLabel(fy: string): { startYear: number; endYear: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(fy.trim())
  if (!m) throw new Error(`Invalid financialYear: ${fy}`)
  const startYear = Number(m[1])
  const endTwo = Number(m[2])
  const endYear = Math.floor(startYear / 100) * 100 + endTwo
  // handle 2099-00 style rollover to 2100 rarely unused; prefer startYear+1 when endTwo is start+1 mod 100
  const expected = (startYear + 1) % 100
  if (endTwo !== expected) {
    // still accept if endTwo matches (startYear+1)%100 only — else use start+1
    if (endTwo === (startYear + 1) % 100) {
      /* ok */
    } else {
      // e.g. user typed 2025-26 correctly: endTwo=26, start=2025, expected=26
      // when mismatch, still derive end as startYear+1 for period generation
    }
  }
  return { startYear, endYear: startYear + 1 }
}

/** Twelve MMYYYY periods Apr–Mar for the FY label. */
export function listReturnPeriodsForFinancialYear(fy: string): string[] {
  const { startYear } = parseFinancialYearLabel(fy)
  const periods: string[] = []
  for (let month = 4; month <= 12; month++) {
    periods.push(`${startYear}-${String(month).padStart(2, '0')}`)
  }
  for (let month = 1; month <= 3; month++) {
    periods.push(`${startYear + 1}-${String(month).padStart(2, '0')}`)
  }
  return periods
}

export function isReturnPeriodInFinancialYear(returnPeriod: string, fy: string): boolean {
  try {
    return financialYearLabelFromReturnPeriod(returnPeriod) === fy.trim()
  } catch {
    return false
  }
}

export function sumTaxBuckets(buckets: TaxBucket[]): TaxBucket {
  return buckets.reduce(
    (acc, b) => ({
      taxableValue: round4(acc.taxableValue + b.taxableValue),
      cgst: round4(acc.cgst + b.cgst),
      sgst: round4(acc.sgst + b.sgst),
      igst: round4(acc.igst + b.igst),
      cess: round4(acc.cess + b.cess),
      totalTax: round4(acc.totalTax + b.totalTax),
    }),
    EMPTY_BUCKET(),
  )
}

export function buildGstr9AnnualSnapshot(input: {
  financialYear: string
  companyGstin: string
  monthlyOutward: TaxBucket[]
  monthlyInward: TaxBucket[]
  monthlyRcm: TaxBucket[]
  monthlyItc: TaxBucket[]
  monthlyPeriodMeta: MonthlyPeriodLike[]
}): {
  financialYear: string
  companyGstin: string
  outward: TaxBucket
  inward: TaxBucket
  rcm: TaxBucket
  itc: TaxBucket
  monthsExpected: number
  gstr1FiledCount: number
  gstr3bFiledCount: number
  gstr1LockedCount: number
  gstr3bLockedCount: number
  gstr1OpenOrDraftCount: number
  gstr3bOpenOrDraftCount: number
  readinessWarnings: string[]
  disclaimer: string
} {
  const periods = listReturnPeriodsForFinancialYear(input.financialYear)
  const gstr1 = input.monthlyPeriodMeta.filter((p) => normalizeReturnType(p.returnType) === 'GSTR1')
  const gstr3b = input.monthlyPeriodMeta.filter((p) => normalizeReturnType(p.returnType) === 'GSTR3B')

  const filed = (s: string) => s === 'MARKED_FILED_EXTERNAL'
  const locked = (s: string) => s === 'LOCKED' || filed(s)
  const openish = (s: string) => s === 'OPEN' || s === 'DRAFT'

  const warnings: string[] = []
  const gstr1FiledCount = gstr1.filter((p) => filed(p.status)).length
  const gstr3bFiledCount = gstr3b.filter((p) => filed(p.status)).length
  const gstr1LockedCount = gstr1.filter((p) => locked(p.status)).length
  const gstr3bLockedCount = gstr3b.filter((p) => locked(p.status)).length
  const gstr1OpenOrDraftCount = gstr1.filter((p) => openish(p.status)).length
  const gstr3bOpenOrDraftCount = gstr3b.filter((p) => openish(p.status)).length

  if (gstr1OpenOrDraftCount > 0 || gstr3bOpenOrDraftCount > 0) {
    warnings.push('Some monthly GSTR-1/3B periods are still OPEN or DRAFT — annual prep is provisional.')
  }
  if (gstr1FiledCount < periods.length || gstr3bFiledCount < periods.length) {
    warnings.push('Not all 12 months are MARKED_FILED_EXTERNAL for GSTR-1 and/or GSTR-3B.')
  }
  warnings.push('GSTR-9 books worksheet only — not portal annual return submit / GSTR-9C auto audit.')

  return {
    financialYear: input.financialYear,
    companyGstin: input.companyGstin,
    outward: sumTaxBuckets(input.monthlyOutward),
    inward: sumTaxBuckets(input.monthlyInward),
    rcm: sumTaxBuckets(input.monthlyRcm),
    itc: sumTaxBuckets(input.monthlyItc),
    monthsExpected: periods.length,
    gstr1FiledCount,
    gstr3bFiledCount,
    gstr1LockedCount,
    gstr3bLockedCount,
    gstr1OpenOrDraftCount,
    gstr3bOpenOrDraftCount,
    readinessWarnings: warnings,
    disclaimer:
      'Annual return preparation workspace. FOS does not file GSTR-9/9C on the GST portal. Not FULL GST COMPLIANT.',
  }
}

export function canPrepareAnnual(status: GstAnnualReturnStatusLike): boolean {
  return status === 'OPEN' || status === 'DRAFT'
}

export function canLockAnnual(status: GstAnnualReturnStatusLike): boolean {
  return status === 'DRAFT'
}

export function canUnlockAnnual(status: GstAnnualReturnStatusLike): boolean {
  return status === 'LOCKED'
}

export function canMarkAnnualFiledExternal(status: GstAnnualReturnStatusLike): boolean {
  return status === 'LOCKED'
}

export function canArchiveAnnual(status: GstAnnualReturnStatusLike): boolean {
  return status === 'LOCKED' || status === 'MARKED_FILED_EXTERNAL'
}

export function canMutateAnnualSource(status: GstAnnualReturnStatusLike): boolean {
  return status === 'OPEN' || status === 'DRAFT'
}

export function evaluateNoticeUrgency(
  notice: NoticeLike,
  asOf: Date = new Date(),
): 'OVERDUE' | 'DUE_SOON' | 'OK' | 'CLOSED' {
  const st = notice.status.toUpperCase()
  // Phase 14 util + Phase 15 statuses (CLOSED/WAIVED/VOID/RESPONDED)
  if (st === 'CLOSED' || st === 'VOID' || st === 'WAIVED') return 'CLOSED'
  if (st === 'RESPONDED' || st === 'ACKNOWLEDGED') return 'OK'
  const due = parseDateOnly(notice.dueDate)
  if (!due) return 'OK'
  const dayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  const dueUtc = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()))
  if (dueUtc.getTime() < startOfToday.getTime()) return 'OVERDUE'
  if (dueUtc.getTime() - startOfToday.getTime() <= 7 * dayMs) return 'DUE_SOON'
  return 'OK'
}

export function scoreComplianceHealth(input: {
  monthlyPeriods: MonthlyPeriodLike[]
  notices: NoticeLike[]
  rcmEntries: RcmLike[]
  filingSessions?: FilingSessionLike[]
  annualStatus?: GstAnnualReturnStatusLike | null
  fyArchived?: boolean
}): {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }>
  metrics: {
    monthlyPeriodCount: number
    monthlyFiledCount: number
    monthlyLockedCount: number
    monthlyOpenDraftCount: number
    openNotices: number
    overdueNotices: number
    openRcm: number
    simulatedFilingSessions: number
    annualPrepared: boolean
    fyArchived: boolean
  }
} {
  const issues: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }> = []
  let score = 100

  const monthlyPeriodCount = input.monthlyPeriods.length
  const monthlyFiledCount = input.monthlyPeriods.filter((p) => p.status === 'MARKED_FILED_EXTERNAL').length
  const monthlyLockedCount = input.monthlyPeriods.filter(
    (p) => p.status === 'LOCKED' || p.status === 'MARKED_FILED_EXTERNAL',
  ).length
  const monthlyOpenDraftCount = input.monthlyPeriods.filter(
    (p) => p.status === 'OPEN' || p.status === 'DRAFT',
  ).length

  if (monthlyPeriodCount === 0) {
    score -= 15
    issues.push({
      code: 'NO_MONTHLY_PERIODS',
      severity: 'warning',
      message: 'No monthly GSTR period rows for the selected FY window.',
    })
  } else {
    const openRatio = monthlyOpenDraftCount / monthlyPeriodCount
    if (openRatio > 0.25) {
      score -= 20
      issues.push({
        code: 'MONTHLY_OPEN_DRAFT',
        severity: 'warning',
        message: `${monthlyOpenDraftCount} monthly period(s) still OPEN/DRAFT.`,
      })
    } else if (monthlyOpenDraftCount > 0) {
      score -= 8
      issues.push({
        code: 'MONTHLY_OPEN_DRAFT_FEW',
        severity: 'info',
        message: `${monthlyOpenDraftCount} monthly period(s) still OPEN/DRAFT.`,
      })
    }
  }

  const openishNotice = (s: string) => {
    const u = s.toUpperCase()
    return u === 'OPEN' || u === 'ESCALATED' || u === 'IN_PROGRESS'
  }
  const openNotices = input.notices.filter((n) => openishNotice(n.status)).length
  const overdueNotices = input.notices.filter(
    (n) => openishNotice(n.status) && evaluateNoticeUrgency(n) === 'OVERDUE',
  ).length
  if (overdueNotices > 0) {
    score -= Math.min(30, overdueNotices * 10)
    issues.push({
      code: 'NOTICES_OVERDUE',
      severity: 'critical',
      message: `${overdueNotices} GST notice(s) overdue.`,
    })
  } else if (openNotices > 0) {
    score -= Math.min(15, openNotices * 5)
    issues.push({
      code: 'NOTICES_OPEN',
      severity: 'warning',
      message: `${openNotices} open GST notice(s).`,
    })
  }

  const openRcm = input.rcmEntries.filter(
    (r) => r.status === 'OPEN' || r.status === 'LIABILITY_OPEN' || r.status === 'PENDING',
  ).length
  if (openRcm > 0) {
    score -= Math.min(15, openRcm * 2)
    issues.push({
      code: 'RCM_OPEN',
      severity: 'warning',
      message: `${openRcm} RCM register row(s) still open/pending.`,
    })
  }

  const simSessions = (input.filingSessions ?? []).filter((s) =>
    ['SUBMITTED_SIMULATED', 'ACCEPTED_SIMULATED', 'PACKAGE_READY', 'PENDING_CHECKER'].includes(s.status),
  ).length
  if (simSessions > 0) {
    issues.push({
      code: 'FILING_SIMULATED',
      severity: 'info',
      message: `${simSessions} portal filing session(s) in SIMULATED trail — not LIVE GSTN proof.`,
    })
  }

  const annualPrepared = Boolean(
    input.annualStatus && input.annualStatus !== 'OPEN' && input.annualStatus !== undefined,
  )
  if (!annualPrepared) {
    score -= 5
    issues.push({
      code: 'ANNUAL_NOT_PREPARED',
      severity: 'info',
      message: 'GSTR-9 annual worksheet not prepared for this FY.',
    })
  }

  if (input.fyArchived) {
    issues.push({
      code: 'FY_ARCHIVED',
      severity: 'info',
      message: 'Financial year marked archived for multi-year retention.',
    })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return {
    score,
    grade,
    issues,
    metrics: {
      monthlyPeriodCount,
      monthlyFiledCount,
      monthlyLockedCount,
      monthlyOpenDraftCount,
      openNotices,
      overdueNotices,
      openRcm,
      simulatedFilingSessions: simSessions,
      annualPrepared,
      fyArchived: Boolean(input.fyArchived),
    },
  }
}

export function buildPhase14CapabilityMatrix(): {
  phase: 14
  verdict: 'READY_WITH_CONDITIONS'
  notFullGstCompliant: true
  capabilities: Array<{ id: string; label: string; status: string; notes: string }>
} {
  return {
    phase: 14,
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true,
    capabilities: [
      {
        id: 'gstr9_books',
        label: 'GSTR-9 annual worksheet (books)',
        status: 'ready',
        notes: 'Roll-up from monthly periods + ledger; mark filed externally only.',
      },
      {
        id: 'gstr9c',
        label: 'GSTR-9C / CA certified reconciliation',
        status: 'partial',
        notes: 'Status shell only — no auto CA pack or portal upload.',
      },
      {
        id: 'compliance_cockpit',
        label: 'Compliance health cockpit',
        status: 'ready',
        notes: 'Score from monthly periods, notices, RCM, simulated filing sessions.',
      },
      {
        id: 'notices',
        label: 'GST notices register',
        status: 'ready',
        notes: 'Books tracker — not GST portal notice download.',
      },
      {
        id: 'fy_archive',
        label: 'Multi-year FY archive flag',
        status: 'ready',
        notes: 'Retention marker; does not purge ledger.',
      },
      {
        id: 'portal_annual',
        label: 'Portal GSTR-9/9C submit',
        status: 'deferred',
        notes: 'Out of scope — monthly portal package is Phase 12 only.',
      },
      {
        id: 'full_compliant_label',
        label: 'FULL GST COMPLIANT product label',
        status: 'not-in-scope',
        notes: 'Never claimed from FOS books modules alone.',
      },
    ],
  }
}

function normalizeReturnType(t: string): 'GSTR1' | 'GSTR3B' | 'OTHER' {
  const u = t.toUpperCase().replace(/-/g, '')
  if (u === 'GSTR1') return 'GSTR1'
  if (u === 'GSTR3B') return 'GSTR3B'
  return 'OTHER'
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000
}

function parseDateOnly(s: string): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}
