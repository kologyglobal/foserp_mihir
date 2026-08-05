/**
 * Phase 16 — GST rate master ops service (coverage, expiry, drift, impact).
 * Tenant-scoped. Reuses masters + GST ledger snapshots. Never re-taxes posted docs.
 */
import { randomUUID } from 'crypto'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, AppError, NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  buildPhase16CapabilityMatrix,
  buildRateChangeImpact,
  evaluateLedgerRateDrift,
  findExpiringRates,
  findRateCoverageGaps,
  findRateOverlaps,
  isPhase16RateOpsEnabled,
  scoreRateOpsHealth,
  type RateMasterLike,
} from './gst-rate-ops.util.js'
import type {
  GstRateOpsDriftQueryInput,
  GstRateOpsReportQueryInput,
  GstRateOpsRunCreateInput,
} from './tax-compliance.schemas.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

function assertFeatureOn(): void {
  if (!isPhase16RateOpsEnabled()) {
    throw new AppError(503, 'GST Phase 16 rate ops disabled (GST_PHASE16_RATE_OPS_ENABLED=false)', 'GST_PHASE16_DISABLED')
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toDateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function loadMasterRates(tenantId: string): Promise<RateMasterLike[]> {
  const rows = await prisma.masterGstRate.findMany({
    where: { tenantId, deletedAt: null },
    include: { gstGroup: { select: { code: true } } },
    take: 5000,
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    gstGroupId: r.gstGroupId,
    gstGroupCode: r.gstGroup?.code ?? null,
    dateFrom: toDateOnly(r.dateFrom),
    dateTo: r.dateTo ? toDateOnly(r.dateTo) : null,
    cgst: num(r.cgst),
    sgst: num(r.sgst),
    igst: num(r.igst),
    applicableFor: r.applicableFor,
    status: r.status,
  }))
}

async function loadGroups(tenantId: string) {
  const rows = await prisma.masterGstGroup.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true, status: true },
    take: 2000,
  })
  return rows
}

export function getRateOpsCapability(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage')
  return {
    ...buildPhase16CapabilityMatrix(),
    featureEnabled: isPhase16RateOpsEnabled(),
  }
}

export async function getRateOpsCoverage(req: Request, tenantId: string, query: GstRateOpsReportQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  const asOfDate = query.asOfDate ?? new Date().toISOString().slice(0, 10)
  const [groups, rates] = await Promise.all([loadGroups(tenantId), loadMasterRates(tenantId)])
  const gaps = findRateCoverageGaps({ groups, rates, asOfDate })
  const overlaps = findRateOverlaps(rates)
  const expiring = findExpiringRates({
    rates,
    asOfDate,
    horizonDays: query.horizonDays ?? 30,
  })
  const health = scoreRateOpsHealth({
    gapCount: gaps.length,
    expiringCount: expiring.length,
    overlapCount: overlaps.length,
    driftCount: 0,
    criticalDriftCount: 0,
  })
  return {
    asOfDate,
    activeGroupCount: groups.filter((g) => g.status === 'ACTIVE').length,
    activeRateCount: rates.filter((r) => r.status === 'ACTIVE').length,
    gaps,
    overlaps,
    expiring,
    health,
    note: 'Coverage from MasterGstGroup / MasterGstRate. Fix gaps in masters module; Phase 16 does not invent rates.',
  }
}

