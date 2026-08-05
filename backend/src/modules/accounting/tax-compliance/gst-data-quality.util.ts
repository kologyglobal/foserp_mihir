/**
 * Phase 17 — GST ledger data quality, companyGstin backfill plan, period freeze readiness (pure).
 * Does **not** re-tax, re-submit portal, or claim FULL GST COMPLIANT.
 */

import { detectGstinContamination, normalizeGstin } from './gst-registration-scope.util.js'

export function isPhase17DataQualityEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.GST_PHASE17_DATA_QUALITY_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

export type LedgerQualityRowLike = {
  id: string
  documentId: string
  documentNumber?: string | null
  documentType?: string | null
  branchId?: string | null
  companyGstin?: string | null
  filingStatus?: string | null
  supplyClass?: string | null
  taxTreatment?: string | null
  taxType?: string | null
}

export type GstinBackfillCandidate = {
  ledgerEntryId: string
  documentId: string
  documentNumber: string | null
  fromGstin: string | null
  toGstin: string
  source: 'BRANCH' | 'LEGAL_ENTITY' | 'EXPLICIT_SNAPSHOT' | 'DOCUMENT'
  reason: string
}

export type DataQualityFinding = {
  code: string
  severity: 'INFO' | 'WARN' | 'BLOCKER'
  message: string
  count: number
  sampleDocumentNumbers: string[]
}

export type FreezeChecklistItem = {
  id: string
  label: string
  status: 'PASS' | 'WARN' | 'FAIL'
  message: string
}

export function buildPhase17CapabilityMatrix() {
  return {
    phase: 17,
    label: 'GST_DATA_QUALITY_BACKFILL_FREEZE',
    fullGstCompliant: false,
    canClaimFullGstCompliant: false,
    portalLive: false,
    silentRetax: false,
    features: {
      nullGstinScan: 'READY',
      multiGstinContamination: 'READY',
      companyGstinBackfill: 'READY_WITH_CONDITIONS',
      periodFreezeChecklist: 'READY_WITH_CONDITIONS',
      evidenceRuns: 'READY',
    },
    notes: [
      'Backfill only fills null companyGstin — never overwrites non-null stamps.',
      'Freeze checklist is advisory for books close — not a legal period lock.',
      'Not portal LIVE · not FULL GST COMPLIANT.',
    ],
  }
}

export function analyzeLedgerDataQuality(rows: LedgerQualityRowLike[]): {
  totalRows: number
  nullCompanyGstinCount: number
  filedWithNullGstinCount: number
  distinctGstins: string[]
  contaminated: boolean
  missingSupplyClassCount: number
  findings: DataQualityFinding[]
} {
  const nulls = rows.filter((r) => !normalizeGstin(r.companyGstin))
  const filedNull = nulls.filter((r) => (r.filingStatus ?? '').toUpperCase() === 'FILED')
  const gstins = rows.map((r) => r.companyGstin ?? null)
  const contamination = detectGstinContamination(gstins)
  const missingSupply = rows.filter((r) => !(r.supplyClass ?? '').trim())

  const findings: DataQualityFinding[] = []
  if (nulls.length > 0) {
    findings.push({
      code: 'NULL_COMPANY_GSTIN',
      severity: filedNull.length > 0 ? 'BLOCKER' : 'WARN',
      message: `${nulls.length} ledger row(s) missing companyGstin (multi-GSTIN isolation risk)`,
      count: nulls.length,
      sampleDocumentNumbers: sampleDocs(nulls),
    })
  }
  if (filedNull.length > 0) {
    findings.push({
      code: 'FILED_WITH_NULL_GSTIN',
      severity: 'BLOCKER',
      message: `${filedNull.length} FILED row(s) still lack companyGstin`,
      count: filedNull.length,
      sampleDocumentNumbers: sampleDocs(filedNull),
    })
  }
  if (contamination.contaminated) {
    findings.push({
      code: 'MULTI_GSTIN_MIX',
      severity: 'BLOCKER',
      message: `Period slice mixes GSTINs: ${contamination.distinct.join(', ')}`,
      count: contamination.distinct.length,
      sampleDocumentNumbers: [],
    })
  }
  if (missingSupply.length > 0) {
    findings.push({
      code: 'MISSING_SUPPLY_CLASS',
      severity: 'INFO',
      message: `${missingSupply.length} row(s) without supplyClass (legacy — non-blocking)`,
      count: missingSupply.length,
      sampleDocumentNumbers: sampleDocs(missingSupply),
    })
  }

  return {
    totalRows: rows.length,
    nullCompanyGstinCount: nulls.length,
    filedWithNullGstinCount: filedNull.length,
    distinctGstins: contamination.distinct,
    contaminated: contamination.contaminated,
    missingSupplyClassCount: missingSupply.length,
    findings,
  }
}

function sampleDocs(rows: LedgerQualityRowLike[], n = 5): string[] {
  const out: string[] = []
  for (const r of rows) {
    const label = (r.documentNumber ?? r.documentId).trim()
    if (label && !out.includes(label)) out.push(label)
    if (out.length >= n) break
  }
  return out
}

/**
 * Propose stamps for null companyGstin only.
 * `resolveTarget` returns toGstin + source for a row, or null if unresolvable.
 */
