/**
 * Phase 15 — GST compliance ops service.
 * Multi-period health roll-up (reuses Phase 13 period health) + notices + multi-period audit packs.
 * GSTR-9 annual worksheet remains Phase 14 — foundation link only.
 * Not LIVE portal · not FULL GST COMPLIANT.
 */
import type { Request } from 'express'
import { createHash, randomUUID } from 'crypto'
import type { GstComplianceNoticeStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, NotFoundError, AppError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import * as hardening from './gst-compliance-hardening.service.js'
import {
  buildAuditPackManifest,
  buildGstr9AnnualSkeleton,
  buildPhase15CapabilityMatrix,
  evaluateNoticeDue,
  indianFyPeriods,
  isPhase15ComplianceOpsEnabled,
  listReturnPeriodsInclusive,
  summarizeMultiPeriodHealth,
  type PeriodHealthResult,
} from './gst-compliance-ops.util.js'
import type {
  GstAuditPackCreateInput,
  GstAuditPackListQueryInput,
  GstAuditPackVoidInput,
  GstComplianceCockpitQueryInput,
  GstComplianceNoticeCreateInput,
  GstComplianceNoticeListQueryInput,
  GstComplianceNoticeUpdateInput,
  GstGstr9AnnualQueryInput,
  GstMultiPeriodHealthQueryInput,
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
  if (!isPhase15ComplianceOpsEnabled()) {
    throw new AppError(
      503,
      'GST Phase 15 compliance ops disabled (GST_PHASE15_COMPLIANCE_OPS_ENABLED=false)',
      'GST_PHASE15_DISABLED',
    )
  }
}

function userId(req: Request): string | null {
  return req.context?.user?.id ?? null
}

async function resolveCompanyGstin(
  tenantId: string,
  legalEntityId: string,
  companyGstin?: string | null,
): Promise<string> {
  const le = await getLegalEntityOrThrow(tenantId, legalEntityId)
  const g = (companyGstin ?? le.gstin ?? '').trim().toUpperCase()
  if (!g) {
    throw new AppError(422, 'Legal entity has no GSTIN — set GSTIN before compliance ops', 'GSTIN_REQUIRED')
  }
  return g
}

function mapHardeningHealthToPeriod(result: Awaited<ReturnType<typeof hardening.getPeriodHealth>>): PeriodHealthResult {
  const h = result.health
  const grade =
    h.overall === 'READY'
      ? 'HEALTHY'
      : h.overall === 'READY_WITH_WARNINGS'
        ? 'AT_RISK'
        : h.overall === 'NOT_READY'
          ? 'BLOCKED'
          : 'UNKNOWN'
  const score =
    grade === 'HEALTHY' ? 100 : grade === 'AT_RISK' ? Math.max(50, 90 - h.warningCount * 5) : Math.max(0, 40 - h.blockerCount * 10)

  return {
    returnPeriod: result.returnPeriod,
    companyGstin: result.companyGstin,
    score,
    grade,
    issues: h.findings.map((f) => ({
      code: f.code,
      severity:
        f.severity === 'BLOCKER' ? 'BLOCKER' : f.severity === 'WARNING' ? 'WARN' : 'INFO',
      message: f.title || f.detail,
    })),
    checklist: [
      { id: 'blockers', label: 'No blockers', ok: h.blockerCount === 0, detail: `${h.blockerCount}` },
      { id: 'warnings', label: 'No warnings', ok: h.warningCount === 0, detail: `${h.warningCount}` },
    ],
    readinessLabel: 'GST_COMPLIANCE_OPS',
    disclaimer: h.disclaimer,
  }
}

function mapNotice(row: {
  id: string
  legalEntityId: string
  companyGstin: string
  noticeRef: string
  noticeDate: Date
  noticeType: string
  status: GstComplianceNoticeStatus
  subject: string
  dueDate: Date | null
  amountDemanded: { toString(): string } | number
  responseNotes: string | null
  respondedAt: Date | null
  closedAt: Date | null
  notes: string | null
  createdAt: Date
}) {
  const dueDate = row.dueDate ? toDateOnlyString(row.dueDate) : null
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    noticeRef: row.noticeRef,
    noticeDate: toDateOnlyString(row.noticeDate),
    noticeType: row.noticeType,
    status: row.status,
    subject: row.subject,
    dueDate,
    amountDemanded: Number(row.amountDemanded),
    responseNotes: row.responseNotes,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    dueEvaluation: dueDate
      ? evaluateNoticeDue({ dueDate, status: row.status })
      : { statusSuggested: 'OPEN' as const, daysUntilDue: null, isOverdue: false },
  }
}

