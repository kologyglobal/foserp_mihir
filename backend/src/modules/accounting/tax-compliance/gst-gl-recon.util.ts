/**
 * Phase 18 — GST subledger vs GL control-account reconciliation (pure).
 * Advisory books recon only — not portal, not silent re-tax, not FULL GST COMPLIANT.
 */

export function isPhase18GlReconEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.GST_PHASE18_GL_RECON_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

export type GstGlSide = 'LIABILITY_CREDIT_NET' | 'ASSET_DEBIT_NET'

export type GstGlBucket = {
  taxType: string
  mappingKey: string
  side: GstGlSide
  label: string
}

/** Canonical GST ledger taxType → finance default mapping key + normal balance side. */
export const GST_GL_BUCKETS: GstGlBucket[] = [
  { taxType: 'OUTPUT_CGST', mappingKey: 'GST_OUTPUT_CGST', side: 'LIABILITY_CREDIT_NET', label: 'Output CGST' },
  { taxType: 'OUTPUT_SGST', mappingKey: 'GST_OUTPUT_SGST', side: 'LIABILITY_CREDIT_NET', label: 'Output SGST' },
  { taxType: 'OUTPUT_IGST', mappingKey: 'GST_OUTPUT_IGST', side: 'LIABILITY_CREDIT_NET', label: 'Output IGST' },
  { taxType: 'OUTPUT_CESS', mappingKey: 'GST_OUTPUT_CESS', side: 'LIABILITY_CREDIT_NET', label: 'Output CESS' },
  { taxType: 'INPUT_CGST', mappingKey: 'GST_INPUT_CGST', side: 'ASSET_DEBIT_NET', label: 'Input CGST' },
  { taxType: 'INPUT_SGST', mappingKey: 'GST_INPUT_SGST', side: 'ASSET_DEBIT_NET', label: 'Input SGST' },
  { taxType: 'INPUT_IGST', mappingKey: 'GST_INPUT_IGST', side: 'ASSET_DEBIT_NET', label: 'Input IGST' },
  { taxType: 'INPUT_CESS', mappingKey: 'GST_INPUT_CESS', side: 'ASSET_DEBIT_NET', label: 'Input CESS' },
  { taxType: 'RCM_CGST', mappingKey: 'GST_RCM_CGST_PAYABLE', side: 'LIABILITY_CREDIT_NET', label: 'RCM CGST payable' },
  { taxType: 'RCM_SGST', mappingKey: 'GST_RCM_SGST_PAYABLE', side: 'LIABILITY_CREDIT_NET', label: 'RCM SGST payable' },
  { taxType: 'RCM_IGST', mappingKey: 'GST_RCM_IGST_PAYABLE', side: 'LIABILITY_CREDIT_NET', label: 'RCM IGST payable' },
]

export function buildPhase18CapabilityMatrix() {
  return {
    phase: 18,
    label: 'GST_SUBLEDGER_GL_RECON',
    fullGstCompliant: false,
    canClaimFullGstCompliant: false,
    portalLive: false,
    silentRetax: false,
    features: {
      periodBucketRecon: 'READY',
      mappingGapDetect: 'READY',
      varianceEvidence: 'READY',
      autoJournalFix: 'NOT_IN_SCOPE',
    },
    notes: [
      'Compares GST ledger taxAmount totals to mapped CoA period movement.',
      'Advisory only — does not post adjustments.',
      'Not portal LIVE · not FULL GST COMPLIANT.',
    ],
  }
}

export function returnPeriodToDateRange(returnPeriod: string): { fromDate: string; toDate: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(returnPeriod.trim())
  if (!m) throw new Error(`Invalid returnPeriod ${returnPeriod}`)
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) throw new Error(`Invalid returnPeriod month ${returnPeriod}`)
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    fromDate: `${y}-${pad(mo)}-01`,
    toDate: `${y}-${pad(mo)}-${pad(lastDay)}`,
  }
}

