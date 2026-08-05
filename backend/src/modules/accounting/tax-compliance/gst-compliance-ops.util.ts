/**
 * Phase 15 — GST compliance cockpit, multi-period health, audit pack, GSTR-9 foundation.
 * Pure helpers — no I/O. Reuses Phase 5/8 status vocabulary; never invents portal LIVE claims.
 */

export type PeriodHealthGrade = 'HEALTHY' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN'

export type PeriodHealthInput = {
  returnPeriod: string
  companyGstin?: string | null
  gstr1Status?: string | null
  gstr3bStatus?: string | null
  paymentStatus?: string | null
  ledgerOutwardDocs: number
  ledgerInwardDocs: number
  openRcmCount?: number
  open2bMismatchCount?: number
  openIrnExceptionCount?: number
  openEwayExceptionCount?: number
  noticeOverdueCount?: number
  hasLockedGstr1?: boolean
  hasLockedGstr3b?: boolean
}

export type PeriodHealthIssue = {
  code: string
  severity: 'INFO' | 'WARN' | 'BLOCKER'
  message: string
}

export type PeriodHealthResult = {
  returnPeriod: string
  companyGstin: string | null
  score: number
  grade: PeriodHealthGrade
  issues: PeriodHealthIssue[]
  checklist: Array<{ id: string; label: string; ok: boolean; detail?: string }>
  readinessLabel: 'GST_COMPLIANCE_OPS'
  disclaimer: string
}

export type MultiPeriodHealthSummary = {
  periods: PeriodHealthResult[]
  overallGrade: PeriodHealthGrade
  averageScore: number
  blockedCount: number
  atRiskCount: number
  healthyCount: number
  verdict: 'READY_WITH_CONDITIONS'
  notFullGstCompliant: true
  disclaimer: string
}

export type AuditPackSection = {
  id: string
  title: string
  status: 'INCLUDED' | 'EMPTY' | 'NOT_AVAILABLE'
  itemCount: number
  notes: string
}

export type AuditPackManifest = {
  version: number
  generatedLabel: string
  periodFrom: string
  periodTo: string
  companyGstin: string | null
  sections: AuditPackSection[]
  healthSnapshot: MultiPeriodHealthSummary | null
  notFullGstCompliant: true
  notPortalFiling: true
  disclaimer: string
}

export type Gstr9MonthlySlice = {
  returnPeriod: string
  gstr1Status?: string | null
  gstr3bStatus?: string | null
  outwardTaxable?: number
  outwardTax?: number
  inwardTaxable?: number
  itcTotal?: number
  netLiability?: number
}

export type Gstr9AnnualSkeleton = {
  financialYearLabel: string
  monthsExpected: string[]
  monthsPresent: string[]
  coveragePct: number
  totals: {
    outwardTaxable: number
    outwardTax: number
    inwardTaxable: number
    itcTotal: number
    netLiability: number
  }
  monthly: Gstr9MonthlySlice[]
  openIssues: string[]
  readinessLabel: 'GSTR9_ANNUAL_FOUNDATION'
  notFullGstCompliant: true
  notGstr9c: true
  notPortalFile: true
  disclaimer: string
}

export type NoticeDueEval = {
  statusSuggested: 'OPEN' | 'OVERDUE' | 'DUE_SOON' | 'CLOSED'
  daysUntilDue: number | null
  isOverdue: boolean
}

const DISCLAIMER =
  'Books-side compliance ops only. Not LIVE GST portal integration, not GSTR-9/9C file, and not FULL GST COMPLIANT.'

export function isPhase15ComplianceOpsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.GST_PHASE15_COMPLIANCE_OPS_ENABLED ?? 'true').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no'
}