export function getCapabilityMatrix(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  return {
    ...buildPhase15CapabilityMatrix(),
    featureEnabled: isPhase15ComplianceOpsEnabled(),
    reusesPhase13PeriodHealth: true,
    reusesPhase13Tables: true,
    phase14OwnsAnnualWorksheet: true,
  }
}

export async function getMultiPeriodHealth(
  req: Request,
  tenantId: string,
  query: GstMultiPeriodHealthQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const periods = listReturnPeriodsInclusive(query.periodFrom, query.periodTo)
  if (periods.length > 24) {
    throw new AppError(400, 'Multi-period health range limited to 24 months', 'GST_HEALTH_RANGE')
  }

  const periodResults: PeriodHealthResult[] = []
  for (const returnPeriod of periods) {
    try {
      const full = await hardening.getPeriodHealth({
        tenantId,
        legalEntityId: query.legalEntityId,
        returnPeriod,
        companyGstin: query.companyGstin,
      })
      periodResults.push(mapHardeningHealthToPeriod(full))
    } catch (err) {
      periodResults.push({
        returnPeriod,
        companyGstin: query.companyGstin ?? null,
        score: 0,
        grade: 'BLOCKED',
        issues: [
          {
            code: 'HEALTH_LOAD_FAILED',
            severity: 'BLOCKER',
            message: err instanceof Error ? err.message : 'Period health failed',
          },
        ],
        checklist: [],
        readinessLabel: 'GST_COMPLIANCE_OPS',
        disclaimer: 'Load error',
      })
    }
  }

  return {
    legalEntityId: query.legalEntityId,
    companyGstin: periodResults.find((p) => p.companyGstin)?.companyGstin ?? query.companyGstin ?? null,
    periodFrom: query.periodFrom,
    periodTo: query.periodTo,
    ...summarizeMultiPeriodHealth(periodResults),
    engine: 'phase13_period_health_rollup',
  }
}

export async function getCockpit(req: Request, tenantId: string, query: GstComplianceCockpitQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const companyGstin = await resolveCompanyGstin(tenantId, query.legalEntityId, query.companyGstin)

  const [y, m] = query.returnPeriod.split('-').map(Number)
  let fromY = y
  let fromM = m - 5
  while (fromM <= 0) {
    fromM += 12
    fromY -= 1
  }
  const periodFrom = `${fromY}-${String(fromM).padStart(2, '0')}`

  const multiPeriod = await getMultiPeriodHealth(req, tenantId, {
    legalEntityId: query.legalEntityId,
    companyGstin,
    periodFrom,
    periodTo: query.returnPeriod,
  })

  const [notices, packs] = await Promise.all([
    prisma.gstComplianceNotice.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'RESPONDED'] },
      },
      orderBy: [{ dueDate: 'asc' }, { noticeDate: 'desc' }],
      take: 10,
    }),
    prisma.gstComplianceAuditPack.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin,
        status: 'GENERATED',
      },
      orderBy: { generatedAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    legalEntityId: query.legalEntityId,
    companyGstin,
    returnPeriod: query.returnPeriod,
    lookbackFrom: periodFrom,
    focusPeriod: multiPeriod.periods.find((p) => p.returnPeriod === query.returnPeriod) ?? null,
    multiPeriod,
    openWork: {
      openNotices: notices.map(mapNotice),
      recentAuditPacks: packs.map((p) => ({
        id: p.id,
        returnPeriod: p.returnPeriod,
        status: p.status,
        blockerCount: p.blockerCount,
        warningCount: p.warningCount,
        digestHash: p.digestHash,
        generatedAt: p.generatedAt?.toISOString() ?? null,
      })),
    },
    capability: buildPhase15CapabilityMatrix(),
    verdict: 'READY_WITH_CONDITIONS' as const,
    notFullGstCompliant: true as const,
    disclaimer:
      'Phase 15 multi-period cockpit. Notices/audit packs store on Phase 13 tables. Annual worksheet is Phase 14. Not LIVE portal / not FULL GST COMPLIANT.',
  }
}