/** Liability: credit − debit; Asset: debit − credit. */
export function glPeriodNet(side: GstGlSide, debit: number, credit: number): number {
  const d = Number.isFinite(debit) ? debit : 0
  const c = Number.isFinite(credit) ? credit : 0
  return side === 'LIABILITY_CREDIT_NET' ? round2(c - d) : round2(d - c)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export type GlReconLine = {
  taxType: string
  mappingKey: string
  label: string
  side: GstGlSide
  accountId: string | null
  accountCode: string | null
  gstLedgerAmount: number
  glNetAmount: number
  variance: number
  absVariance: number
  status: 'MATCH' | 'VARIANCE' | 'UNMAPPED' | 'NO_ACTIVITY'
  message: string
}

export function compareGstToGlBucket(input: {
  bucket: GstGlBucket
  gstLedgerAmount: number
  glDebit: number
  glCredit: number
  accountId?: string | null
  accountCode?: string | null
  tolerance: number
}): GlReconLine {
  const gst = round2(input.gstLedgerAmount)
  const tolerance = Math.max(0, input.tolerance)
  if (!input.accountId) {
    const hasGst = Math.abs(gst) > tolerance
    return {
      taxType: input.bucket.taxType,
      mappingKey: input.bucket.mappingKey,
      label: input.bucket.label,
      side: input.bucket.side,
      accountId: null,
      accountCode: null,
      gstLedgerAmount: gst,
      glNetAmount: 0,
      variance: gst,
      absVariance: Math.abs(gst),
      status: hasGst ? 'UNMAPPED' : 'NO_ACTIVITY',
      message: hasGst
        ? `Mapping ${input.bucket.mappingKey} missing while GST ledger has ${gst}`
        : `No mapping and no GST ledger activity for ${input.bucket.taxType}`,
    }
  }

  const glNet = glPeriodNet(input.bucket.side, input.glDebit, input.glCredit)
  const variance = round2(gst - glNet)
  const absVariance = Math.abs(variance)
  if (Math.abs(gst) <= tolerance && Math.abs(glNet) <= tolerance) {
    return {
      taxType: input.bucket.taxType,
      mappingKey: input.bucket.mappingKey,
      label: input.bucket.label,
      side: input.bucket.side,
      accountId: input.accountId,
      accountCode: input.accountCode ?? null,
      gstLedgerAmount: gst,
      glNetAmount: glNet,
      variance: 0,
      absVariance: 0,
      status: 'NO_ACTIVITY',
      message: 'No material activity',
    }
  }
  if (absVariance <= tolerance) {
    return {
      taxType: input.bucket.taxType,
      mappingKey: input.bucket.mappingKey,
      label: input.bucket.label,
      side: input.bucket.side,
      accountId: input.accountId,
      accountCode: input.accountCode ?? null,
      gstLedgerAmount: gst,
      glNetAmount: glNet,
      variance: 0,
      absVariance: 0,
      status: 'MATCH',
      message: 'GST ledger agrees with GL control within tolerance',
    }
  }
  return {
    taxType: input.bucket.taxType,
    mappingKey: input.bucket.mappingKey,
    label: input.bucket.label,
    side: input.bucket.side,
    accountId: input.accountId,
    accountCode: input.accountCode ?? null,
    gstLedgerAmount: gst,
    glNetAmount: glNet,
    variance,
    absVariance,
    status: 'VARIANCE',
    message: `Variance ${variance} (GST ${gst} vs GL ${glNet})`,
  }
}

export function scoreGlReconHealth(lines: GlReconLine[]): {
  scorePct: number
  overall: 'HEALTHY' | 'ATTENTION' | 'CRITICAL'
  matchCount: number
  varianceCount: number
  unmappedCount: number
  totalAbsVariance: number
} {
  const matchCount = lines.filter((l) => l.status === 'MATCH' || l.status === 'NO_ACTIVITY').length
  const varianceCount = lines.filter((l) => l.status === 'VARIANCE').length
  const unmappedCount = lines.filter((l) => l.status === 'UNMAPPED').length
  const totalAbsVariance = round2(lines.reduce((s, l) => s + l.absVariance, 0))
  let score = 100
  score -= varianceCount * 12
  score -= unmappedCount * 15
  if (totalAbsVariance > 1000) score -= 20
  else if (totalAbsVariance > 100) score -= 10
  score = Math.max(0, Math.min(100, score))
  const overall = score >= 85 ? 'HEALTHY' : score >= 55 ? 'ATTENTION' : 'CRITICAL'
  return { scorePct: score, overall, matchCount, varianceCount, unmappedCount, totalAbsVariance }
}

export function buildReconSummary(lines: GlReconLine[], tolerance: number) {
  const health = scoreGlReconHealth(lines)
  return {
    tolerance,
    lines,
    health,
    fullGstCompliant: false as const,
    readyForCloseClaim: health.varianceCount === 0 && health.unmappedCount === 0,
    disclaimer:
      'Books GST vs GL advisory recon only — not portal LIVE, not FULL GST COMPLIANT, no auto GL fix.',
  }
}
