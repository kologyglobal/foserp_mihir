/**
 * Phase 18 — GST subledger vs GL control recon service.
 */
import { randomUUID } from 'crypto'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, AppError, NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  buildPhase18CapabilityMatrix,
  buildReconSummary,
  compareGstToGlBucket,
  GST_GL_BUCKETS,
  isPhase18GlReconEnabled,
  returnPeriodToDateRange,
  type GlReconLine,
} from './gst-gl-recon.util.js'
import type { GstGlReconQueryInput, GstGlReconRunCreateInput } from './tax-compliance.schemas.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

function assertFeatureOn(): void {
  if (!isPhase18GlReconEnabled()) {
    throw new AppError(
      503,
      'GST Phase 18 GL recon disabled (GST_PHASE18_GL_RECON_ENABLED=false)',
      'GST_PHASE18_DISABLED',
    )
  }
}

function actorId(req: Request): string | null {
  return req.context?.userId ?? null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function getGlReconCapability(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.gl_recon.view', 'tax.gst.reconcile', 'tax.gst.setup.manage')
  return {
    ...buildPhase18CapabilityMatrix(),
    featureEnabled: isPhase18GlReconEnabled(),
  }
}

export async function runGlRecon(req: Request, tenantId: string, query: GstGlReconQueryInput) {
  assertAny(
    req,
    'tax.gst.view',
    'finance.tax.view',
    'tax.gst.gl_recon.view',
    'tax.gst.reconcile',
    'tax.gst.setup.manage',
  )
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const tolerance = query.tolerance ?? 1
  const { fromDate, toDate } = returnPeriodToDateRange(query.returnPeriod)
  const from = new Date(`${fromDate}T00:00:00.000Z`)
  const to = new Date(`${toDate}T23:59:59.999Z`)

  const mappingKeys = GST_GL_BUCKETS.map((b) => b.mappingKey)
  const mappings = await prisma.defaultAccountMapping.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      mappingKey: { in: mappingKeys as never[] },
    },
    include: { account: { select: { id: true, accountCode: true } } },
  })
  const mapByKey = new Map(mappings.map((m) => [String(m.mappingKey), m]))

  const ledgerWhere: Prisma.GstLedgerEntryWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
  }
  if (query.companyGstin?.trim()) {
    ledgerWhere.companyGstin = query.companyGstin.trim().toUpperCase()
  }

  const ledgerGroups = await prisma.gstLedgerEntry.groupBy({
    by: ['taxType'],
    where: ledgerWhere,
    _sum: { taxAmount: true },
  })
  const gstByType = new Map(ledgerGroups.map((g) => [String(g.taxType), num(g._sum.taxAmount)]))

  const accountIds = mappings.map((m) => m.accountId)
  const glGroups =
    accountIds.length === 0
      ? []
      : await prisma.generalLedgerEntry.groupBy({
          by: ['accountId'],
          where: {
            tenantId,
            legalEntityId: query.legalEntityId,
            accountId: { in: accountIds },
            postingDate: { gte: from, lte: to },
          },
          _sum: { baseDebitAmount: true, baseCreditAmount: true },
        })
  const glByAccount = new Map(
    glGroups.map((g) => [
      g.accountId,
      { debit: num(g._sum.baseDebitAmount), credit: num(g._sum.baseCreditAmount) },
    ]),
  )

  const lines: GlReconLine[] = GST_GL_BUCKETS.map((bucket) => {
    const mapping = mapByKey.get(bucket.mappingKey)
    const gl = mapping ? glByAccount.get(mapping.accountId) : undefined
    return compareGstToGlBucket({
      bucket,
      gstLedgerAmount: gstByType.get(bucket.taxType) ?? 0,
      glDebit: gl?.debit ?? 0,
      glCredit: gl?.credit ?? 0,
      accountId: mapping?.accountId ?? null,
      accountCode: mapping?.account?.accountCode ?? null,
      tolerance,
    })
  })

  const summary = buildReconSummary(lines, tolerance)
  return {
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    companyGstin: query.companyGstin ?? null,
    period: { fromDate, toDate },
    ...summary,
    gstLedgerRowBuckets: ledgerGroups.length,
  }
}

export async function listGlReconRuns(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  page = 1,
  pageSize = 20,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.gl_recon.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  const skip = (page - 1) * pageSize
  const where = { tenantId, legalEntityId }
  const [total, items] = await Promise.all([
    prisma.gstGlReconRun.count({ where }),
    prisma.gstGlReconRun.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ])
  return { items, total, page, pageSize }
}

export async function createGlReconRun(req: Request, tenantId: string, body: GstGlReconRunCreateInput) {
  assertAny(req, 'tax.gst.gl_recon.manage', 'tax.gst.setup.manage', 'tax.gst.reconcile')
  assertFeatureOn()

  const report = await runGlRecon(req, tenantId, {
    legalEntityId: body.legalEntityId,
    returnPeriod: body.returnPeriod,
    companyGstin: body.companyGstin,
    tolerance: body.tolerance,
  })
  const actor = actorId(req)
  const id = randomUUID()

  const row = await prisma.gstGlReconRun.create({
    data: {
      id,
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: body.companyGstin ?? null,
      returnPeriod: body.returnPeriod,
      tolerance: body.tolerance ?? 1,
      status: 'GENERATED',
      matchCount: report.health.matchCount,
      varianceCount: report.health.varianceCount,
      unmappedCount: report.health.unmappedCount,
      totalAbsVariance: report.health.totalAbsVariance,
      scorePct: report.health.scorePct,
      overall: report.health.overall,
      reportJson: report as unknown as Prisma.InputJsonValue,
      notes: body.notes ?? null,
      generatedBy: actor,
      createdBy: actor,
      updatedBy: actor,
    },
  })

  return {
    ...row,
    disclaimer: 'Stored GST vs GL recon evidence only. Not government filing, not FULL GST COMPLIANT.',
  }
}

export async function acknowledgeGlReconRun(
  req: Request,
  tenantId: string,
  id: string,
  notes?: string | null,
) {
  assertAny(req, 'tax.gst.gl_recon.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const existing = await prisma.gstGlReconRun.findFirst({ where: { id, tenantId } })
  if (!existing) throw new NotFoundError('GST GL recon run')
  const actor = actorId(req)
  return prisma.gstGlReconRun.update({
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