/** Indian financial year April–March periods for a label like 2025-26 or FY2025-26. */
export function indianFyPeriods(financialYearLabel: string): string[] {
  const m = financialYearLabel.trim().toUpperCase().match(/(\d{4})\s*[-–/]\s*(\d{2,4})/)
  if (!m) {
    throw new Error(`Invalid Indian FY label: ${financialYearLabel}`)
  }
  const startYear = Number(m[1])
  const endPart = m[2]
  const endYear = endPart.length === 2 ? 2000 + Number(endPart) : Number(endPart)
  if (endYear !== startYear + 1) {
    throw new Error(`FY end year must be start+1: ${financialYearLabel}`)
  }
  const months: string[] = []
  for (let mo = 4; mo <= 12; mo += 1) {
    months.push(`${startYear}-${String(mo).padStart(2, '0')}`)
  }
  for (let mo = 1; mo <= 3; mo += 1) {
    months.push(`${endYear}-${String(mo).padStart(2, '0')}`)
  }
  return months
}

export function compareReturnPeriods(a: string, b: string): number {
  return a.localeCompare(b)
}

export function listReturnPeriodsInclusive(from: string, to: string): string[] {
  if (compareReturnPeriods(from, to) > 0) throw new Error('periodFrom must be <= periodTo')
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ey, em] = to.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function filedLike(status?: string | null): boolean {
  if (!status) return false
  const u = status.toUpperCase()
  return (
    u === 'MARKED_FILED_EXTERNAL' ||
    u === 'MARKED_FILED' ||
    u === 'ACCEPTED_SIMULATED' ||
    u === 'FILED' ||
    u === 'CLOSED'
  )
}

function lockedLike(status?: string | null): boolean {
  if (!status) return false
  const u = status.toUpperCase()
  return u === 'LOCKED' || filedLike(status)
}

function openPayment(status?: string | null): boolean {
  if (!status) return false
  const u = status.toUpperCase()
  return u === 'DRAFT' || u === 'PROPOSED' || u === 'CONFIRMED_EXTERNAL' || u === 'POSTED_GL'
}

