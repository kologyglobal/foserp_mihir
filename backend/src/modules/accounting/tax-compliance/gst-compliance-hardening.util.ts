/**
 * Phase 13 — GST compliance hardening pure engine (no I/O).
 * Books period reconcile + statutory go-live / UAT gate scoring.
 * Does **not** file to GST portal · never claims FULL GST COMPLIANT.
 * Notices / multi-period audit packs → Phase 15 · GSTR-9 worksheet → Phase 14.
 */

import {
  assertLiveGstrFilingConfigured,
  resolveGstrFilingProviderMode,
} from './gstr-portal-filing.util.js'

export type ComplianceFindingSeverity = 'BLOCKER' | 'WARNING' | 'INFO' | 'PASS'

export type ComplianceFinding = {
  id: string
  code: string
  severity: ComplianceFindingSeverity
  title: string
  detail: string
  related?: string
}

export type HealthOverall = 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY'

export type PeriodReturnFact = {
  returnType: 'GSTR1' | 'GSTR3B'
  status: string
  hasSnapshot: boolean
  lockedOrFiled: boolean
}

export type PeriodPaymentFact = {
  activeCount: number
  bestStatus: string | null
  netTaxPayable: number
  totalPayable: number
}

export type PeriodFilingSessionFact = {
  returnType: 'GSTR1' | 'GSTR3B'
  sessionStatus: string | null
  providerMode: string | null
}

export type PeriodComplianceFacts = {
  returnPeriod: string
  companyGstin: string
  ledgerRowCount: number
  ledgerUnfiledCount: number
  ledgerFiledCount: number
  ledgerNullCompanyGstinCount: number
  booksLiabilityTotal: number
  booksItcTotal: number
  booksNetTaxPayable: number
  gstr1TotalTax: number | null
  gstr3bTotalLiability: number | null
  returns: PeriodReturnFact[]
  payment: PeriodPaymentFact
  openGstr2bFollowUps: number
  gstr2bUnmatchedRows: number
  openNotices: number
  filingSessions: PeriodFilingSessionFact[]
}

export type PeriodHealthScore = {
  overall: HealthOverall
  blockerCount: number
  warningCount: number
  infoCount: number
  passCount: number
  findings: ComplianceFinding[]
  notFullGstCompliant: true
  readinessLabel: 'GST_COMPLIANCE_HARDENING'
  disclaimer: string
}

export type CapabilityStatus = 'READY' | 'PARTIAL' | 'DEFERRED' | 'NOT_IN_SCOPE'

export type CapabilityRow = {
  id: string
  label: string
  status: CapabilityStatus
  notes: string
}

export type UatAxisId =
  | 'LIVE_IRN'
  | 'LIVE_EWAY'
  | 'GSTR_1_3B_RECON'
  | 'GSTR_2B_RECON'
  | 'PAYMENT'
  | 'MULTI_GSTIN'
  | 'STATUTORY_UAT'

export type UatAxisState = {
  id: UatAxisId
  label: string
  requiredForFullCompliance: true
  passed: boolean
  signedOff: boolean
  status: 'PASS' | 'FAIL' | 'PENDING' | 'SIGNED'
  detail: string
}

export type GoLiveGateResult = {
  overall: HealthOverall
  axes: UatAxisState[]
  passedCount: number
  totalCount: number
  livePortalConfigured: boolean
  filingProviderMode: 'SIMULATED' | 'LIVE'
  notFullGstCompliant: true
  canClaimFullGstCompliant: false
  readinessLabel: 'GST_GO_LIVE_UAT_GATE'
  disclaimer: string
  blockers: string[]
}

const AMOUNT_TOLERANCE = 0.05

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000
}

function nearlyEqual(a: number, b: number, tol = AMOUNT_TOLERANCE): boolean {
  return Math.abs(round4(a) - round4(b)) <= tol
}

