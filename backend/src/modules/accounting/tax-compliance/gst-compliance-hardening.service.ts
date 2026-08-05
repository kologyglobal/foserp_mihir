/**
 * Phase 13 — go-live UAT gate + period books readiness service.
 * Observes Phase 5 returns / Phase 8 payment / Phase 3 2B / Phase 12 filing sessions.
 * Does not own notices (Phase 15) or GSTR-9 worksheets (Phase 14). Does not LIVE-file.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AppError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { buildLiabilityProposal } from './gst-payment-liability.util.js'
import { loadLedgerRowsForPeriod } from './gst-registers.service.js'
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
  type PeriodFilingSessionFact,
  type PeriodReturnFact,
  type UatAxisId,
} from './gst-compliance-hardening.util.js'

function assertHardeningEnabled() {
  if (!isPhase13HardeningEnabled()) {
    throw new AppError(503, 'GST Phase 13 hardening is disabled', 'GST_PHASE13_DISABLED')
  }
}

async function resolveCompanyGstin(
  tenantId: string,
  legalEntityId: string,
  companyGstin?: string | null,
): Promise<string> {
  const le = await getLegalEntityOrThrow(tenantId, legalEntityId)
  const g = (companyGstin ?? le.gstin ?? '').trim().toUpperCase()
  if (!g) {
    throw new AppError(422, 'Legal entity has no GSTIN — set GSTIN before compliance workspace', 'GSTIN_REQUIRED')
  }
  return g
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const UAT_AXIS_IDS: UatAxisId[] = [
  'LIVE_IRN',
  'LIVE_EWAY',
  'GSTR_1_3B_RECON',
  'GSTR_2B_RECON',
  'PAYMENT',
  'MULTI_GSTIN',
  'STATUTORY_UAT',
]

function parseChecklist(raw: unknown): Record<
  UatAxisId,
  { passed: boolean; evidenceRef?: string | null; notes?: string | null }
> {
  const base = buildEmptyUatChecklist()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const id of UAT_AXIS_IDS) {
    const cell = o[id]
    if (cell && typeof cell === 'object') {
      const c = cell as Record<string, unknown>
      base[id] = {
        passed: Boolean(c.passed),
        evidenceRef: (c.evidenceRef as string | null | undefined) ?? null,
        notes: (c.notes as string | null | undefined) ?? null,
      }
    }
  }
  return base
}

async function loadPeriodFacts(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin: string
}): Promise<{ facts: PeriodComplianceFacts; liabilityProposal: ReturnType<typeof buildLiabilityProposal> }> {
  const ledger = await loadLedgerRowsForPeriod({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: params.companyGstin,
  })

  const proposal = buildLiabilityProposal(ledger)

  const returnRows = await prisma.gstrReturnPeriod.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin: params.companyGstin,
      returnPeriod: params.returnPeriod,
    },
  })

  const returns: PeriodReturnFact[] = returnRows.map((r) => ({
    returnType: r.returnType === 'GSTR1' ? 'GSTR1' : 'GSTR3B',
    status: r.status,
    hasSnapshot: r.snapshotJson != null,
    lockedOrFiled: returnStatusIsLockedOrFiled(r.status),
  }))

  let gstr1Snapshot: unknown = null
  let gstr3bSnapshot: unknown = null
  for (const r of returnRows) {
    if (r.returnType === 'GSTR1') gstr1Snapshot = r.snapshotJson
    if (r.returnType === 'GSTR3B') gstr3bSnapshot = r.snapshotJson
  }

  const challans = await prisma.gstPaymentChallan.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin: params.companyGstin,
      returnPeriod: params.returnPeriod,
      status: { not: 'VOID' },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const paymentStatusRank: Record<string, number> = {
    CLOSED: 5,
    POSTED_GL: 4,
    CONFIRMED_EXTERNAL: 3,
    PROPOSED: 2,
    DRAFT: 1,
  }
  let best = challans[0] ?? null
  for (const c of challans) {
    if (!best) best = c
    else if ((paymentStatusRank[c.status] ?? 0) > (paymentStatusRank[best.status] ?? 0)) best = c
  }

  const openFollowUps = await prisma.gstr2bVendorFollowUp.count({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      status: 'OPEN',
    },
  })

  const unmatched2b = await prisma.gstr2bImportRow.count({
    where: {
      tenantId: params.tenantId,
      matchStatus: {
        in: [
          'UNMATCHED',
          'PARTIAL_MATCH',
          'MISSING_IN_BOOKS',
          'MISSING_IN_2B',
          'VALUE_MISMATCH',
          'TAX_MISMATCH',
          'GSTIN_MISMATCH',
          'DUPLICATE',
          'REVIEW_REQUIRED',
        ],
      },
      batch: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        returnPeriod: params.returnPeriod,
        status: { not: 'VOID' },
      },
    },
  })

  let openNotices = 0
  try {
    openNotices = await prisma.gstComplianceNotice.count({
      where: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'RESPONDED'] },
      },
    })
  } catch {
    openNotices = 0
  }

  let filingSessions: PeriodFilingSessionFact[] = [
    { returnType: 'GSTR1', sessionStatus: null, providerMode: null },
    { returnType: 'GSTR3B', sessionStatus: null, providerMode: null },
  ]
  try {
    const sessions = await prisma.gstrFilingSession.findMany({
      where: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        companyGstin: params.companyGstin,
        returnPeriod: params.returnPeriod,
      },
      orderBy: { updatedAt: 'desc' },
    })
    const latestByType = new Map<string, (typeof sessions)[0]>()
    for (const s of sessions) {
      if (!latestByType.has(s.returnType)) latestByType.set(s.returnType, s)
    }
    filingSessions = (['GSTR1', 'GSTR3B'] as const).map((rt) => {
      const hit = latestByType.get(rt)
      return {
        returnType: rt,
        sessionStatus: hit?.status ?? null,
        providerMode: hit?.providerMode ?? null,
      }
    })
  } catch {
    // Phase 12 table optional until migrate
  }

  const facts: PeriodComplianceFacts = {
    returnPeriod: params.returnPeriod,
    companyGstin: params.companyGstin,
    ledgerRowCount: ledger.length,
    ledgerUnfiledCount: ledger.filter(
      (r) => r.filingStatus !== 'FILED' && r.filingStatus !== 'INCLUDED_IN_DRAFT',
    ).length,
    ledgerFiledCount: ledger.filter((r) => r.filingStatus === 'FILED').length,
    ledgerNullCompanyGstinCount: ledger.filter((r) => !r.companyGstin).length,
    booksLiabilityTotal: proposal.totalLiability,
    booksItcTotal: proposal.totalItc,
    booksNetTaxPayable: proposal.netTaxPayable,
    gstr1TotalTax: extractTaxTotalFromSnapshot(gstr1Snapshot, 'gstr1'),
    gstr3bTotalLiability: extractTaxTotalFromSnapshot(gstr3bSnapshot, 'gstr3b'),
    returns,
    payment: {
      activeCount: challans.length,
      bestStatus: best?.status ?? null,
      netTaxPayable: best ? num(best.netTaxPayable) : 0,
      totalPayable: best ? num(best.totalPayable) : 0,
    },
    openGstr2bFollowUps: openFollowUps,
    gstr2bUnmatchedRows: unmatched2b,
    openNotices,
    filingSessions,
  }

  return { facts, liabilityProposal: proposal }
}

export function getReadinessMatrix() {
  return buildPhase13ReadinessMatrix({
    featureEnabled: isPhase13HardeningEnabled(),
    portalFilingPresent: true,
  })
}

export async function getPeriodHealth(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}) {
  assertHardeningEnabled()
  const companyGstin = await resolveCompanyGstin(params.tenantId, params.legalEntityId, params.companyGstin)
  const { facts, liabilityProposal } = await loadPeriodFacts({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin,
  })
  const findings = reconcilePeriodBooks(facts)
  const health = scorePeriodHealth(findings)
  const preFile = evaluatePreFileReadiness(health, facts)
  return {
    legalEntityId: params.legalEntityId,
    companyGstin,
    returnPeriod: params.returnPeriod,
    facts,
    health,
    preFile,
    liabilityProposal: {
      totalLiability: liabilityProposal.totalLiability,
      totalItc: liabilityProposal.totalItc,
      netTaxPayable: liabilityProposal.netTaxPayable,
      totalPayable: liabilityProposal.totalPayable,
    },
    readinessLabel: health.readinessLabel,
    notFullGstCompliant: true as const,
    disclaimer: health.disclaimer,
  }
}

export async function getPeriodReconcile(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}) {
  return getPeriodHealth(params)
}

export async function getGoLiveGate(params: {
  tenantId: string
  legalEntityId: string
  companyGstin?: string | null
}) {
  assertHardeningEnabled()
  await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)

  const approved = await prisma.gstComplianceUatSignOff.findFirst({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      status: 'APPROVED',
      ...(params.companyGstin
        ? { companyGstin: params.companyGstin.trim().toUpperCase() }
        : {}),
    },
    orderBy: { approvedAt: 'desc' },
  })

  const checklist = parseChecklist(approved?.checklistJson)
  const signedAxisIds = UAT_AXIS_IDS.filter((id) => checklist[id]?.passed)

  // Ops "tested" signals derived from latest APPROVED sign-off axes; otherwise false.
  const gate = evaluateGoLiveGate({
    liveIrnTested: checklist.LIVE_IRN.passed,
    liveEwayTested: checklist.LIVE_EWAY.passed,
    gstrReconTested: checklist.GSTR_1_3B_RECON.passed,
    gstr2bReconTested: checklist.GSTR_2B_RECON.passed,
    paymentTested: checklist.PAYMENT.passed,
    multiGstinTested: checklist.MULTI_GSTIN.passed,
    signedAxisIds,
  })

  return {
    legalEntityId: params.legalEntityId,
    companyGstin: params.companyGstin?.trim().toUpperCase() ?? null,
    latestApprovedSignOffId: approved?.id ?? null,
    gate,
    notFullGstCompliant: true as const,
    canClaimFullGstCompliant: false as const,
  }
}

// ─── UAT sign-off lifecycle ──────────────────────────────────────────────────

export async function listUatSignOffs(params: {
  tenantId: string
  legalEntityId: string
  companyGstin?: string | null
}) {
  assertHardeningEnabled()
  const items = await prisma.gstComplianceUatSignOff.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      ...(params.companyGstin
        ? { companyGstin: params.companyGstin.trim().toUpperCase() }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return {
    items: items.map(mapSignOff),
    disclaimer: 'UAT sign-off register only — not FULL GST COMPLIANT and not portal LIVE certify.',
  }
}

export async function createUatSignOff(params: {
  tenantId: string
  legalEntityId: string
  companyGstin?: string | null
  checklist?: Record<string, { passed?: boolean; evidenceRef?: string | null; notes?: string | null }>
  notes?: string | null
  userId?: string | null
}) {
  assertHardeningEnabled()
  await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)
  const companyGstin = params.companyGstin ? params.companyGstin.trim().toUpperCase() : null
  const checklist = parseChecklist(params.checklist ?? buildEmptyUatChecklist())
  const axesPassed = UAT_AXIS_IDS.filter((id) => checklist[id].passed).length

  const row = await prisma.gstComplianceUatSignOff.create({
    data: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin,
      status: 'DRAFT',
      checklistJson: checklist as unknown as Prisma.InputJsonValue,
      overallAxesPassed: axesPassed,
      overallAxesTotal: UAT_AXIS_IDS.length,
      notes: params.notes ?? null,
      createdBy: params.userId ?? null,
    },
  })
  return mapSignOff(row)
}

export async function updateUatSignOffChecklist(params: {
  tenantId: string
  id: string
  checklist: Record<string, { passed?: boolean; evidenceRef?: string | null; notes?: string | null }>
  notes?: string | null
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceUatSignOff.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'UAT sign-off not found', 'UAT_SIGNOFF_NOT_FOUND')
  if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
    throw new AppError(422, `Cannot edit checklist in status ${existing.status}`, 'UAT_INVALID_STATE')
  }
  const checklist = parseChecklist({ ...parseChecklist(existing.checklistJson), ...params.checklist })
  const axesPassed = UAT_AXIS_IDS.filter((id) => checklist[id].passed).length
  const row = await prisma.gstComplianceUatSignOff.update({
    where: { id: existing.id },
    data: {
      checklistJson: checklist as unknown as Prisma.InputJsonValue,
      overallAxesPassed: axesPassed,
      overallAxesTotal: UAT_AXIS_IDS.length,
      notes: params.notes ?? existing.notes,
      updatedBy: params.userId ?? null,
    },
  })
  return mapSignOff(row)
}

export async function submitUatSignOff(params: {
  tenantId: string
  id: string
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceUatSignOff.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'UAT sign-off not found', 'UAT_SIGNOFF_NOT_FOUND')
  if (existing.status !== 'DRAFT') {
    throw new AppError(422, `Can only submit from DRAFT (now ${existing.status})`, 'UAT_INVALID_STATE')
  }
  const checklist = parseChecklist(existing.checklistJson)
  const gate = evaluateGoLiveGate({
    liveIrnTested: checklist.LIVE_IRN.passed,
    liveEwayTested: checklist.LIVE_EWAY.passed,
    gstrReconTested: checklist.GSTR_1_3B_RECON.passed,
    gstr2bReconTested: checklist.GSTR_2B_RECON.passed,
    paymentTested: checklist.PAYMENT.passed,
    multiGstinTested: checklist.MULTI_GSTIN.passed,
    signedAxisIds: UAT_AXIS_IDS.filter((id) => checklist[id].passed),
  })
  const row = await prisma.gstComplianceUatSignOff.update({
    where: { id: existing.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedBy: params.userId ?? null,
      gateSnapshotJson: gate as unknown as Prisma.InputJsonValue,
      updatedBy: params.userId ?? null,
    },
  })
  return mapSignOff(row)
}

export async function approveUatSignOff(params: {
  tenantId: string
  id: string
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceUatSignOff.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'UAT sign-off not found', 'UAT_SIGNOFF_NOT_FOUND')
  if (existing.status !== 'SUBMITTED') {
    throw new AppError(422, `Can only approve from SUBMITTED (now ${existing.status})`, 'UAT_INVALID_STATE')
  }
  if (params.userId && existing.submittedBy && params.userId === existing.submittedBy) {
    throw new AppError(422, 'Checker cannot be the same user as maker (submitter)', 'UAT_MAKER_CHECKER')
  }
  const row = await prisma.gstComplianceUatSignOff.update({
    where: { id: existing.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: params.userId ?? null,
      updatedBy: params.userId ?? null,
    },
  })
  return {
    ...mapSignOff(row),
    notFullGstCompliant: true as const,
    canClaimFullGstCompliant: false as const,
    note: 'Approved UAT register does not authorize FULL GST COMPLIANT marketing label by itself.',
  }
}

export async function revokeUatSignOff(params: {
  tenantId: string
  id: string
  reason: string
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceUatSignOff.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'UAT sign-off not found', 'UAT_SIGNOFF_NOT_FOUND')
  if (existing.status === 'REVOKED') return mapSignOff(existing)
  if (existing.status === 'DRAFT') {
    throw new AppError(422, 'Revoke DRAFT by discarding; only SUBMITTED/APPROVED can be revoked', 'UAT_INVALID_STATE')
  }
  const row = await prisma.gstComplianceUatSignOff.update({
    where: { id: existing.id },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedBy: params.userId ?? null,
      revokeReason: params.reason.trim(),
      updatedBy: params.userId ?? null,
    },
  })
  return mapSignOff(row)
}

function mapSignOff(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  status: string
  checklistJson: unknown
  gateSnapshotJson: unknown
  overallAxesPassed: number
  overallAxesTotal: number
  submittedAt: Date | null
  submittedBy: string | null
  approvedAt: Date | null
  approvedBy: string | null
  revokedAt: Date | null
  revokedBy: string | null
  revokeReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    status: row.status,
    checklist: parseChecklist(row.checklistJson),
    gateSnapshot: row.gateSnapshotJson,
    overallAxesPassed: row.overallAxesPassed,
    overallAxesTotal: row.overallAxesTotal,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submittedBy: row.submittedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedBy: row.revokedBy,
    revokeReason: row.revokeReason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    notFullGstCompliant: true as const,
  }
}

// ─── Shared foundation methods used by Phase 15 ops facade ───────────────────
// Persist onto Phase 15 tables (`gst_audit_export_packs`, `gst_compliance_notices`).

const NOTICE_KINDS = new Set([
  'GST_ASMT',
  'GST_DRC',
  'GST_FORM',
  'GSTR_NOTICE',
  'EWAY_NOTICE',
  'EINVOICE_NOTICE',
  'OTHER',
])

export async function generateAuditPack(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  userId?: string | null
  notes?: string | null
}) {
  assertHardeningEnabled()
  const companyGstin = await resolveCompanyGstin(params.tenantId, params.legalEntityId, params.companyGstin)
  const healthPayload = await getPeriodHealth({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin,
  })
  if (healthPayload.health.blockerCount > 0) {
    throw new AppError(
      422,
      `Cannot freeze audit pack with ${healthPayload.health.blockerCount} blocker(s)`,
      'AUDIT_PACK_BLOCKED',
      undefined,
      { findings: healthPayload.health.findings.filter((f) => f.severity === 'BLOCKER') },
    )
  }

  const manifest = {
    schemaVersion: 1,
    phase: 13,
    notFullGstCompliant: true as const,
    returnPeriod: params.returnPeriod,
    companyGstin,
    health: healthPayload.health,
    facts: healthPayload.facts,
    preFile: healthPayload.preFile,
    liabilityProposal: healthPayload.liabilityProposal,
    generatedAt: new Date().toISOString(),
    generatedBy: params.userId ?? null,
    disclaimer: 'Period audit freeze (books-side). Not portal filing. Not FULL GST COMPLIANT.',
  }

  const row = await prisma.gstAuditExportPack.create({
    data: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin,
      periodFrom: params.returnPeriod,
      periodTo: params.returnPeriod,
      status: 'GENERATED',
      packageVersion: 1,
      manifestJson: manifest as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
      generatedBy: params.userId ?? null,
      notes: params.notes ?? null,
    },
  })
  return mapAuditPack(row)
}

export async function listAuditPacks(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod?: string
  companyGstin?: string | null
}) {
  assertHardeningEnabled()
  const items = await prisma.gstAuditExportPack.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      status: 'GENERATED',
      ...(params.returnPeriod
        ? { periodFrom: params.returnPeriod, periodTo: params.returnPeriod }
        : {}),
      ...(params.companyGstin ? { companyGstin: params.companyGstin.trim().toUpperCase() } : {}),
    },
    orderBy: { generatedAt: 'desc' },
    take: 50,
  })
  return {
    items: items.map(mapAuditPack),
    disclaimer: 'Books-side audit packs. Not portal payloads. Not FULL GST COMPLIANT.',
  }
}

export async function getAuditPack(params: { tenantId: string; id: string }) {
  assertHardeningEnabled()
  const row = await prisma.gstAuditExportPack.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!row) throw new AppError(404, 'Audit pack not found', 'AUDIT_PACK_NOT_FOUND')
  return mapAuditPack(row)
}

export async function archiveAuditPack(params: {
  tenantId: string
  id: string
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstAuditExportPack.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'Audit pack not found', 'AUDIT_PACK_NOT_FOUND')
  if (existing.status === 'VOID') return mapAuditPack(existing)
  const row = await prisma.gstAuditExportPack.update({
    where: { id: existing.id },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidedBy: params.userId ?? null,
      voidReason: 'Archived via Phase 13 / ops facade',
    },
  })
  return mapAuditPack(row)
}

function mapAuditPack(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  periodFrom: string
  periodTo: string
  status: string
  manifestJson: unknown
  generatedAt: Date
  generatedBy: string | null
  notes: string | null
  voidedAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.periodFrom,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    status: row.status === 'VOID' ? 'ARCHIVED' : row.status,
    pack: row.manifestJson,
    checklist: null,
    blockerCount: 0,
    warningCount: 0,
    exceptionCount: 0,
    digestHash: null,
    generatedAt: row.generatedAt.toISOString(),
    generatedBy: row.generatedBy,
    archivedAt: row.voidedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    notFullGstCompliant: true as const,
    disclaimer: 'Frozen books-side audit pack. Not portal filing. Not FULL GST COMPLIANT.',
  }
}

export async function listNotices(params: {
  tenantId: string
  legalEntityId: string
  companyGstin?: string | null
  status?: string
}) {
  assertHardeningEnabled()
  const items = await prisma.gstComplianceNotice.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      ...(params.companyGstin ? { companyGstin: params.companyGstin.trim().toUpperCase() } : {}),
      ...(params.status
        ? {
            status: (params.status === 'VOID'
              ? 'WAIVED'
              : params.status === 'ACKNOWLEDGED'
                ? 'IN_PROGRESS'
                : params.status) as never,
          }
        : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { issuedOn: 'desc' }],
    take: 200,
  })
  return {
    items: items.map(mapNoticeCompat),
    note: 'Books-side notice register (Phase 15 table via Phase 13 foundation).',
  }
}

export async function createNotice(params: {
  tenantId: string
  legalEntityId: string
  companyGstin?: string | null
  noticeRef: string
  noticeDate: string
  noticeType: string
  subject: string
  dueDate?: string | null
  amountDemanded?: number | null
  notes?: string | null
  userId?: string | null
}) {
  assertHardeningEnabled()
  const companyGstin = params.companyGstin
    ? params.companyGstin.trim().toUpperCase()
    : (await resolveCompanyGstin(params.tenantId, params.legalEntityId, null).catch(() => null))
  const kindRaw = params.noticeType.trim().toUpperCase()
  const noticeKind = (NOTICE_KINDS.has(kindRaw) ? kindRaw : 'OTHER') as never
  const amountNote =
    params.amountDemanded != null && params.amountDemanded > 0
      ? `Amount demanded: ${params.amountDemanded}`
      : null
  const notes = [params.notes, amountNote].filter(Boolean).join(' · ') || null
  const row = await prisma.gstComplianceNotice.create({
    data: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin,
      noticeKind,
      status: 'OPEN',
      referenceNo: params.noticeRef.trim(),
      authority: 'MANUAL',
      summary: params.subject.trim(),
      issuedOn: new Date(`${params.noticeDate}T00:00:00.000Z`),
      dueDate: params.dueDate ? new Date(`${params.dueDate}T00:00:00.000Z`) : null,
      notes,
      createdBy: params.userId ?? null,
    },
  })
  return mapNoticeCompat(row)
}

export async function respondNotice(params: {
  tenantId: string
  id: string
  responseNotes: string
  userId?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceNotice.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'Notice not found', 'NOTICE_NOT_FOUND')
  if (existing.status === 'CLOSED' || existing.status === 'WAIVED') {
    throw new AppError(422, `Cannot respond to notice in status ${existing.status}`, 'NOTICE_INVALID_STATE')
  }
  const row = await prisma.gstComplianceNotice.update({
    where: { id: existing.id },
    data: {
      status: 'RESPONDED',
      responseSummary: params.responseNotes.trim(),
      responseSubmittedOn: new Date(),
      updatedBy: params.userId ?? null,
    },
  })
  return mapNoticeCompat(row)
}

export async function closeNotice(params: {
  tenantId: string
  id: string
  userId?: string | null
  notes?: string | null
}) {
  assertHardeningEnabled()
  const existing = await prisma.gstComplianceNotice.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!existing) throw new AppError(404, 'Notice not found', 'NOTICE_NOT_FOUND')
  if (existing.status === 'WAIVED') {
    throw new AppError(422, 'Notice is waived/void', 'NOTICE_INVALID_STATE')
  }
  const row = await prisma.gstComplianceNotice.update({
    where: { id: existing.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: params.userId ?? null,
      notes: params.notes ?? existing.notes,
      updatedBy: params.userId ?? null,
    },
  })
  return mapNoticeCompat(row)
}

function mapNoticeCompat(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  noticeKind: string
  status: string
  referenceNo: string
  summary: string
  issuedOn: Date
  dueDate: Date | null
  responseSummary: string | null
  responseSubmittedOn: Date | null
  closedAt: Date | null
  notes: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    noticeRef: row.referenceNo,
    noticeDate: row.issuedOn.toISOString().slice(0, 10),
    noticeType: row.noticeKind,
    noticeKind: row.noticeKind,
    status: row.status,
    subject: row.summary,
    summary: row.summary,
    referenceNo: row.referenceNo,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    amountDemanded: 0,
    responseNotes: row.responseSummary,
    responseSummary: row.responseSummary,
    respondedAt: row.responseSubmittedOn?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Lightweight FY rollup for Phase 15 GSTR-9 foundation endpoint (Phase 14 owns worksheets). */