export function scorePeriodHealth(input: PeriodHealthInput): PeriodHealthResult {
  const issues: PeriodHealthIssue[] = []
  let score = 100

  const gstr1Ok = lockedLike(input.gstr1Status) || filedLike(input.gstr1Status)
  const gstr3bOk = lockedLike(input.gstr3bStatus) || filedLike(input.gstr3bStatus)
  const paymentClosed = filedLike(input.paymentStatus) || input.paymentStatus?.toUpperCase() === 'CLOSED'

  if ((input.ledgerOutwardDocs > 0 || input.ledgerInwardDocs > 0) && !input.gstr1Status) {
    issues.push({
      code: 'GSTR1_NOT_STARTED',
      severity: 'WARN',
      message: 'GSTR-1 preparation not started for a period with ledger activity',
    })
    score -= 15
  } else if (input.gstr1Status && !gstr1Ok) {
    issues.push({
      code: 'GSTR1_OPEN',
      severity: 'WARN',
      message: `GSTR-1 status is ${input.gstr1Status} (not locked/filed)`,
    })
    score -= 10
  }

  if ((input.ledgerOutwardDocs > 0 || input.ledgerInwardDocs > 0) && !input.gstr3bStatus) {
    issues.push({
      code: 'GSTR3B_NOT_STARTED',
      severity: 'WARN',
      message: 'GSTR-3B preparation not started for a period with ledger activity',
    })
    score -= 15
  } else if (input.gstr3bStatus && !gstr3bOk) {
    issues.push({
      code: 'GSTR3B_OPEN',
      severity: 'WARN',
      message: `GSTR-3B status is ${input.gstr3bStatus} (not locked/filed)`,
    })
    score -= 10
  }

  if (openPayment(input.paymentStatus) && !paymentClosed) {
    issues.push({
      code: 'PAYMENT_OPEN',
      severity: 'WARN',
      message: `Payment challan status ${input.paymentStatus} — books liability not closed`,
    })
    score -= 8
  }

  const openRcm = input.openRcmCount ?? 0
  if (openRcm > 0) {
    issues.push({
      code: 'RCM_OPEN',
      severity: 'WARN',
      message: `${openRcm} RCM liability row(s) not paid / ITC pending`,
    })
    score -= Math.min(15, openRcm * 3)
  }

  const mismatch = input.open2bMismatchCount ?? 0
  if (mismatch > 0) {
    issues.push({
      code: 'GSTR2B_MISMATCH',
      severity: 'WARN',
      message: `${mismatch} GSTR-2B recon mismatch/open item(s)`,
    })
    score -= Math.min(20, mismatch * 2)
  }

  const irnEx = input.openIrnExceptionCount ?? 0
  if (irnEx > 0) {
    issues.push({
      code: 'EINVOICE_EXCEPTION',
      severity: 'WARN',
      message: `${irnEx} open e-invoice exception(s)`,
    })
    score -= Math.min(12, irnEx * 2)
  }

  const ewayEx = input.openEwayExceptionCount ?? 0
  if (ewayEx > 0) {
    issues.push({
      code: 'EWAY_EXCEPTION',
      severity: 'WARN',
      message: `${ewayEx} open e-way exception(s)`,
    })
    score -= Math.min(12, ewayEx * 2)
  }

  const noticeOd = input.noticeOverdueCount ?? 0
  if (noticeOd > 0) {
    issues.push({
      code: 'NOTICE_OVERDUE',
      severity: 'BLOCKER',
      message: `${noticeOd} overdue compliance notice(s)`,
    })
    score -= Math.min(25, noticeOd * 10)
  }

  if (input.ledgerOutwardDocs === 0 && input.ledgerInwardDocs === 0 && !input.gstr1Status && !input.gstr3bStatus) {
    issues.push({
      code: 'NO_ACTIVITY',
      severity: 'INFO',
      message: 'No GST ledger activity and no return prep for this period',
    })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let grade: PeriodHealthGrade = 'HEALTHY'
  if (issues.some((i) => i.severity === 'BLOCKER') || score < 40) grade = 'BLOCKED'
  else if (score < 75 || issues.some((i) => i.severity === 'WARN')) grade = 'AT_RISK'
  else if (score === 100 && input.ledgerOutwardDocs + input.ledgerInwardDocs === 0 && !input.gstr1Status) {
    grade = 'UNKNOWN'
  }

  const checklist = [
    {
      id: 'ledger',
      label: 'GST ledger activity present',
      ok: input.ledgerOutwardDocs + input.ledgerInwardDocs > 0,
      detail: `outward docs ${input.ledgerOutwardDocs}, inward docs ${input.ledgerInwardDocs}`,
    },
    {
      id: 'gstr1',
      label: 'GSTR-1 locked or marked filed',
      ok: gstr1Ok,
      detail: input.gstr1Status ?? 'not started',
    },
    {
      id: 'gstr3b',
      label: 'GSTR-3B locked or marked filed',
      ok: gstr3bOk,
      detail: input.gstr3bStatus ?? 'not started',
    },
    {
      id: 'payment',
      label: 'Payment closed or not required',
      ok: !input.paymentStatus || paymentClosed,
      detail: input.paymentStatus ?? 'no challan',
    },
    {
      id: 'rcm',
      label: 'No open RCM liabilities',
      ok: openRcm === 0,
      detail: `${openRcm} open`,
    },
    {
      id: 'notices',
      label: 'No overdue notices',
      ok: noticeOd === 0,
      detail: `${noticeOd} overdue`,
    },
  ]

  return {
    returnPeriod: input.returnPeriod,
    companyGstin: input.companyGstin ?? null,
    score,
    grade,
    issues,
    checklist,
    readinessLabel: 'GST_COMPLIANCE_OPS',
    disclaimer: DISCLAIMER,
  }
}

export function summarizeMultiPeriodHealth(periods: PeriodHealthResult[]): MultiPeriodHealthSummary {
  const healthyCount = periods.filter((p) => p.grade === 'HEALTHY').length
  const atRiskCount = periods.filter((p) => p.grade === 'AT_RISK').length
  const blockedCount = periods.filter((p) => p.grade === 'BLOCKED').length
  const averageScore =
    periods.length === 0 ? 0 : Math.round(periods.reduce((s, p) => s + p.score, 0) / periods.length)

  let overallGrade: PeriodHealthGrade = 'HEALTHY'
  if (blockedCount > 0) overallGrade = 'BLOCKED'
  else if (atRiskCount > 0 || averageScore < 75) overallGrade = 'AT_RISK'
  else if (periods.every((p) => p.grade === 'UNKNOWN')) overallGrade = 'UNKNOWN'

  return {
    periods,
    overallGrade,
    averageScore,
    blockedCount,
    atRiskCount,
    healthyCount,
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true,
    disclaimer: DISCLAIMER,
  }
}

export function buildAuditPackManifest(input: {
  periodFrom: string
  periodTo: string
  companyGstin?: string | null
  sectionCounts: Record<string, number>
  healthSnapshot?: MultiPeriodHealthSummary | null
}): AuditPackManifest {
  const defs: Array<{ id: string; title: string; notes: string }> = [
    { id: 'gstr1_prep', title: 'GSTR-1 period prep snapshots', notes: 'Phase 5 freeze only — not portal package' },
    { id: 'gstr3b_prep', title: 'GSTR-3B period prep snapshots', notes: 'Phase 5 freeze only — not portal package' },
    { id: 'ledger_outward', title: 'GST ledger outward stamps', notes: 'Posted document tax snapshots' },
    { id: 'ledger_inward', title: 'GST ledger inward stamps', notes: 'Posted document tax snapshots' },
    { id: 'gstr2b_batches', title: 'GSTR-2B import batches', notes: 'Offline import evidence' },
    { id: 'rcm_register', title: 'RCM register', notes: 'Books liability lifecycle' },
    { id: 'payment_challans', title: 'PMT-06 style challans', notes: 'Books payment trail — not portal CPIN' },
    { id: 'export_lut', title: 'Export / SEZ / LUT', notes: 'Phase 10 books classification' },
    { id: 'specials', title: 'Specials / advances / GST TDS-TCS', notes: 'Phase 11 books registers' },
    { id: 'notices', title: 'Compliance notices log', notes: 'Internal correspondence tracker' },
    { id: 'period_health', title: 'Multi-period health scores', notes: 'Phase 15 cockpit' },
  ]

  const sections: AuditPackSection[] = defs.map((d) => {
    const count = input.sectionCounts[d.id] ?? 0
    return {
      id: d.id,
      title: d.title,
      status: count > 0 ? 'INCLUDED' : 'EMPTY',
      itemCount: count,
      notes: d.notes,
    }
  })

  return {
    version: 1,
    generatedLabel: 'GST_AUDIT_EXPORT_PACK_V1',
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    companyGstin: input.companyGstin ?? null,
    sections,
    healthSnapshot: input.healthSnapshot ?? null,
    notFullGstCompliant: true,
    notPortalFiling: true,
    disclaimer: DISCLAIMER,
  }
}

export function buildGstr9AnnualSkeleton(input: {
  financialYearLabel: string
  monthly: Gstr9MonthlySlice[]
}): Gstr9AnnualSkeleton {
  const monthsExpected = indianFyPeriods(input.financialYearLabel)
  const byPeriod = new Map(input.monthly.map((m) => [m.returnPeriod, m]))
  const monthsPresent = monthsExpected.filter((p) => byPeriod.has(p))
  const coveragePct = Math.round((monthsPresent.length / monthsExpected.length) * 100)

  const totals = {
    outwardTaxable: 0,
    outwardTax: 0,
    inwardTaxable: 0,
    itcTotal: 0,
    netLiability: 0,
  }

  const monthly: Gstr9MonthlySlice[] = monthsExpected.map((p) => {
    const row = byPeriod.get(p) ?? { returnPeriod: p }
    totals.outwardTaxable += row.outwardTaxable ?? 0
    totals.outwardTax += row.outwardTax ?? 0
    totals.inwardTaxable += row.inwardTaxable ?? 0
    totals.itcTotal += row.itcTotal ?? 0
    totals.netLiability += row.netLiability ?? 0
    return row
  })

  const openIssues: string[] = []
  if (coveragePct < 100) {
    openIssues.push(
      `Missing monthly prep slices for ${monthsExpected.length - monthsPresent.length} month(s) of ${input.financialYearLabel}`,
    )
  }
  for (const m of monthly) {
    if ((m.outwardTaxable ?? 0) > 0 && !lockedLike(m.gstr1Status) && !filedLike(m.gstr1Status)) {
      openIssues.push(`${m.returnPeriod}: GSTR-1 not locked/filed for annual foundation`)
    }
    if (
      ((m.outwardTaxable ?? 0) > 0 || (m.inwardTaxable ?? 0) > 0) &&
      !lockedLike(m.gstr3bStatus) &&
      !filedLike(m.gstr3bStatus)
    ) {
      openIssues.push(`${m.returnPeriod}: GSTR-3B not locked/filed for annual foundation`)
    }
  }

  for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
    totals[k] = Math.round((totals[k] + Number.EPSILON) * 10_000) / 10_000
  }

  return {
    financialYearLabel: input.financialYearLabel,
    monthsExpected,
    monthsPresent,
    coveragePct,
    totals,
    monthly,
    openIssues,
    readinessLabel: 'GSTR9_ANNUAL_FOUNDATION',
    notFullGstCompliant: true,
    notGstr9c: true,
    notPortalFile: true,
    disclaimer:
      'GSTR-9 annual foundation from monthly books prep/ledger aggregates only. Not Form GSTR-9 official schema, not GSTR-9C, not portal annual return filing.',
  }
}