export function isPhase13HardeningEnabled(env = process.env): boolean {
  const raw = (env.GST_PHASE13_HARDENING_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

export function returnStatusIsLockedOrFiled(status: string): boolean {
  return status === 'LOCKED' || status === 'MARKED_FILED_EXTERNAL'
}

/**
 * Book-vs-book reconciliation rules for one GST period / GSTIN.
 */
export function reconcilePeriodBooks(facts: PeriodComplianceFacts): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  const gstr1 = facts.returns.find((r) => r.returnType === 'GSTR1')
  const gstr3b = facts.returns.find((r) => r.returnType === 'GSTR3B')

  if (facts.ledgerRowCount === 0) {
    findings.push({
      id: 'no_ledger',
      code: 'NO_LEDGER_ROWS',
      severity: 'WARNING',
      title: 'No GST ledger rows',
      detail: `Period ${facts.returnPeriod} / GSTIN ${facts.companyGstin} has zero ledger entries.`,
    })
  } else {
    findings.push({
      id: 'ledger_present',
      code: 'LEDGER_PRESENT',
      severity: 'PASS',
      title: 'GST ledger populated',
      detail: `${facts.ledgerRowCount} ledger row(s); unfiled ${facts.ledgerUnfiledCount}; filed ${facts.ledgerFiledCount}.`,
    })
  }

  if (facts.ledgerNullCompanyGstinCount > 0) {
    findings.push({
      id: 'null_gstin',
      code: 'NULL_COMPANY_GSTIN',
      severity: 'WARNING',
      title: 'Ledger rows missing company GSTIN',
      detail: `${facts.ledgerNullCompanyGstinCount} row(s) have null companyGstin (Phase 9 backfill).`,
      related: 'phase9',
    })
  }

  if (!gstr1) {
    findings.push({
      id: 'gstr1_missing',
      code: 'GSTR1_PERIOD_MISSING',
      severity: 'WARNING',
      title: 'GSTR-1 period not opened',
      detail: 'Prepare from Returns workspace (Phase 5).',
      related: 'gstr1',
    })
  } else if (!returnStatusIsLockedOrFiled(gstr1.status)) {
    findings.push({
      id: 'gstr1_open',
      code: 'GSTR1_NOT_LOCKED',
      severity: gstr1.status === 'OPEN' ? 'INFO' : 'WARNING',
      title: `GSTR-1 status ${gstr1.status}`,
      detail: 'Period not LOCKED / MARKED_FILED_EXTERNAL.',
      related: 'gstr1',
    })
  } else {
    findings.push({
      id: 'gstr1_ok',
      code: 'GSTR1_LOCKED_OR_FILED',
      severity: 'PASS',
      title: 'GSTR-1 locked or marked filed',
      detail: `Status ${gstr1.status}${gstr1.hasSnapshot ? ' with frozen snapshot' : ''}.`,
      related: 'gstr1',
    })
  }

  if (!gstr3b) {
    findings.push({
      id: 'gstr3b_missing',
      code: 'GSTR3B_PERIOD_MISSING',
      severity: 'WARNING',
      title: 'GSTR-3B period not opened',
      detail: 'Prepare from Returns workspace (Phase 5).',
      related: 'gstr3b',
    })
  } else if (!returnStatusIsLockedOrFiled(gstr3b.status)) {
    findings.push({
      id: 'gstr3b_open',
      code: 'GSTR3B_NOT_LOCKED',
      severity: gstr3b.status === 'OPEN' ? 'INFO' : 'WARNING',
      title: `GSTR-3B status ${gstr3b.status}`,
      detail: 'Period not LOCKED / MARKED_FILED_EXTERNAL.',
      related: 'gstr3b',
    })
  } else {
    findings.push({
      id: 'gstr3b_ok',
      code: 'GSTR3B_LOCKED_OR_FILED',
      severity: 'PASS',
      title: 'GSTR-3B locked or marked filed',
      detail: `Status ${gstr3b.status}${gstr3b.hasSnapshot ? ' with frozen snapshot' : ''}.`,
      related: 'gstr3b',
    })
  }

  if (
    gstr1 &&
    gstr3b &&
    returnStatusIsLockedOrFiled(gstr1.status) !== returnStatusIsLockedOrFiled(gstr3b.status)
  ) {
    findings.push({
      id: 'return_status_skew',
      code: 'RETURN_STATUS_SKEW',
      severity: 'WARNING',
      title: 'GSTR-1 vs GSTR-3B status skew',
      detail: `GSTR-1=${gstr1.status}, GSTR-3B=${gstr3b.status}.`,
    })
  }

  if (
    facts.gstr1TotalTax != null &&
    facts.gstr3bTotalLiability != null &&
    !nearlyEqual(facts.gstr1TotalTax, facts.gstr3bTotalLiability)
  ) {
    findings.push({
      id: 'gstr1_3b_tax_mismatch',
      code: 'GSTR1_3B_TAX_MISMATCH',
      severity: 'WARNING',
      title: 'GSTR-1 tax vs GSTR-3B liability mismatch',
      detail: `GSTR-1 ${facts.gstr1TotalTax} vs GSTR-3B ${facts.gstr3bTotalLiability} (tol ${AMOUNT_TOLERANCE}).`,
    })
  } else if (facts.gstr1TotalTax != null && facts.gstr3bTotalLiability != null) {
    findings.push({
      id: 'gstr1_3b_tax_ok',
      code: 'GSTR1_3B_TAX_ALIGNED',
      severity: 'PASS',
      title: 'GSTR-1 and GSTR-3B tax totals aligned',
      detail: `Both ≈ ${facts.gstr1TotalTax} within ${AMOUNT_TOLERANCE}.`,
    })
  }

  if (
    facts.gstr3bTotalLiability != null &&
    !nearlyEqual(facts.gstr3bTotalLiability, facts.booksLiabilityTotal)
  ) {
    findings.push({
      id: 'snap_vs_books_liab',
      code: 'SNAPSHOT_VS_BOOKS_LIABILITY',
      severity: 'WARNING',
      title: 'GSTR-3B snapshot vs live books liability',
      detail: `Snapshot ${facts.gstr3bTotalLiability} vs live ${facts.booksLiabilityTotal}.`,
    })
  }

  const pay = facts.payment
  if (pay.activeCount === 0 && facts.booksNetTaxPayable > AMOUNT_TOLERANCE) {
    findings.push({
      id: 'no_payment',
      code: 'NO_PAYMENT_CHALLAN',
      severity: 'INFO',
      title: 'No PMT-06 style challan',
      detail: `Books net payable ≈ ${facts.booksNetTaxPayable}.`,
      related: 'payment',
    })
  } else if (pay.activeCount > 0) {
    if (!nearlyEqual(pay.netTaxPayable, facts.booksNetTaxPayable) && pay.bestStatus !== 'VOID') {
      findings.push({
        id: 'payment_vs_books',
        code: 'PAYMENT_VS_BOOKS_NET',
        severity: 'WARNING',
        title: 'Payment net vs books net mismatch',
        detail: `Challan net ${pay.netTaxPayable} vs books ${facts.booksNetTaxPayable}.`,
        related: 'payment',
      })
    } else {
      findings.push({
        id: 'payment_ok',
        code: 'PAYMENT_ALIGNED',
        severity: 'PASS',
        title: 'Payment challan present',
        detail: `${pay.activeCount} active; status ${pay.bestStatus ?? '—'}.`,
        related: 'payment',
      })
    }
  }

  if (facts.openGstr2bFollowUps > 0 || facts.gstr2bUnmatchedRows > 0) {
    findings.push({
      id: 'gstr2b_open',
      code: 'GSTR2B_OPEN_WORK',
      severity: 'WARNING',
      title: 'GSTR-2B / ITC open work',
      detail: `Follow-ups ${facts.openGstr2bFollowUps}; unmatched rows ${facts.gstr2bUnmatchedRows}.`,
      related: 'gstr2b',
    })
  } else {
    findings.push({
      id: 'gstr2b_clear',
      code: 'GSTR2B_CLEAR',
      severity: 'PASS',
      title: 'No open GSTR-2B follow-ups',
      detail: 'Clear for this period filter.',
      related: 'gstr2b',
    })
  }

  if (facts.openNotices > 0) {
    findings.push({
      id: 'open_notices',
      code: 'OPEN_NOTICES',
      severity: 'WARNING',
      title: 'Open GST notices (ops register)',
      detail: `${facts.openNotices} open notice(s) — Phase 15 register.`,
      related: 'notices',
    })
  }

  const lockedBoth =
    !!gstr1 &&
    !!gstr3b &&
    returnStatusIsLockedOrFiled(gstr1.status) &&
    returnStatusIsLockedOrFiled(gstr3b.status)

  if (lockedBoth && facts.ledgerUnfiledCount > 0) {
    findings.push({
      id: 'unfiled_after_lock',
      code: 'UNFILED_LEDGER_AFTER_LOCK',
      severity: 'BLOCKER',
      title: 'Unfiled ledger rows after return lock',
      detail: `${facts.ledgerUnfiledCount} ledger row(s) still open while both returns locked/filed.`,
    })
  }

  for (const fs of facts.filingSessions) {
    if (!fs.sessionStatus) {
      findings.push({
        id: `filing_${fs.returnType}_none`,
        code: 'FILING_SESSION_ABSENT',
        severity: 'INFO',
        title: `No Phase 12 filing session (${fs.returnType})`,
        detail: 'SIMULATED/LIVE gate not started for this return type.',
        related: 'phase12',
      })
      continue
    }
    if (fs.sessionStatus === 'LIVE_BLOCKED' || fs.sessionStatus === 'FAILED') {
      findings.push({
        id: `filing_${fs.returnType}_blocked`,
        code: 'FILING_SESSION_BLOCKED',
        severity: 'WARNING',
        title: `Filing session ${fs.sessionStatus} (${fs.returnType})`,
        detail: `providerMode=${fs.providerMode ?? '—'}`,
        related: 'phase12',
      })
    } else if (fs.sessionStatus === 'MARKED_FILED' || fs.sessionStatus === 'ACCEPTED_SIMULATED') {
      findings.push({
        id: `filing_${fs.returnType}_ok`,
        code: 'FILING_SESSION_PROGRESS',
        severity: 'PASS',
        title: `Filing session ${fs.sessionStatus} (${fs.returnType})`,
        detail: `mode=${fs.providerMode ?? '—'} · not LIVE certify alone`,
        related: 'phase12',
      })
    } else {
      findings.push({
        id: `filing_${fs.returnType}_mid`,
        code: 'FILING_SESSION_IN_PROGRESS',
        severity: 'INFO',
        title: `Filing session ${fs.sessionStatus} (${fs.returnType})`,
        detail: `In progress (mode ${fs.providerMode ?? 'SIMULATED'}).`,
        related: 'phase12',
      })
    }
  }

  findings.push({
    id: 'full_compliant_honest',
    code: 'NOT_FULL_GST_COMPLIANT',
    severity: 'INFO',
    title: 'Not FULL GST COMPLIANT',
    detail:
      'Hardening / UAT gate only. Full product claim needs LIVE IRN + e-Way + GSTR + payment + multi-GSTIN UAT sign-off.',
  })

  return findings
}

export function scorePeriodHealth(findings: ComplianceFinding[]): PeriodHealthScore {
  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length
  const infoCount = findings.filter((f) => f.severity === 'INFO').length
  const passCount = findings.filter((f) => f.severity === 'PASS').length
  let overall: HealthOverall = 'READY'
  if (blockerCount > 0) overall = 'NOT_READY'
  else if (warningCount > 0) overall = 'READY_WITH_WARNINGS'

  return {
    overall,
    blockerCount,
    warningCount,
    infoCount,
    passCount,
    findings,
    notFullGstCompliant: true,
    readinessLabel: 'GST_COMPLIANCE_HARDENING',
    disclaimer:
      'Period health is books-side reconciliation only. Not portal filing and not FULL GST COMPLIANT.',
  }
}

/** Pre-file gate: period may attempt Phase 12 package only when both returns locked and no blockers. */
export function evaluatePreFileReadiness(health: PeriodHealthScore, facts: PeriodComplianceFacts): {
  canCreateFilingPackage: boolean
  reasons: string[]
  overall: HealthOverall
} {
  const reasons: string[] = []
  const gstr1 = facts.returns.find((r) => r.returnType === 'GSTR1')
  const gstr3b = facts.returns.find((r) => r.returnType === 'GSTR3B')
  if (!gstr1 || !returnStatusIsLockedOrFiled(gstr1.status)) {
    reasons.push('GSTR-1 must be LOCKED (or externally filed) before filing package')
  }
  if (!gstr3b || !returnStatusIsLockedOrFiled(gstr3b.status)) {
    reasons.push('GSTR-3B must be LOCKED (or externally filed) before filing package')
  }
  if (health.blockerCount > 0) {
    reasons.push(`${health.blockerCount} period health BLOCKER(s) must be cleared`)
  }
  if (facts.ledgerRowCount === 0) {
    reasons.push('No ledger rows for period')
  }
  const canCreateFilingPackage = reasons.length === 0
  return {
    canCreateFilingPackage,
    reasons,
    overall: canCreateFilingPackage
      ? health.overall === 'READY'
        ? 'READY'
        : 'READY_WITH_WARNINGS'
      : 'NOT_READY',
  }
}

export type GoLiveFacts = {
  /** Live IRN provider path tested (ops signal) */
  liveIrnTested: boolean
  liveEwayTested: boolean
  gstrReconTested: boolean
  gstr2bReconTested: boolean
  paymentTested: boolean
  multiGstinTested: boolean
  /** Axis ids already signed in UAT register */
  signedAxisIds: UatAxisId[]
  env?: NodeJS.ProcessEnv
}

export function buildEmptyUatChecklist(): Record<
  UatAxisId,
  { passed: boolean; evidenceRef?: string | null; notes?: string | null }
> {
  return {
    LIVE_IRN: { passed: false },
    LIVE_EWAY: { passed: false },
    GSTR_1_3B_RECON: { passed: false },
    GSTR_2B_RECON: { passed: false },
    PAYMENT: { passed: false },
    MULTI_GSTIN: { passed: false },
    STATUTORY_UAT: { passed: false },
  }
}

/**
 * Statutory go-live / UAT gate from TAX_IMPLEMENTATION_PLAN Phase 12 exit candidacy.
 * Hard-codes canClaimFullGstCompliant = false always.
 */
export function evaluateGoLiveGate(facts: GoLiveFacts): GoLiveGateResult {
  const env = facts.env ?? process.env
  const mode = resolveGstrFilingProviderMode(env)
  const live = assertLiveGstrFilingConfigured(env)
  const signed = new Set(facts.signedAxisIds)

  const defs: Array<{ id: UatAxisId; label: string; tested: boolean }> = [
    { id: 'LIVE_IRN', label: 'Live e-Invoice (IRN) tested', tested: facts.liveIrnTested },
    { id: 'LIVE_EWAY', label: 'Live e-Way tested', tested: facts.liveEwayTested },
    { id: 'GSTR_1_3B_RECON', label: 'GSTR-1 / 3B recon tested', tested: facts.gstrReconTested },
    { id: 'GSTR_2B_RECON', label: 'GSTR-2B recon tested', tested: facts.gstr2bReconTested },
    { id: 'PAYMENT', label: 'GST payment tested', tested: facts.paymentTested },
    { id: 'MULTI_GSTIN', label: 'Multi-GSTIN tested', tested: facts.multiGstinTested },
    {
      id: 'STATUTORY_UAT',
      label: 'Statutory UAT sign-off',
      tested: facts.liveIrnTested &&
        facts.liveEwayTested &&
        facts.gstrReconTested &&
        facts.gstr2bReconTested &&
        facts.paymentTested &&
        facts.multiGstinTested,
    },
  ]

  const axes: UatAxisState[] = defs.map((d) => {
    const signedOff = signed.has(d.id)
    let status: UatAxisState['status'] = 'PENDING'
    if (signedOff) status = 'SIGNED'
    else if (d.tested) status = 'PASS'
    else status = 'FAIL'
    return {
      id: d.id,
      label: d.label,
      requiredForFullCompliance: true,
      passed: d.tested || signedOff,
      signedOff,
      status,
      detail: signedOff
        ? 'Signed in UAT register'
        : d.tested
          ? 'Ops signal: tested'
          : 'Not verified — required before FULL GST COMPLIANCE candidacy',
    }
  })

  const passedCount = axes.filter((a) => a.passed || a.signedOff).length
  const blockers: string[] = []
  for (const a of axes) {
    if (!a.passed && !a.signedOff) blockers.push(`UAT axis not ready: ${a.id}`)
  }
  if (mode === 'LIVE' && !live.ready) {
    blockers.push(...live.blockers)
  }

  let overall: HealthOverall = 'READY'
  if (blockers.length > 0) overall = 'NOT_READY'
  else if (mode === 'SIMULATED') overall = 'READY_WITH_WARNINGS'

  return {
    overall,
    axes,
    passedCount,
    totalCount: axes.length,
    livePortalConfigured: live.ready,
    filingProviderMode: mode,
    notFullGstCompliant: true,
    canClaimFullGstCompliant: false,
    readinessLabel: 'GST_GO_LIVE_UAT_GATE',
    disclaimer:
      'Go-live / UAT gate from plan Phase 12 exit candidacy. Even when all axes pass, product must not self-label FULL GST COMPLIANT without statutory sign-off process outside pure software.',
    blockers,
  }
}

export function buildPhase13ReadinessMatrix(opts?: {
  featureEnabled?: boolean
  portalFilingPresent?: boolean
}): {
  phase: 13
  verdict: string
  notFullGstCompliant: true
  featureEnabled: boolean
  capabilities: CapabilityRow[]
} {
  const featureEnabled = opts?.featureEnabled ?? isPhase13HardeningEnabled()
  const portal = opts?.portalFilingPresent ?? true
  return {
    phase: 13,
    verdict: featureEnabled ? 'READY_WITH_CONDITIONS' : 'DISABLED',
    notFullGstCompliant: true,
    featureEnabled,
    capabilities: [
      {
        id: 'period_books_reconcile',
        label: 'Period books reconciliation',
        status: featureEnabled ? 'READY' : 'DEFERRED',
        notes: 'Ledger vs GSTR prep vs payment vs optional Phase 12 session status',
      },
      {
        id: 'pre_file_gate',
        label: 'Pre-file readiness gate',
        status: featureEnabled ? 'READY' : 'DEFERRED',
        notes: 'Blocks package creation advice when returns unlocked / blockers present',
      },
      {
        id: 'go_live_uat_gate',
        label: 'Statutory go-live / UAT gate',
        status: featureEnabled ? 'READY' : 'DEFERRED',
        notes: 'Plan Phase 12 exit axes — IRN / e-Way / GSTR / payment / multi-GSTIN',
      },
      {
        id: 'uat_signoff_register',
        label: 'UAT sign-off register',
        status: featureEnabled ? 'READY' : 'DEFERRED',
        notes: 'Maker submit + checker approve of axes (not portal)',
      },
      {
        id: 'portal_filing',
        label: 'Portal filing sessions',
        status: portal ? 'PARTIAL' : 'DEFERRED',
        notes: 'Owned by Phase 12 — Phase 13 only observes readiness',
      },
      {
        id: 'notices_audit_packs',
        label: 'Notices / multi-period audit packs',
        status: 'DEFERRED',
        notes: 'Phase 15 compliance ops',
      },
      {
        id: 'gstr9_worksheet',
        label: 'GSTR-9 annual worksheet',
        status: 'DEFERRED',
        notes: 'Phase 14 annual / archive',
      },
      {
        id: 'full_gst_compliant',
        label: 'FULL GST COMPLIANT product claim',
        status: 'NOT_IN_SCOPE',
        notes: 'Never auto-claimed — canClaimFullGstCompliant always false',
      },
    ],
  }
}

export function extractTaxTotalFromSnapshot(snapshot: unknown, prefer: 'gstr1' | 'gstr3b'): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as Record<string, unknown>
  const preferKeys =
    prefer === 'gstr1'
      ? ['totalTax', 'totalTaxAmount', 'taxAmount']
      : ['totalLiability', 'totalTax', 'taxLiability', 'netTaxPayable']
  const sum = (s.summary ?? s.liability ?? s.totals ?? s) as Record<string, unknown>
  if (sum && typeof sum === 'object') {
    for (const key of preferKeys) {
      if (typeof sum[key] === 'number' && Number.isFinite(sum[key])) return sum[key] as number
    }
  }
  if (typeof s.totalTax === 'number') return s.totalTax
  if (typeof s.totalLiability === 'number') return s.totalLiability
  return null
}
