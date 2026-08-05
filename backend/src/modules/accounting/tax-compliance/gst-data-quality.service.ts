/**
 * Phase 17 — GST data quality scan, companyGstin backfill, freeze checklist, evidence runs.
 */
import { randomUUID } from 'crypto'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, AppError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { normalizeGstin, resolveCompanyGstinScope } from './gst-registration-scope.util.js'
import {
  analyzeLedgerDataQuality,
  buildPeriodFreezeChecklist,
  buildPhase17CapabilityMatrix,
  isPhase17DataQualityEnabled,
  proposeGstinBackfillPlan,
  scoreDataQualityHealth,
  type LedgerQualityRowLike,
} from './gst-data-quality.util.js'
import type {
  GstDataQualityBackfillInput,
  GstDataQualityPeriodQueryInput,
  GstDataQualityRunCreateInput,
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
  if (!isPhase17DataQualityEnabled()) {
    throw new AppError(
      503,
      'GST Phase 17 data quality disabled (GST_PHASE17_DATA_QUALITY_ENABLED=false)',
      'GST_PHASE17_DISABLED',
    )
  }
}

function actorId(req: Request): string | null {
  return req.context?.userId ?? null
}

async function loadPeriodLedgerRows(
  tenantId: string,
  legalEntityId: string,
  returnPeriod: string,
): Promise<
  Array<
    LedgerQualityRowLike & {
      sourceSnapshot: Prisma.JsonValue | null
    }
  >
> {
  const rows = await prisma.gstLedgerEntry.findMany({
    where: { tenantId, legalEntityId, returnPeriod },
    select: {
      id: true,
      documentId: true,
      documentNumber: true,
      documentType: true,
      branchId: true,
      companyGstin: true,
      filingStatus: true,
      supplyClass: true,
      taxType: true,
      sourceSnapshot: true,
    },
    take: 20_000,
  })
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    documentNumber: r.documentNumber,
    documentType: r.documentType,
    branchId: r.branchId,
    companyGstin: r.companyGstin,
    filingStatus: r.filingStatus,
    supplyClass: r.supplyClass,
    taxType: r.taxType,
    sourceSnapshot: r.sourceSnapshot,
  }))
}

async function buildBranchLeMaps(tenantId: string, legalEntityId: string) {
  const [le, branches] = await Promise.all([
    prisma.legalEntity.findFirst({
      where: { id: legalEntityId, tenantId },
      select: { id: true, gstin: true, stateCode: true },
    }),
    prisma.branch.findMany({
      where: { tenantId, legalEntityId, isActive: true },
      select: { id: true, gstin: true, stateCode: true },
      take: 500,
    }),
  ])
  if (!le) throw new NotFoundError('Legal entity')
  return {
    le,
    branchById: new Map(branches.map((b) => [b.id, b])),
  }
}

function snapshotGstin(snap: Prisma.JsonValue | null | undefined): string | null {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null
  const o = snap as Record<string, unknown>
  return normalizeGstin((o.companyGstin as string) ?? (o.companyGstinSource as string) ?? null)
}

export function getDataQualityCapability(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage')
  return {
    ...buildPhase17CapabilityMatrix(),
    featureEnabled: isPhase17DataQualityEnabled(),
  }
}

export async function scanDataQuality(req: Request, tenantId: string, query: GstDataQualityPeriodQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.reconcile', 'tax.gst.setup.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const rows = await loadPeriodLedgerRows(tenantId, query.legalEntityId, query.returnPeriod)
  const quality = analyzeLedgerDataQuality(rows)

  const openRcm = await prisma.gstRcmRegisterEntry.count({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      returnPeriod: query.returnPeriod,
      status: 'LIABILITY_POSTED',
    },
  })

  const health = scoreDataQualityHealth({
    nullCompanyGstinCount: quality.nullCompanyGstinCount,
    filedWithNullGstinCount: quality.filedWithNullGstinCount,
    contaminated: quality.contaminated,
    unresolvableBackfill: 0,
    openRcmLiabilityCount: openRcm,
  })

  return {
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    quality,
    openRcmLiabilityCount: openRcm,
    health,
    fullGstCompliant: false,
    disclaimer: 'Books data quality only — not portal LIVE, not FULL GST COMPLIANT.',
  }
}

async function buildBackfillPlan(
  tenantId: string,
  legalEntityId: string,
  returnPeriod: string,
  limit: number,
) {
  const { le, branchById } = await buildBranchLeMaps(tenantId, legalEntityId)
  const rows = await loadPeriodLedgerRows(tenantId, legalEntityId, returnPeriod)

  const plan = proposeGstinBackfillPlan(rows, (row) => {
    const snap = snapshotGstin(row.sourceSnapshot)
    if (snap) {
      return { toGstin: snap, source: 'EXPLICIT_SNAPSHOT', reason: 'sourceSnapshot.companyGstin' }
    }
    const branch = row.branchId ? branchById.get(row.branchId) : null
    const scope = resolveCompanyGstinScope({
      legalEntityId: le.id,
      legalEntityGstin: le.gstin,
      legalEntityStateCode: le.stateCode,
      branchId: row.branchId,
      branchGstin: branch?.gstin,
      branchStateCode: branch?.stateCode,
    })
    if ('ok' in scope && scope.ok === false) return null
    if ('gstin' in scope) {
      return {
        toGstin: scope.gstin,
        source: scope.source === 'BRANCH' ? 'BRANCH' : 'LEGAL_ENTITY',
        reason: `resolveCompanyGstinScope(${scope.source})`,
      }
    }
    return null
  })

  return {
    legalEntityId,
    returnPeriod,
    plan: {
      ...plan,
      candidates: plan.candidates.slice(0, limit),
      candidateTotal: plan.candidates.length,
      applyLimit: limit,
    },
  }
}