export async function getGstr9AnnualFoundation(
  req: Request,
  tenantId: string,
  query: GstGstr9AnnualQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view', 'tax.gst.annual.view')
  assertFeatureOn()
  const companyGstin = await resolveCompanyGstin(tenantId, query.legalEntityId, query.companyGstin)
  const months = indianFyPeriods(query.financialYearLabel)

  const monthly = await Promise.all(
    months.map(async (returnPeriod) => {
      const [gstr1, gstr3b, outCount, inCount] = await Promise.all([
        prisma.gstrReturnPeriod.findFirst({
          where: {
            tenantId,
            legalEntityId: query.legalEntityId,
            companyGstin,
            returnPeriod,
            returnType: 'GSTR1',
          },
          select: { status: true, snapshotJson: true },
        }),
        prisma.gstrReturnPeriod.findFirst({
          where: {
            tenantId,
            legalEntityId: query.legalEntityId,
            companyGstin,
            returnPeriod,
            returnType: 'GSTR3B',
          },
          select: { status: true, snapshotJson: true },
        }),
        prisma.gstLedgerEntry.count({
          where: {
            tenantId,
            legalEntityId: query.legalEntityId,
            companyGstin,
            returnPeriod,
            direction: 'OUTWARD',
          },
        }),
        prisma.gstLedgerEntry.count({
          where: {
            tenantId,
            legalEntityId: query.legalEntityId,
            companyGstin,
            returnPeriod,
            direction: 'INWARD',
          },
        }),
      ])
      return {
        returnPeriod,
        gstr1Status: gstr1?.status ?? null,
        gstr3bStatus: gstr3b?.status ?? null,
        outwardTaxable: outCount > 0 ? 1 : 0,
        outwardTax: 0,
        inwardTaxable: inCount > 0 ? 1 : 0,
        itcTotal: 0,
        netLiability: 0,
      }
    }),
  )

  return {
    legalEntityId: query.legalEntityId,
    companyGstin,
    ...buildGstr9AnnualSkeleton({
      financialYearLabel: query.financialYearLabel,
      monthly,
    }),
    phase14Note: 'Full GSTR-9 worksheet prepare/lock lives under Phase 14 annual routes — this is a books foundation roll-up only.',
  }
}