export async function getRateOpsDrift(req: Request, tenantId: string, query: GstRateOpsDriftQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.reconcile', 'tax.gst.setup.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const rates = await loadMasterRates(tenantId)
  const ledger = await prisma.gstLedgerEntry.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      returnPeriod: query.returnPeriod,
      ...(query.companyGstin
        ? { companyGstin: query.companyGstin.trim().toUpperCase() }
        : {}),
    },
    select: {
      documentId: true,
      documentNumber: true,
      documentDate: true,
      documentLineId: true,
      taxType: true,
      taxRate: true,
      taxAmount: true,
      sourceSnapshot: true,
      hsnSacCode: true,
    },
    take: 10000,
  })

  const samplesRaw = ledger.map((row) => {
    const snap =
      row.sourceSnapshot && typeof row.sourceSnapshot === 'object'
        ? (row.sourceSnapshot as Record<string, unknown>)
        : null
    return {
      documentId: row.documentId,
      documentNumber: row.documentNumber,
      documentDate: toDateOnly(row.documentDate),
      documentLineId: row.documentLineId || null,
      gstGroupId: (snap?.gstGroupId as string | undefined) ?? null,
      taxType: row.taxType,
      taxRate: num(row.taxRate),
      taxAmount: num(row.taxAmount),
      itemId: (snap?.itemId as string | undefined) ?? null,
      hsnSacCode: row.hsnSacCode ?? null,
    }
  })

  // Resolve missing gstGroupId via MasterItem (Phase 16 continuity — no re-tax).
  const itemIds = [...new Set(samplesRaw.map((s) => s.itemId).filter(Boolean))] as string[]
  const itemGroupMap = new Map<string, string>()
  if (itemIds.length) {
    const items = await prisma.masterItem.findMany({
      where: { tenantId, id: { in: itemIds }, deletedAt: null },
      select: { id: true, gstGroupId: true },
    })
    for (const it of items) {
      if (it.gstGroupId) itemGroupMap.set(it.id, it.gstGroupId)
    }
  }

  // Fallback: HSN → group
  const hsnCodes = [
    ...new Set(
      samplesRaw
        .filter((s) => !s.gstGroupId && !s.itemId && s.hsnSacCode)
        .map((s) => s.hsnSacCode as string),
    ),
  ]
  const hsnGroupMap = new Map<string, string>()
  if (hsnCodes.length) {
    const hsns = await prisma.masterHsnCode.findMany({
      where: { tenantId, code: { in: hsnCodes }, deletedAt: null },
      select: { code: true, gstGroupId: true },
      take: 2000,
    })
    for (const h of hsns) {
      if (h.gstGroupId) hsnGroupMap.set(h.code, h.gstGroupId)
    }
  }

  const samples = samplesRaw.map((s) => ({
    documentId: s.documentId,
    documentNumber: s.documentNumber,
    documentDate: s.documentDate,
    documentLineId: s.documentLineId,
    gstGroupId:
      s.gstGroupId ??
      (s.itemId ? itemGroupMap.get(s.itemId) ?? null : null) ??
      (s.hsnSacCode ? hsnGroupMap.get(s.hsnSacCode) ?? null : null),
    taxType: s.taxType,
    taxRate: s.taxRate,
    taxAmount: s.taxAmount,
  }))

  const findings = evaluateLedgerRateDrift({
    samples,
    rates,
    tolerancePct: query.tolerancePct,
  })
  const impact = buildRateChangeImpact(samples).map((row) => {
    const code = rates.find((r) => r.gstGroupId === row.gstGroupId)?.gstGroupCode ?? null
    return { ...row, gstGroupCode: code }
  })
  const criticalDriftCount = findings.filter((f) => f.severity === 'CRITICAL').length
  const health = scoreRateOpsHealth({
    gapCount: 0,
    expiringCount: 0,
    overlapCount: 0,
    driftCount: findings.length,
    criticalDriftCount,
  })

  return {
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    sampleCount: samples.length,
    findings: findings.slice(0, query.limit ?? 200),
    findingTotal: findings.length,
    impact: impact.slice(0, 50),
    health,
    disclaimer:
      'Advisory drift only. Posted ledger rows and document tax snapshots are immutable. Correct future docs via masters / re-issue CN; never silent re-resolve for returns.',
  }
}