export async function dryRunGstinBackfill(
  req: Request,
  tenantId: string,
  body: GstDataQualityBackfillInput,
) {
  assertAny(req, 'tax.gst.quality.manage', 'tax.gst.setup.manage', 'tax.gst.reconcile')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, body.legalEntityId)
  const limit = body.limit ?? 2000
  const built = await buildBackfillPlan(tenantId, body.legalEntityId, body.returnPeriod, limit)
  return {
    ...built,
    dryRun: true as const,
    disclaimer: 'Dry-run only — no ledger updates.',
  }
}

export async function applyGstinBackfill(
  req: Request,
  tenantId: string,
  body: GstDataQualityBackfillInput,
) {
  assertAny(req, 'tax.gst.quality.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  if (body.confirm !== true) {
    throw new ValidationError('confirm=true required to apply GSTIN backfill')
  }
  await getLegalEntityOrThrow(tenantId, body.legalEntityId)

  const limit = body.limit ?? 2000
  const built = await buildBackfillPlan(tenantId, body.legalEntityId, body.returnPeriod, limit)
  const slice = built.plan.candidates
  const actor = actorId(req)

  let updated = 0
  for (const c of slice) {
    const result = await prisma.gstLedgerEntry.updateMany({
      where: {
        id: c.ledgerEntryId,
        tenantId,
        companyGstin: null,
      },
      data: {
        companyGstin: c.toGstin,
        updatedAt: new Date(),
      },
    })
    updated += result.count
  }

  return {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    dryRun: false as const,
    requested: slice.length,
    updated,
    appliedBy: actor,
    notes: body.notes ?? null,
    disclaimer:
      'Only null companyGstin rows updated. Posted tax amounts unchanged. Not FULL GST COMPLIANT.',
  }
}

export async function getFreezeReadiness(
  req: Request,
  tenantId: string,
  query: GstDataQualityPeriodQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const scan = await scanDataQuality(req, tenantId, query)
  const dry = await buildBackfillPlan(tenantId, query.legalEntityId, query.returnPeriod, 5000)

  const periods = await prisma.gstrReturnPeriod.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      returnPeriod: query.returnPeriod,
      returnType: { in: ['GSTR1', 'GSTR3B'] },
    },
    select: { returnType: true, status: true },
    take: 10,
  })
  const gstr1Status = periods.find((p) => p.returnType === 'GSTR1')?.status ?? null
  const gstr3bStatus = periods.find((p) => p.returnType === 'GSTR3B')?.status ?? null

  const checklist = buildPeriodFreezeChecklist({
    quality: scan.quality,
    gstr1Status,
    gstr3bStatus,
    openRcmLiabilityCount: scan.openRcmLiabilityCount,
    backfillCandidateCount: dry.plan.candidateTotal,
    unresolvableCount: dry.plan.unresolvable.length,
  })

  return {
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    health: scan.health,
    checklist,
    quality: scan.quality,
    backfill: {
      candidateTotal: dry.plan.candidateTotal,
      unresolvable: dry.plan.unresolvable.length,
    },
    fullGstCompliant: false,
    disclaimer: checklist.summary,
  }
}

export async function listDataQualityRuns(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  page = 1,
  pageSize = 20,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.quality.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  const skip = (page - 1) * pageSize
  const where = { tenantId, legalEntityId }
  const [total, items] = await Promise.all([
    prisma.gstDataQualityRun.count({ where }),
    prisma.gstDataQualityRun.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ])
  return { items, total, page, pageSize }
}

export async function createDataQualityRun(
  req: Request,
  tenantId: string,
  body: GstDataQualityRunCreateInput,
) {
  assertAny(req, 'tax.gst.quality.manage', 'tax.gst.setup.manage')
  assertFeatureOn()

  const freeze = await getFreezeReadiness(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
  })
  const actor = actorId(req)
  const id = randomUUID()

  const row = await prisma.gstDataQualityRun.create({
    data: {
      id,
      tenantId,
      legalEntityId: body.legalEntityId,
      returnPeriod: body.returnPeriod,
      companyGstin: body.companyGstin ?? null,
      runKind: body.runKind ?? 'FULL_REPORT',
      status: 'GENERATED',
      nullGstinCount: freeze.quality.nullCompanyGstinCount,
      filedNullCount: freeze.quality.filedWithNullGstinCount,
      distinctGstinCount: freeze.quality.distinctGstins.length,
      backfillCandidateCount: freeze.backfill.candidateTotal,
      unresolvableCount: freeze.backfill.unresolvable,
      scorePct: freeze.health.scorePct,
      overall: freeze.health.overall,
      freezeReady: freeze.checklist.ready,
      reportJson: freeze as unknown as Prisma.InputJsonValue,
      notes: body.notes ?? null,
      generatedBy: actor,
      createdBy: actor,
      updatedBy: actor,
    },
  })

  return {
    ...row,
    disclaimer:
      'Stored data-quality evidence run only. Not government filing, not FULL GST COMPLIANT.',
  }
}

export async function acknowledgeDataQualityRun(
  req: Request,
  tenantId: string,
  id: string,
  notes?: string | null,
) {
  assertAny(req, 'tax.gst.quality.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const existing = await prisma.gstDataQualityRun.findFirst({ where: { id, tenantId } })
  if (!existing) throw new NotFoundError('Data quality run')
  const actor = actorId(req)
  return prisma.gstDataQualityRun.update({
    where: { id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy: actor,
      notes: notes ?? existing.notes,
      updatedBy: actor,
    },
  })
}