/** Evaluate notice response due relative to asOf (YYYY-MM-DD). */
export function evaluateNoticeDue(input: {
  dueDate: string
  status: string
  asOf?: string
}): NoticeDueEval {
  const status = input.status.toUpperCase()
  if (
    status === 'CLOSED' ||
    status === 'WAIVED' ||
    status === 'RESPONDED' ||
    status === 'VOID' ||
    status === 'ACKNOWLEDGED'
  ) {
    return { statusSuggested: 'CLOSED', daysUntilDue: null, isOverdue: false }
  }

  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10)
  const due = new Date(`${input.dueDate.slice(0, 10)}T00:00:00.000Z`).getTime()
  const now = new Date(`${asOf.slice(0, 10)}T00:00:00.000Z`).getTime()
  const daysUntilDue = Math.round((due - now) / 86_400_000)
  if (daysUntilDue < 0) {
    return { statusSuggested: 'OVERDUE', daysUntilDue, isOverdue: true }
  }
  if (daysUntilDue <= 7) {
    return { statusSuggested: 'DUE_SOON', daysUntilDue, isOverdue: false }
  }
  return { statusSuggested: 'OPEN', daysUntilDue, isOverdue: false }
}

export function buildPhase15CapabilityMatrix() {
  return {
    phase: 15,
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true as const,
    capabilities: [
      {
        id: 'compliance_cockpit',
        label: 'GST compliance cockpit',
        status: 'READY' as const,
        notes: 'Multi-period health + open-item counts from books engines',
      },
      {
        id: 'multi_period_health',
        label: 'Multi-period compliance health',
        status: 'READY' as const,
        notes: 'Score/grade from return prep, payment, RCM, 2B, e-docs, notices',
      },
      {
        id: 'audit_export_pack',
        label: 'Audit export pack (books evidence)',
        status: 'PARTIAL' as const,
        notes: 'Immutable manifest + section counts; payload export is JSON pack only',
      },
      {
        id: 'notices_log',
        label: 'Notices / correspondence log',
        status: 'PARTIAL' as const,
        notes: 'Manual tracker — not GSTN portal notice download',
      },
      {
        id: 'gstr9_foundation',
        label: 'GSTR-9 annual foundation',
        status: 'PARTIAL' as const,
        notes: 'FY roll-up of monthly books prep — not Form GSTR-9 / 9C / portal file',
      },
      {
        id: 'portal_live',
        label: 'LIVE portal filing / GSTR-9 submit',
        status: 'NOT_IN_SCOPE' as const,
        notes: 'Phase 12+ UAT only; never claim FULL GST COMPLIANT from this phase',
      },
    ],
  }
}