export async function getRateOpsFullReport(req: Request, tenantId: string, query: GstRateOpsDriftQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage')
  assertFeatureOn()

  const asOfDate =
    query.returnPeriod && /^\d{4}-\d{2}$/.test(query.returnPeriod)
      ? `${query.returnPeriod}-15`
      : new Date().toISOString().slice(0, 10)

  const [coverage, drift] = await Promise.all([
    getRateOpsCoverage(req, tenantId, {
      asOfDate,
      horizonDays: 30,
    }),
    getRateOpsDrift(req, tenantId, query),
  ])

  const health = scoreRateOpsHealth({
    gapCount: coverage.gaps.length,
    expiringCount: coverage.expiring.length,
    overlapCount: coverage.overlaps.length,
    driftCount: drift.findingTotal,
    criticalDriftCount: drift.findings.filter((f) => f.severity === 'CRITICAL').length,
  })

  return {
    phase: 16 as const,
    verdict: 'READY_WITH_CONDITIONS' as const,
    notFullGstCompliant: true as const,
    coverage,
    drift,
    health,
    capability: buildPhase16CapabilityMatrix(),
    collisionNote:
      'Phases 12–15 (portal/sessions, hardening, annual, notices/audit packs) untouched. Phase 16 is rate master ops only.',
  }
}

export async function listRateOpsRuns(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  page = 1,
  pageSize = 20,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.rates.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const where = { tenantId, legalEntityId }
  const [total, items] = await Promise.all([
    prisma.gstRateOpsRun.count({ where }),
    prisma.gstRateOpsRun.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return {
    items: items.map(mapRun),
    total,
    page,
    pageSize,
  }
}

export async function createRateOpsRun(req: Request, tenantId: string, body: GstRateOpsRunCreateInput) {
  assertAny(req, 'tax.gst.setup.manage', 'tax.gst.rates.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, body.legalEntityId)

  const report = await getRateOpsFullReport(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    companyGstin: body.companyGstin ?? undefined,
    tolerancePct: body.tolerancePct,
    limit: 500,
  })

  const userId = req.context?.userId ?? null
  const id = randomUUID()
  const row = await prisma.gstRateOpsRun.create({
    data: {
      id,
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: body.companyGstin?.trim().toUpperCase() || null,
      returnPeriod: body.returnPeriod,
      asOfDate: new Date(`${report.coverage.asOfDate}T00:00:00.000Z`),
      runKind: body.runKind ?? 'FULL_REPORT',
      status: 'GENERATED',
      gapCount: report.coverage.gaps.length,
      expiringCount: report.coverage.expiring.length,
      overlapCount: report.coverage.overlaps.length,
      driftCount: report.drift.findingTotal,
      scorePct: report.health.scorePct,
      overall: report.health.overall,
      reportJson: report as unknown as Prisma.InputJsonValue,
      notes: body.notes?.trim() || null,
      generatedBy: userId,
      generatedAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    },
  })
  return mapRun(row)
}

export async function acknowledgeRateOpsRun(
  req: Request,
  tenantId: string,
  id: string,
  notes?: string | null,
) {
  assertAny(req, 'tax.gst.setup.manage', 'tax.gst.rates.manage')
  assertFeatureOn()
  const row = await prisma.gstRateOpsRun.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Rate ops run not found')
  const updated = await prisma.gstRateOpsRun.update({
    where: { id: row.id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy: req.context?.userId ?? null,
      notes: notes?.trim() || row.notes,
      updatedBy: req.context?.userId ?? null,
    },
  })
  return mapRun(updated)
}

function mapRun(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  returnPeriod: string
  asOfDate: Date
  runKind: string
  status: string
  gapCount: number
  expiringCount: number
  overlapCount: number
  driftCount: number
  scorePct: number
  overall: string
  notes: string | null
  generatedBy: string | null
  generatedAt: Date
  acknowledgedAt: Date | null
  acknowledgedBy: string | null
  reportJson?: unknown
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.returnPeriod,
    asOfDate: toDateOnly(row.asOfDate),
    runKind: row.runKind,
    status: row.status,
    gapCount: row.gapCount,
    expiringCount: row.expiringCount,
    overlapCount: row.overlapCount,
    driftCount: row.driftCount,
    scorePct: row.scorePct,
    overall: row.overall,
    notes: row.notes,
    generatedBy: row.generatedBy,
    generatedAt: row.generatedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: row.acknowledgedBy,
    report: row.reportJson ?? undefined,
    readinessLabel: 'GST_RATE_OPS_READY_WITH_CONDITIONS',
    disclaimer:
      'Stored rate-ops evidence run only. Not government filing, not FULL GST COMPLIANT.',
  }
}