export async function createAuditPack(req: Request, tenantId: string, body: GstAuditPackCreateInput) {
  assertAny(req, 'tax.gst.ops.manage', 'tax.gst.setup.manage', 'tax.gst.ops.export')
  assertFeatureOn()
  const companyGstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const periods = listReturnPeriodsInclusive(body.periodFrom, body.periodTo)
  if (periods.length > 24) {
    throw new AppError(400, 'Audit pack range limited to 24 months', 'GST_AUDIT_RANGE')
  }

  const multi = await getMultiPeriodHealth(req, tenantId, {
    legalEntityId: body.legalEntityId,
    companyGstin,
    periodFrom: body.periodFrom,
    periodTo: body.periodTo,
  })

  const generated: unknown[] = []
  for (const returnPeriod of periods) {
    const periodHealth = multi.periods.find((p) => p.returnPeriod === returnPeriod)
    const blockerCount = periodHealth?.issues.filter((i) => i.severity === 'BLOCKER').length ?? 0
    const warningCount = periodHealth?.issues.filter((i) => i.severity === 'WARN').length ?? 0

    const [gstr1Count, gstr3bCount, ledgerCount, noticeCount] = await Promise.all([
      prisma.gstrReturnPeriod.count({
        where: {
          tenantId,
          legalEntityId: body.legalEntityId,
          companyGstin,
          returnPeriod,
          returnType: 'GSTR1',
        },
      }),
      prisma.gstrReturnPeriod.count({
        where: {
          tenantId,
          legalEntityId: body.legalEntityId,
          companyGstin,
          returnPeriod,
          returnType: 'GSTR3B',
        },
      }),
      prisma.gstLedgerEntry.count({
        where: { tenantId, legalEntityId: body.legalEntityId, companyGstin, returnPeriod },
      }),
      prisma.gstComplianceNotice.count({
        where: { tenantId, legalEntityId: body.legalEntityId, companyGstin },
      }),
    ])

    const packJson = {
      returnPeriod,
      companyGstin,
      health: periodHealth,
      counts: { gstr1: gstr1Count, gstr3b: gstr3bCount, ledger: ledgerCount, notices: noticeCount },
      generatedAt: new Date().toISOString(),
      multiPeriodRange: { from: body.periodFrom, to: body.periodTo },
      notFullGstCompliant: true,
      disclaimer: 'Books-side audit freeze. Not portal filing payload.',
    }
    const checklistJson = periodHealth?.checklist ?? []
    const digestHash = `sha256:${createHash('sha256').update(JSON.stringify(packJson)).digest('hex')}`

    const row = await prisma.gstComplianceAuditPack.create({
      data: {
        id: randomUUID(),
        tenantId,
        legalEntityId: body.legalEntityId,
        companyGstin,
        returnPeriod,
        status: 'GENERATED',
        packJson: packJson as unknown as Prisma.InputJsonValue,
        checklistJson: checklistJson as unknown as Prisma.InputJsonValue,
        exceptionCount: blockerCount + warningCount,
        blockerCount,
        warningCount,
        digestHash,
        generatedAt: new Date(),
        generatedBy: userId(req),
        notes: body.notes ?? `Phase 15 multi-period freeze ${body.periodFrom}..${body.periodTo}`,
      },
    })
    generated.push({
      id: row.id,
      returnPeriod: row.returnPeriod,
      status: row.status,
      digestHash: row.digestHash,
      blockerCount: row.blockerCount,
      warningCount: row.warningCount,
      generatedAt: row.generatedAt?.toISOString() ?? null,
    })
  }

  const rangeManifest = buildAuditPackManifest({
    periodFrom: body.periodFrom,
    periodTo: body.periodTo,
    companyGstin,
    healthSnapshot: multi,
    sectionCounts: {
      period_health: multi.periods.length,
      gstr1_prep: generated.length,
      notices: 0,
    },
  })

  return {
    periodFrom: body.periodFrom,
    periodTo: body.periodTo,
    companyGstin,
    generatedCount: generated.length,
    generated,
    rangeManifest,
    disclaimer: rangeManifest.disclaimer,
  }
}

export async function listAuditPacks(req: Request, tenantId: string, query: GstAuditPackListQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const where: Prisma.GstComplianceAuditPackWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstComplianceAuditPack.count({ where }),
    prisma.gstComplianceAuditPack.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      legalEntityId: r.legalEntityId,
      companyGstin: r.companyGstin,
      returnPeriod: r.returnPeriod,
      status: r.status,
      exceptionCount: r.exceptionCount,
      blockerCount: r.blockerCount,
      warningCount: r.warningCount,
      digestHash: r.digestHash,
      generatedAt: r.generatedAt?.toISOString() ?? null,
      generatedBy: r.generatedBy,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      notes: r.notes,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    disclaimer: 'Stored books-side audit packs. Not portal filing. Not FULL GST COMPLIANT.',
  }
}

