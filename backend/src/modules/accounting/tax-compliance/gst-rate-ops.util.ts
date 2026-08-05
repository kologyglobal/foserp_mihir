/**
 * Phase 16 — GST rate master ops & determination continuity (pure, no I/O).
 * Covers effective-dated coverage, expiries, and posted-snapshot vs current master drift.
 * Does **not** re-tax posted documents · not full master CRUD (reuse master module) · not portal · not FULL GST COMPLIANT.
 */

export type GstRateApplicability = 'SALES' | 'PURCHASE' | 'BOTH'

export type RateMasterLike = {
  id: string
  code: string
  gstGroupId: string
  gstGroupCode?: string | null
  dateFrom: string // YYYY-MM-DD
  dateTo: string | null
  cgst: number
  sgst: number
  igst: number
  applicableFor: GstRateApplicability | string
  status: string
}

export type GstGroupLike = {
  id: string
  code: string
  status: string
}

export type LedgerRateSample = {
  documentId: string
  documentNumber?: string | null
  documentDate: string
  documentLineId?: string | null
  gstGroupId?: string | null
  taxType: string
  taxRate: number
  taxAmount: number
}

export function isPhase16RateOpsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.GST_PHASE16_RATE_OPS_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

function parseDateOnly(s: string): number {
  const t = Date.parse(`${s.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(t) ? t : NaN
}

/** True when asOf is within [dateFrom, dateTo] (open-ended if dateTo null). */
export function isRateActiveAsOf(
  rate: Pick<RateMasterLike, 'dateFrom' | 'dateTo' | 'status'>,
  asOfDate: string,
): boolean {
  if ((rate.status ?? '').toUpperCase() !== 'ACTIVE') return false
  const asOf = parseDateOnly(asOfDate)
  const from = parseDateOnly(rate.dateFrom)
  if (!Number.isFinite(asOf) || !Number.isFinite(from)) return false
  if (asOf < from) return false
  if (rate.dateTo) {
    const to = parseDateOnly(rate.dateTo)
    if (Number.isFinite(to) && asOf > to) return false
  }
  return true
}

export function rateAppliesFor(
  applicableFor: string | undefined | null,
  direction: 'SALES' | 'PURCHASE',
): boolean {
  const a = (applicableFor ?? 'BOTH').toUpperCase()
  if (a === 'BOTH') return true
  return a === direction
}

export type CoverageGap = {
  gstGroupId: string
  gstGroupCode: string
  missingFor: Array<'SALES' | 'PURCHASE'>
  message: string
}

/**
 * Groups without an ACTIVE effective-dated rate for SALES and/or PURCHASE as-of date.
 * Inactive groups are skipped.
 */
export function findRateCoverageGaps(params: {
  groups: GstGroupLike[]
  rates: RateMasterLike[]
  asOfDate: string
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  const activeGroups = params.groups.filter((g) => (g.status ?? '').toUpperCase() === 'ACTIVE')

  for (const g of activeGroups) {
    const groupRates = params.rates.filter(
      (r) => r.gstGroupId === g.id && isRateActiveAsOf(r, params.asOfDate),
    )
    const hasSales = groupRates.some((r) => rateAppliesFor(r.applicableFor, 'SALES'))
    const hasPurchase = groupRates.some((r) => rateAppliesFor(r.applicableFor, 'PURCHASE'))
    const missingFor: Array<'SALES' | 'PURCHASE'> = []
    if (!hasSales) missingFor.push('SALES')
    if (!hasPurchase) missingFor.push('PURCHASE')
    if (missingFor.length) {
      gaps.push({
        gstGroupId: g.id,
        gstGroupCode: g.code,
        missingFor,
        message: `GST group ${g.code} has no ACTIVE effective rate as-of ${params.asOfDate} for: ${missingFor.join(', ')}`,
      })
    }
  }
  return gaps.sort((a, b) => a.gstGroupCode.localeCompare(b.gstGroupCode))
}

export type ExpiringRate = {
  rateId: string
  code: string
  gstGroupId: string
  gstGroupCode: string | null
  dateTo: string
  daysRemaining: number
  severity: 'WARN' | 'CRITICAL'
}

/** Rates expiring within horizonDays (inclusive) relative to asOfDate. */
export function findExpiringRates(params: {
  rates: RateMasterLike[]
  asOfDate: string
  horizonDays?: number
}): ExpiringRate[] {
  const horizon = params.horizonDays ?? 30
  const asOf = parseDateOnly(params.asOfDate)
  if (!Number.isFinite(asOf)) return []
  const out: ExpiringRate[] = []
  for (const r of params.rates) {
    if ((r.status ?? '').toUpperCase() !== 'ACTIVE') continue
    if (!r.dateTo) continue
    if (!isRateActiveAsOf(r, params.asOfDate)) continue
    const to = parseDateOnly(r.dateTo)
    if (!Number.isFinite(to)) continue
    const daysRemaining = Math.round((to - asOf) / 86_400_000)
    if (daysRemaining < 0 || daysRemaining > horizon) continue
    out.push({
      rateId: r.id,
      code: r.code,
      gstGroupId: r.gstGroupId,
      gstGroupCode: r.gstGroupCode ?? null,
      dateTo: r.dateTo.slice(0, 10),
      daysRemaining,
      severity: daysRemaining <= 7 ? 'CRITICAL' : 'WARN',
    })
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

export type OverlapConflict = {
  gstGroupId: string
  gstGroupCode: string | null
  applicableFor: string
  rateAId: string
  rateACode: string
  rateBId: string
  rateBCode: string
  message: string
}

/** Detect overlapping ACTIVE date ranges for same group + applicability (resolve ambiguity). */
export function findRateOverlaps(rates: RateMasterLike[]): OverlapConflict[] {
  const conflicts: OverlapConflict[] = []
  const active = rates.filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE')
  const buckets = new Map<string, RateMasterLike[]>()
  for (const r of active) {
    const key = `${r.gstGroupId}|${(r.applicableFor ?? 'BOTH').toUpperCase()}`
    const list = buckets.get(key) ?? []
    list.push(r)
    buckets.set(key, list)
  }
  for (const [, list] of buckets) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (rangesOverlap(list[i]!, list[j]!)) {
          const a = list[i]!
          const b = list[j]!
          conflicts.push({
            gstGroupId: a.gstGroupId,
            gstGroupCode: a.gstGroupCode ?? b.gstGroupCode ?? null,
            applicableFor: String(a.applicableFor ?? 'BOTH'),
            rateAId: a.id,
            rateACode: a.code,
            rateBId: b.id,
            rateBCode: b.code,
            message: `Overlapping ACTIVE rates ${a.code} and ${b.code} for group/applicability — resolve may be non-deterministic`,
          })
        }
      }
    }
  }
  return conflicts
}

function rangesOverlap(a: RateMasterLike, b: RateMasterLike): boolean {
  const aFrom = parseDateOnly(a.dateFrom)
  const bFrom = parseDateOnly(b.dateFrom)
  const aTo = a.dateTo ? parseDateOnly(a.dateTo) : Number.POSITIVE_INFINITY
  const bTo = b.dateTo ? parseDateOnly(b.dateTo) : Number.POSITIVE_INFINITY
  if (![aFrom, bFrom, aTo, bTo].every((n) => Number.isFinite(n) || n === Number.POSITIVE_INFINITY)) {
    return false
  }
  return aFrom <= bTo && bFrom <= aTo
}

export type DriftFinding = {
  documentId: string
  documentNumber: string | null
  documentDate: string
  documentLineId: string | null
  gstGroupId: string | null
  taxType: string
  ledgerRate: number
  masterRate: number | null
  delta: number | null
  severity: 'INFO' | 'WARN' | 'CRITICAL'
  message: string
}

/**
 * Compare ledger component rates to the best matching ACTIVE master rate as-of document date.
 * Does **not** recompute tax amounts — advisory continuity check only.
 * Tolerance default 0.01 percentage points.
 */
export function evaluateLedgerRateDrift(params: {
  samples: LedgerRateSample[]
  rates: RateMasterLike[]
  tolerancePct?: number
}): DriftFinding[] {
  const tol = params.tolerancePct ?? 0.01
  const findings: DriftFinding[] = []

  for (const s of params.samples) {
    if (!s.gstGroupId) {
      if (Math.abs(s.taxRate) > tol && Math.abs(s.taxAmount) > 0.00005) {
        findings.push({
          documentId: s.documentId,
          documentNumber: s.documentNumber ?? null,
          documentDate: s.documentDate,
          documentLineId: s.documentLineId ?? null,
          gstGroupId: null,
          taxType: s.taxType,
          ledgerRate: s.taxRate,
          masterRate: null,
          delta: null,
          severity: 'INFO',
          message: 'Ledger sample has tax rate but no gstGroupId on snapshot — cannot match master',
        })
      }
      continue
    }

    const direction = s.taxType.startsWith('INPUT') || s.taxType.startsWith('RCM') ? 'PURCHASE' : 'SALES'
    const candidates = params.rates.filter(
      (r) =>
        r.gstGroupId === s.gstGroupId &&
        isRateActiveAsOf(r, s.documentDate) &&
        rateAppliesFor(r.applicableFor, direction),
    )
    if (candidates.length === 0) {
      findings.push({
        documentId: s.documentId,
        documentNumber: s.documentNumber ?? null,
        documentDate: s.documentDate,
        documentLineId: s.documentLineId ?? null,
        gstGroupId: s.gstGroupId,
        taxType: s.taxType,
        ledgerRate: s.taxRate,
        masterRate: null,
        delta: null,
        severity: 'WARN',
        message: `No ACTIVE master rate for group as-of ${s.documentDate} matching ${direction}`,
      })
      continue
    }

    // Prefer longest open range and later dateFrom
    const best = [...candidates].sort((a, b) => {
      const aTo = a.dateTo ? parseDateOnly(a.dateTo) : Number.POSITIVE_INFINITY
      const bTo = b.dateTo ? parseDateOnly(b.dateTo) : Number.POSITIVE_INFINITY
      if (aTo !== bTo) return bTo - aTo
      return parseDateOnly(b.dateFrom) - parseDateOnly(a.dateFrom)
    })[0]!

    const expected = expectedComponentRate(best, s.taxType)
    if (expected == null) continue
    const delta = Math.round((s.taxRate - expected) * 10000) / 10000
    if (Math.abs(delta) <= tol) continue

    findings.push({
      documentId: s.documentId,
      documentNumber: s.documentNumber ?? null,
      documentDate: s.documentDate,
      documentLineId: s.documentLineId ?? null,
      gstGroupId: s.gstGroupId,
      taxType: s.taxType,
      ledgerRate: s.taxRate,
      masterRate: expected,
      delta,
      severity: Math.abs(delta) >= 1 ? 'CRITICAL' : 'WARN',
      message: `Ledger ${s.taxType} rate ${s.taxRate}% vs master ${expected}% (Δ ${delta}) — posted snapshot frozen; do not silent re-tax`,
    })
  }

  return findings
}

function expectedComponentRate(rate: RateMasterLike, taxType: string): number | null {
  const t = taxType.toUpperCase()
  if (t.includes('CGST')) return Number(rate.cgst)
  if (t.includes('SGST') || t.includes('UTGST')) return Number(rate.sgst)
  if (t.includes('IGST')) return Number(rate.igst)
  return null
}

export type RateOpsHealth = {
  overall: 'HEALTHY' | 'NEEDS_ATTENTION' | 'BLOCKED'
  gapCount: number
  expiringCount: number
  overlapCount: number
  driftCount: number
  criticalDriftCount: number
  scorePct: number
  notFullGstCompliant: true
  readinessLabel: 'GST_RATE_OPS_READY_WITH_CONDITIONS'
  disclaimer: string
}

export function scoreRateOpsHealth(params: {
  gapCount: number
  expiringCount: number
  overlapCount: number
  driftCount: number
  criticalDriftCount: number
}): RateOpsHealth {
  let score = 100
  score -= Math.min(40, params.gapCount * 8)
  score -= Math.min(20, params.overlapCount * 10)
  score -= Math.min(15, params.expiringCount * 3)
  score -= Math.min(20, params.driftCount * 2)
  score -= Math.min(25, params.criticalDriftCount * 8)
  score = Math.max(0, Math.round(score))

  const overall: RateOpsHealth['overall'] =
    params.gapCount > 0 || params.overlapCount > 0 || params.criticalDriftCount > 0
      ? 'BLOCKED'
      : params.driftCount > 0 || params.expiringCount > 0
        ? 'NEEDS_ATTENTION'
        : 'HEALTHY'

  return {
    overall,
    gapCount: params.gapCount,
    expiringCount: params.expiringCount,
    overlapCount: params.overlapCount,
    driftCount: params.driftCount,
    criticalDriftCount: params.criticalDriftCount,
    scorePct: score,
    notFullGstCompliant: true,
    readinessLabel: 'GST_RATE_OPS_READY_WITH_CONDITIONS',
    disclaimer:
      'GST rate master ops / determination continuity only. Posted tax snapshots stay immutable. Not FULL GST COMPLIANT. Not portal filing. Master CRUD remains in masters module.',
  }
}

export type RateImpactRow = {
  gstGroupId: string
  gstGroupCode: string | null
  documentCount: number
  lineCount: number
  totalTaxAmount: number
}

/** Roll-up usage of groups in ledger samples (change-impact hint). */
export function buildRateChangeImpact(samples: LedgerRateSample[]): RateImpactRow[] {
  const map = new Map<string, RateImpactRow & { docs: Set<string> }>()
  for (const s of samples) {
    const key = s.gstGroupId ?? '__none__'
    let row = map.get(key)
    if (!row) {
      row = {
        gstGroupId: s.gstGroupId ?? '',
        gstGroupCode: null,
        documentCount: 0,
        lineCount: 0,
        totalTaxAmount: 0,
        docs: new Set(),
      }
      map.set(key, row)
    }
    row.docs.add(s.documentId)
    row.lineCount += 1
    row.totalTaxAmount = Math.round((row.totalTaxAmount + Number(s.taxAmount || 0)) * 10000) / 10000
  }
  return [...map.values()]
    .map((r) => ({
      gstGroupId: r.gstGroupId,
      gstGroupCode: r.gstGroupCode,
      documentCount: r.docs.size,
      lineCount: r.lineCount,
      totalTaxAmount: r.totalTaxAmount,
    }))
    .sort((a, b) => b.totalTaxAmount - a.totalTaxAmount)
}

export function buildPhase16CapabilityMatrix(): {
  phase: 16
  verdict: 'READY_WITH_CONDITIONS'
  notFullGstCompliant: true
  capabilities: Array<{ id: string; label: string; status: string; notes: string }>
} {
  return {
    phase: 16,
    verdict: 'READY_WITH_CONDITIONS',
    notFullGstCompliant: true,
    capabilities: [
      {
        id: 'rate_coverage',
        label: 'Effective-dated GST rate coverage gaps',
        status: 'READY',
        notes: 'Active groups missing SALES/PURCHASE rates as-of date',
      },
      {
        id: 'rate_expiry',
        label: 'Upcoming rate expiries',
        status: 'READY',
        notes: 'Horizon default 30 days; ops warning only',
      },
      {
        id: 'rate_overlap',
        label: 'Overlapping ACTIVE rate windows',
        status: 'READY',
        notes: 'Detect ambiguous resolve windows for same group/applicability',
      },
      {
        id: 'snapshot_drift',
        label: 'Posted ledger vs current master rate drift',
        status: 'PARTIAL',
        notes: 'Advisory only — never rewrites posted tax; requires gstGroupId on samples',
      },
      {
        id: 'change_impact',
        label: 'Period usage impact by GST group',
        status: 'READY',
        notes: 'Books usage roll-up for change planning',
      },
      {
        id: 'master_crud',
        label: 'GST rate / HSN master CRUD',
        status: 'REUSE',
        notes: 'Owned by masters module — Phase 16 is ops diagnostics only',
      },
      {
        id: 'portal_filing',
        label: 'LIVE GST portal filing',
        status: 'NOT_IN_SCOPE',
        notes: 'Phase 12 gated; never claimed here',
      },
    ],
  }
}