export function proposeGstinBackfillPlan(
  rows: LedgerQualityRowLike[],
  resolveTarget: (row: LedgerQualityRowLike) => {
    toGstin: string
    source: GstinBackfillCandidate['source']
    reason: string
  } | null,
): {
  candidates: GstinBackfillCandidate[]
  alreadyPopulated: number
  unresolvable: Array<{ id: string; documentId: string; message: string }>
} {
  const candidates: GstinBackfillCandidate[] = []
  const unresolvable: Array<{ id: string; documentId: string; message: string }> = []
  let alreadyPopulated = 0

  for (const row of rows) {
    if (normalizeGstin(row.companyGstin)) {
      alreadyPopulated += 1
      continue
    }
    const resolved = resolveTarget(row)
    if (!resolved) {
      unresolvable.push({
        id: row.id,
        documentId: row.documentId,
        message: 'No branch/LE/document GSTIN available',
      })
      continue
    }
    const to = normalizeGstin(resolved.toGstin)
    if (!to) {
      unresolvable.push({
        id: row.id,
        documentId: row.documentId,
        message: 'Resolved GSTIN invalid (need full 15-char GSTIN)',
      })
      continue
    }
    candidates.push({
      ledgerEntryId: row.id,
      documentId: row.documentId,
      documentNumber: row.documentNumber ?? null,
      fromGstin: null,
      toGstin: to,
      source: resolved.source,
      reason: resolved.reason,
    })
  }

  return { candidates, alreadyPopulated, unresolvable }
}

export function scoreDataQualityHealth(input: {
  nullCompanyGstinCount: number
  filedWithNullGstinCount: number
  contaminated: boolean
  unresolvableBackfill: number
  openRcmLiabilityCount?: number
}): { scorePct: number; overall: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' } {
  let score = 100
  if (input.nullCompanyGstinCount > 0) score -= Math.min(40, 5 + Math.floor(input.nullCompanyGstinCount / 10) * 5)
  if (input.filedWithNullGstinCount > 0) score -= 30
  if (input.contaminated) score -= 25
  if ((input.unresolvableBackfill ?? 0) > 0) score -= Math.min(15, input.unresolvableBackfill)
  if ((input.openRcmLiabilityCount ?? 0) > 0) score -= Math.min(15, input.openRcmLiabilityCount * 2)
  score = Math.max(0, Math.min(100, score))
  const overall = score >= 85 ? 'HEALTHY' : score >= 55 ? 'ATTENTION' : 'CRITICAL'
  return { scorePct: score, overall }
}

export function buildPeriodFreezeChecklist(input: {
  quality: ReturnType<typeof analyzeLedgerDataQuality>
  gstr1Status?: string | null
  gstr3bStatus?: string | null
  openRcmLiabilityCount: number
  backfillCandidateCount: number
  unresolvableCount: number
}): {
  ready: boolean
  items: FreezeChecklistItem[]
  summary: string
} {
  const items: FreezeChecklistItem[] = []

  items.push({
    id: 'company_gstin_complete',
    label: 'Company GSTIN stamped on period ledger',
    status: input.quality.nullCompanyGstinCount === 0 ? 'PASS' : input.quality.filedWithNullGstinCount > 0 ? 'FAIL' : 'WARN',
    message:
      input.quality.nullCompanyGstinCount === 0
        ? 'All rows have companyGstin'
        : `${input.quality.nullCompanyGstinCount} null row(s); ${input.backfillCandidateCount} backfillable`,
  })

  items.push({
    id: 'single_gstin_slice',
    label: 'No multi-GSTIN contamination in slice',
    status: input.quality.contaminated ? 'FAIL' : 'PASS',
    message: input.quality.contaminated
      ? `Mixed GSTINs: ${input.quality.distinctGstins.join(', ')}`
      : 'Slice is single-GSTIN (or empty)',
  })

  items.push({
    id: 'backfill_unresolvable',
    label: 'Null GSTINs resolvable from branch/LE/document',
    status: input.unresolvableCount === 0 ? 'PASS' : 'WARN',
    message:
      input.unresolvableCount === 0
        ? 'No unresolvable nulls'
        : `${input.unresolvableCount} row(s) need master GSTIN on LE/branch`,
  })

  const r1 = (input.gstr1Status ?? 'NONE').toUpperCase()
  const r3 = (input.gstr3bStatus ?? 'NONE').toUpperCase()
  items.push({
    id: 'gstr_prep_present',
    label: 'GSTR-1 / 3B prep state observed',
    status: r1 === 'NONE' && r3 === 'NONE' ? 'WARN' : 'PASS',
    message: `GSTR-1=${r1}; GSTR-3B=${r3} (books only — not portal)`,
  })

  items.push({
    id: 'rcm_liability',
    label: 'Open RCM liability before freeze',
    status: input.openRcmLiabilityCount === 0 ? 'PASS' : 'WARN',
    message:
      input.openRcmLiabilityCount === 0
        ? 'No open RCM LIABILITY_POSTED'
        : `${input.openRcmLiabilityCount} RCM liability unpaid (books)`,
  })

  items.push({
    id: 'honest_label',
    label: 'FULL GST COMPLIANT claim',
    status: 'FAIL',
    message: 'Software freeze readiness never allows FULL GST COMPLIANT label',
  })

  const hardFails = items.filter((i) => i.id !== 'honest_label' && i.status === 'FAIL')
  const ready = hardFails.length === 0 && input.quality.nullCompanyGstinCount === 0
  return {
    ready,
    items,
    summary: ready
      ? 'Books freeze checklist PASS (still not FULL GST COMPLIANT / not portal LIVE)'
      : 'Books freeze checklist has WARN/FAIL items — remediate before period freeze claim',
  }
}