export async function getAuditPack(req: Request, tenantId: string, id: string) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  assertFeatureOn()
  const row = await prisma.gstComplianceAuditPack.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Audit pack not found')
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.returnPeriod,
    status: row.status,
    pack: row.packJson,
    checklist: row.checklistJson,
    exceptionCount: row.exceptionCount,
    blockerCount: row.blockerCount,
    warningCount: row.warningCount,
    digestHash: row.digestHash,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    generatedBy: row.generatedBy,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    notes: row.notes,
    disclaimer: 'Frozen books-side audit pack. Not portal filing. Not FULL GST COMPLIANT.',
  }
}

export async function voidAuditPack(
  req: Request,
  tenantId: string,
  id: string,
  body: GstAuditPackVoidInput,
) {
  assertAny(req, 'tax.gst.ops.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const existing = await prisma.gstComplianceAuditPack.findFirst({ where: { id, tenantId } })
  if (!existing) throw new NotFoundError('Audit pack not found')
  const row = await prisma.gstComplianceAuditPack.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      archivedBy: userId(req),
      notes: body.reason ? `${existing.notes ?? ''}\nArchived: ${body.reason}`.trim() : existing.notes,
    },
  })
  return getAuditPack(req, tenantId, row.id)
}

export async function listNotices(
  req: Request,
  tenantId: string,
  query: GstComplianceNoticeListQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.ops.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const where: Prisma.GstComplianceNoticeWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstComplianceNotice.count({ where }),
    prisma.gstComplianceNotice.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { noticeDate: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return {
    items: rows.map(mapNotice),
    total,
    page: query.page,
    pageSize: query.pageSize,
    note: 'Manual correspondence log only — not GST portal notice download',
  }
}

export async function createNotice(
  req: Request,
  tenantId: string,
  body: GstComplianceNoticeCreateInput,
) {
  assertAny(req, 'tax.gst.ops.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const companyGstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const row = await prisma.gstComplianceNotice.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin,
      noticeRef: body.noticeRef.trim(),
      noticeDate: parseDateOnly(body.noticeDate),
      noticeType: body.noticeType.trim().toUpperCase(),
      subject: body.subject.trim(),
      dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
      amountDemanded: body.amountDemanded ?? 0,
      notes: body.notes ?? null,
      status: 'OPEN',
      createdBy: userId(req),
      updatedBy: userId(req),
    },
  })
  return mapNotice(row)
}

export async function updateNotice(
  req: Request,
  tenantId: string,
  id: string,
  body: GstComplianceNoticeUpdateInput,
) {
  assertAny(req, 'tax.gst.ops.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const existing = await prisma.gstComplianceNotice.findFirst({ where: { id, tenantId } })
  if (!existing) throw new NotFoundError('Compliance notice not found')

  if (body.status === 'VOID' || body.status === 'CLOSED') {
    const row = await prisma.gstComplianceNotice.update({
      where: { id },
      data: {
        status: body.status,
        closedAt: new Date(),
        closedBy: userId(req),
        notes: body.notes ?? existing.notes,
        updatedBy: userId(req),
      },
    })
    return mapNotice(row)
  }

  if (body.responseNotes || body.status === 'RESPONDED' || body.status === 'ACKNOWLEDGED') {
    const row = await prisma.gstComplianceNotice.update({
      where: { id },
      data: {
        status: body.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'RESPONDED',
        responseNotes: body.responseNotes ?? existing.responseNotes,
        respondedAt: new Date(),
        respondedBy: userId(req),
        notes: body.notes ?? existing.notes,
        updatedBy: userId(req),
      },
    })
    return mapNotice(row)
  }

  throw new AppError(400, 'Provide status CLOSED/VOID/ACKNOWLEDGED/RESPONDED or responseNotes', 'NOTICE_UPDATE_INVALID')
}