export async function getGstr9Foundation(params: {
  tenantId: string
  legalEntityId: string
  financialYear: string
  companyGstin?: string | null
}) {
  assertHardeningEnabled()
  const m = params.financialYear.trim().match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    throw new AppError(422, 'financialYear must be YYYY-YY (e.g. 2025-26)', 'INVALID_FINANCIAL_YEAR')
  }
  const startY = Number(m[1])
  const endY = startY + 1
  if (endY % 100 !== Number(m[2])) {
    throw new AppError(422, 'financialYear must be YYYY-YY (e.g. 2025-26)', 'INVALID_FINANCIAL_YEAR')
  }
  const months: string[] = []
  for (let mo = 4; mo <= 12; mo++) months.push(`${startY}-${String(mo).padStart(2, '0')}`)
  for (let mo = 1; mo <= 3; mo++) months.push(`${endY}-${String(mo).padStart(2, '0')}`)

  const companyGstin = await resolveCompanyGstin(params.tenantId, params.legalEntityId, params.companyGstin)
  const returnRows = await prisma.gstrReturnPeriod.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin,
      returnPeriod: { in: months },
    },
  })

  const monthly = months.map((period) => {
    const g1 = returnRows.find((r) => r.returnPeriod === period && r.returnType === 'GSTR1')
    const g3 = returnRows.find((r) => r.returnPeriod === period && r.returnType === 'GSTR3B')
    return {
      returnPeriod: period,
      gstr1Status: g1?.status ?? null,
      gstr3bStatus: g3?.status ?? null,
      lockedBoth:
        !!g1 &&
        !!g3 &&
        returnStatusIsLockedOrFiled(g1.status) &&
        returnStatusIsLockedOrFiled(g3.status),
    }
  })

  return {
    legalEntityId: params.legalEntityId,
    companyGstin,
    financialYear: params.financialYear,
    financialYearLabel: params.financialYear,
    monthsExpected: months,
    monthsPresent: monthly.filter((mth) => mth.gstr1Status || mth.gstr3bStatus).map((mth) => mth.returnPeriod),
    monthsLockedBoth: monthly.filter((mth) => mth.lockedBoth).length,
    monthly,
    complete: monthly.every((mth) => mth.lockedBoth),
    notFullGstr9Engine: true as const,
    notFullGstCompliant: true as const,
    disclaimer:
      'GSTR-9 books foundation only — Phase 14 owns annual worksheets; not portal GSTR-9; not FULL GST COMPLIANT.',
  }
}
