/**
 * Phase 14 — GSTR-9 annual worksheet + FY archive services (books-side).
 * Cockpit scoring reuses monthly periods + optional Phase 15 notices when table present.
 * Does **not** submit GSTR-9 to portal · not FULL GST COMPLIANT.
 */
import type { Request } from 'express'
import type { GstAnnualReturnStatus, GstAnnualReturnType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AppError, AuthorizationError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import { loadLedgerRowsForPeriod } from './gst-registers.service.js'
import { buildGstr3bSummary } from './gstr-registers.util.js'
import {
  buildGstr9AnnualSnapshot,
  buildPhase14CapabilityMatrix,
  canArchiveAnnual,
  canLockAnnual,
  canMarkAnnualFiledExternal,
  canPrepareAnnual,
  canUnlockAnnual,
  financialYearLabelFromReturnPeriod,
  isPhase14AnnualEnabled,
  listReturnPeriodsForFinancialYear,
  scoreComplianceHealth,
  type GstAnnualReturnStatusLike,
  type TaxBucket,
} from './gst-annual-archive.util.js'
import type {
  GstAnnualActionBodyInput,
  GstAnnualListQueryInput,
  GstAnnualMarkFiledBodyInput,
  GstAnnualPrepareBodyInput,
  GstAnnualUnlockBodyInput,
  GstCockpitQueryInput,
  GstFyArchiveBodyInput,
  GstFyArchiveListQueryInput,
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
  if (!isPhase14AnnualEnabled()) {
    throw new AppError(503, 'GST Phase 14 annual module disabled (GST_PHASE14_ANNUAL_ENABLED=false)', 'GST_PHASE14_DISABLED')
  }
}

function userId(req: Request): string | undefined {
  return req.context?.userId
}

function emptyBucket(): TaxBucket {
  return { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0 }
}

function toBucket(c: {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalTax: number
}): TaxBucket {
  return {
    taxableValue: c.taxableValue,
    cgst: c.cgst,
    sgst: c.sgst,
    igst: c.igst,
    cess: c.cess,
    totalTax: c.totalTax,
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
    throw new AppError(422, 'Legal entity has no GSTIN — set GSTIN before annual returns', 'GSTIN_REQUIRED')
  }
  return g
}

function mapAnnual(row: {
  id: string
  legalEntityId: string
  companyGstin: string
  financialYear: string
  returnType: GstAnnualReturnType
  status: GstAnnualReturnStatus
  preparedAt: Date | null
  preparedBy: string | null
  lockedAt: Date | null
  lockedBy: string | null
  unlockedAt: Date | null
  unlockedBy: string | null
  unlockReason: string | null
  markedFiledAt: Date | null
  markedFiledBy: string | null
  acknowledgmentRef: string | null
  filedOnPortalDate: Date | null
  archivedAt: Date | null
  archivedBy: string | null
  archiveReason: string | null
  monthsCovered: number
  monthsFiledHint: number
  draftVersion: number
  snapshotJson: Prisma.JsonValue | null
  warningsJson: Prisma.JsonValue | null
  remarks: string | null
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    financialYear: row.financialYear,
    returnType: row.returnType,
    status: row.status,
    preparedAt: row.preparedAt?.toISOString() ?? null,
    preparedBy: row.preparedBy,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedBy: row.lockedBy,
    unlockedAt: row.unlockedAt?.toISOString() ?? null,
    unlockedBy: row.unlockedBy,
    unlockReason: row.unlockReason,
    markedFiledAt: row.markedFiledAt?.toISOString() ?? null,
    markedFiledBy: row.markedFiledBy,
    acknowledgmentRef: row.acknowledgmentRef,
    filedOnPortalDate: row.filedOnPortalDate ? toDateOnlyString(row.filedOnPortalDate) : null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archivedBy: row.archivedBy,
    archiveReason: row.archiveReason,
    monthsCovered: row.monthsCovered,
    monthsFiledHint: row.monthsFiledHint,
    draftVersion: row.draftVersion,
    snapshot: row.snapshotJson,
    warnings: row.warningsJson,
    remarks: row.remarks,
    updatedAt: row.updatedAt.toISOString(),
    readinessLabel: 'GST_ANNUAL_PREPARATION',
    disclaimer:
      'Annual return (GSTR-9/9C) books worksheet only. Mark Filed Externally after you file outside FOS. FOS does not file annual returns on the GST portal. Not FULL GST COMPLIANT.',
  }
}

export function getPhase14CapabilityMatrix(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view')
  return {
    ...buildPhase14CapabilityMatrix(),
    featureEnabled: isPhase14AnnualEnabled(),
  }
}

async function buildLiveAnnualSnapshot(params: {
  tenantId: string
  legalEntityId: string
  companyGstin: string
  financialYear: string
}) {
  const periods = listReturnPeriodsForFinancialYear(params.financialYear)
  const monthlyMeta = await prisma.gstrReturnPeriod.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin: params.companyGstin,
      returnPeriod: { in: periods },
    },
    select: { returnPeriod: true, returnType: true, status: true },
  })

  const monthlyOutward: TaxBucket[] = []
  const monthlyInward: TaxBucket[] = []
  const monthlyRcm: TaxBucket[] = []
  const monthlyItc: TaxBucket[] = []

  for (const rp of periods) {
    const rows = await loadLedgerRowsForPeriod({
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: rp,
      companyGstin: params.companyGstin,
    })
    if (rows.length === 0) {
      monthlyOutward.push(emptyBucket())
      monthlyInward.push(emptyBucket())
      monthlyRcm.push(emptyBucket())
      monthlyItc.push(emptyBucket())
      continue
    }
    const s = buildGstr3bSummary(rows)
    monthlyOutward.push(toBucket(s.outward))
    monthlyInward.push(toBucket(s.inward))
    monthlyRcm.push(toBucket(s.rcm))
    monthlyItc.push(toBucket(s.itc))
  }

  return buildGstr9AnnualSnapshot({
    financialYear: params.financialYear,
    companyGstin: params.companyGstin,
    monthlyOutward,
    monthlyInward,
    monthlyRcm,
    monthlyItc,
    monthlyPeriodMeta: monthlyMeta.map((m) => ({
      returnPeriod: m.returnPeriod,
      returnType: m.returnType,
      status: m.status,
    })),
  })
}

export async function listAnnualReturns(req: Request, tenantId: string, query: GstAnnualListQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const gstin = query.companyGstin?.trim().toUpperCase()
  const rows = await prisma.gstAnnualReturn.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      ...(gstin ? { companyGstin: gstin } : {}),
      ...(query.financialYear ? { financialYear: query.financialYear } : {}),
      ...(query.returnType ? { returnType: query.returnType } : {}),
    },
    orderBy: [{ financialYear: 'desc' }, { returnType: 'asc' }],
  })
  return { items: rows.map(mapAnnual) }
}

export async function getAnnualReturn(
  req: Request,
  tenantId: string,
  query: { legalEntityId: string; financialYear: string; returnType?: GstAnnualReturnType; companyGstin?: string | null },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, query.legalEntityId, query.companyGstin)
  const returnType = query.returnType ?? 'GSTR9'
  const row = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      companyGstin: gstin,
      financialYear: query.financialYear,
      returnType,
    },
  })
  if (!row) {
    return {
      item: null,
      livePreview: await buildLiveAnnualSnapshot({
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin: gstin,
        financialYear: query.financialYear,
      }),
    }
  }
  return { item: mapAnnual(row), livePreview: null as null }
}

export async function prepareAnnualReturn(req: Request, tenantId: string, body: GstAnnualPrepareBodyInput) {
  assertAny(req, 'tax.gst.annual.prepare', 'tax.gst.returns.prepare', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const returnType = body.returnType ?? 'GSTR9'
  const existing = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      returnType,
    },
  })
  const status = (existing?.status ?? 'OPEN') as GstAnnualReturnStatusLike
  if (!canPrepareAnnual(status)) {
    throw new InvalidStateError(`Cannot prepare annual return from status ${status}`)
  }

  const snapshot = await buildLiveAnnualSnapshot({
    tenantId,
    legalEntityId: body.legalEntityId,
    companyGstin: gstin,
    financialYear: body.financialYear,
  })

  const data = {
    status: 'DRAFT' as const,
    preparedAt: new Date(),
    preparedBy: userId(req) ?? null,
    updatedBy: userId(req) ?? null,
    monthsCovered: snapshot.monthsExpected,
    monthsFiledHint: Math.min(snapshot.gstr1FiledCount, snapshot.gstr3bFiledCount),
    draftVersion: (existing?.draftVersion ?? 0) + 1,
    snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
    warningsJson: snapshot.readinessWarnings as unknown as Prisma.InputJsonValue,
    remarks: body.remarks ?? existing?.remarks ?? null,
  }

  const row = existing
    ? await prisma.gstAnnualReturn.update({ where: { id: existing.id }, data })
    : await prisma.gstAnnualReturn.create({
        data: {
          tenantId,
          legalEntityId: body.legalEntityId,
          companyGstin: gstin,
          financialYear: body.financialYear,
          returnType,
          createdBy: userId(req) ?? null,
          ...data,
        },
      })

  return mapAnnual(row)
}

export async function lockAnnualReturn(req: Request, tenantId: string, body: GstAnnualActionBodyInput) {
  assertAny(req, 'tax.gst.annual.prepare', 'tax.gst.returns.lock', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const returnType = body.returnType ?? 'GSTR9'
  const row = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      returnType,
    },
  })
  if (!row) throw new NotFoundError('Annual return not found — prepare first')
  if (!canLockAnnual(row.status as GstAnnualReturnStatusLike)) {
    throw new InvalidStateError(`Cannot lock annual return from status ${row.status}`)
  }
  const updated = await prisma.gstAnnualReturn.update({
    where: { id: row.id },
    data: {
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedBy: userId(req) ?? null,
      updatedBy: userId(req) ?? null,
      remarks: body.remarks ?? row.remarks,
    },
  })
  return mapAnnual(updated)
}

export async function unlockAnnualReturn(req: Request, tenantId: string, body: GstAnnualUnlockBodyInput) {
  assertAny(req, 'tax.gst.annual.prepare', 'tax.gst.returns.lock', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const returnType = body.returnType ?? 'GSTR9'
  const row = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      returnType,
    },
  })
  if (!row) throw new NotFoundError('Annual return not found')
  if (!canUnlockAnnual(row.status as GstAnnualReturnStatusLike)) {
    throw new InvalidStateError(`Cannot unlock annual return from status ${row.status}`)
  }
  const updated = await prisma.gstAnnualReturn.update({
    where: { id: row.id },
    data: {
      status: 'DRAFT',
      unlockedAt: new Date(),
      unlockedBy: userId(req) ?? null,
      unlockReason: body.reason,
      updatedBy: userId(req) ?? null,
    },
  })
  return mapAnnual(updated)
}

export async function markAnnualFiledExternal(req: Request, tenantId: string, body: GstAnnualMarkFiledBodyInput) {
  assertAny(req, 'tax.gst.returns.mark_filed', 'tax.gst.annual.prepare', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const returnType = body.returnType ?? 'GSTR9'
  const row = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      returnType,
    },
  })
  if (!row) throw new NotFoundError('Annual return not found')
  if (!canMarkAnnualFiledExternal(row.status as GstAnnualReturnStatusLike)) {
    throw new InvalidStateError(`Cannot mark filed from status ${row.status}`)
  }
  const updated = await prisma.gstAnnualReturn.update({
    where: { id: row.id },
    data: {
      status: 'MARKED_FILED_EXTERNAL',
      markedFiledAt: new Date(),
      markedFiledBy: userId(req) ?? null,
      acknowledgmentRef: body.acknowledgmentRef,
      filedOnPortalDate: body.filedOnPortalDate ? parseDateOnly(body.filedOnPortalDate) : null,
      updatedBy: userId(req) ?? null,
      remarks: body.remarks ?? row.remarks,
    },
  })
  return mapAnnual(updated)
}

export async function archiveAnnualReturn(req: Request, tenantId: string, body: GstAnnualActionBodyInput) {
  assertAny(req, 'tax.gst.annual.archive', 'tax.gst.annual.prepare', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const returnType = body.returnType ?? 'GSTR9'
  const row = await prisma.gstAnnualReturn.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      returnType,
    },
  })
  if (!row) throw new NotFoundError('Annual return not found')
  if (!canArchiveAnnual(row.status as GstAnnualReturnStatusLike)) {
    throw new InvalidStateError(`Cannot archive annual return from status ${row.status}`)
  }
  const updated = await prisma.gstAnnualReturn.update({
    where: { id: row.id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      archivedBy: userId(req) ?? null,
      archiveReason: body.remarks ?? 'Archived for multi-year retention',
      updatedBy: userId(req) ?? null,
    },
  })
  return mapAnnual(updated)
}

/** FY-scoped annual health cockpit (Phase 14). Distinct from Phase 15 period ops cockpit. */
export async function getAnnualFyCockpit(req: Request, tenantId: string, query: GstCockpitQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, query.legalEntityId, query.companyGstin)
  const financialYear =
    query.financialYear ??
    financialYearLabelFromReturnPeriod(
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
    )
  const periods = listReturnPeriodsForFinancialYear(financialYear)

  const [monthlyPeriods, annual, fyArchive, filingSessions, rcmEntries, notices] = await Promise.all([
    prisma.gstrReturnPeriod.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin: gstin,
        returnPeriod: { in: periods },
      },
      select: { returnPeriod: true, returnType: true, status: true },
    }),
    prisma.gstAnnualReturn.findFirst({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin: gstin,
        financialYear,
        returnType: 'GSTR9',
      },
      select: { status: true, id: true, draftVersion: true },
    }),
    prisma.gstFyArchive.findFirst({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        companyGstin: gstin,
        financialYear,
      },
    }),
    prisma.gstrFilingSession
      .findMany({
        where: {
          tenantId,
          legalEntityId: query.legalEntityId,
          companyGstin: gstin,
          returnPeriod: { in: periods },
        },
        select: { status: true },
        take: 200,
      })
      .catch(() => [] as Array<{ status: string }>),
    prisma.gstRcmRegisterEntry.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        returnPeriod: { in: periods },
      },
      select: { status: true },
      take: 500,
    }),
    // Phase 15 table — soft dependency; if model missing at runtime this still typechecks
    prisma.gstComplianceNotice
      .findMany({
        where: { tenantId, legalEntityId: query.legalEntityId },
        select: { status: true, dueDate: true, issuedOn: true },
        take: 200,
      })
      .catch(() => [] as Array<{ status: string; dueDate: Date | null; issuedOn: Date }>),
  ])

  const health = scoreComplianceHealth({
    monthlyPeriods: monthlyPeriods.map((p) => ({
      returnPeriod: p.returnPeriod,
      returnType: p.returnType,
      status: p.status,
    })),
    notices: notices.map((n) => ({
      status: n.status,
      dueDate: n.dueDate ? toDateOnlyString(n.dueDate) : '2099-12-31',
      issuedOn: n.issuedOn ? toDateOnlyString(n.issuedOn) : undefined,
    })),
    rcmEntries: rcmEntries.map((r) => ({ status: String(r.status) })),
    filingSessions: filingSessions.map((s) => ({ status: s.status })),
    annualStatus: (annual?.status as GstAnnualReturnStatusLike | undefined) ?? null,
    fyArchived: fyArchive?.status === 'ARCHIVED',
  })

  return {
    financialYear,
    companyGstin: gstin,
    legalEntityId: query.legalEntityId,
    health,
    annualReturn: annual
      ? { id: annual.id, status: annual.status, draftVersion: annual.draftVersion }
      : null,
    fyArchive: fyArchive
      ? {
          id: fyArchive.id,
          status: fyArchive.status,
          archivedAt: fyArchive.archivedAt?.toISOString() ?? null,
          retainUntil: fyArchive.retainUntil ? toDateOnlyString(fyArchive.retainUntil) : null,
        }
      : null,
    monthlyPeriods: monthlyPeriods.map((p) => ({
      returnPeriod: p.returnPeriod,
      returnType: p.returnType,
      status: p.status,
    })),
    disclaimer:
      'Compliance cockpit is books-side analytics only. Not LIVE GST portal health. Not FULL GST COMPLIANT.',
  }
}

export async function listFyArchives(req: Request, tenantId: string, query: GstFyArchiveListQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.annual.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const gstin = query.companyGstin?.trim().toUpperCase()
  const rows = await prisma.gstFyArchive.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      ...(gstin ? { companyGstin: gstin } : {}),
      ...(query.financialYear ? { financialYear: query.financialYear } : {}),
    },
    orderBy: { financialYear: 'desc' },
  })
  return {
    items: rows.map((r) => ({
      id: r.id,
      legalEntityId: r.legalEntityId,
      companyGstin: r.companyGstin,
      financialYear: r.financialYear,
      status: r.status,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      archivedBy: r.archivedBy,
      retainUntil: r.retainUntil ? toDateOnlyString(r.retainUntil) : null,
      notes: r.notes,
      snapshotCounts: r.snapshotCountsJson,
      updatedAt: r.updatedAt.toISOString(),
    })),
  }
}

export async function archiveFinancialYear(req: Request, tenantId: string, body: GstFyArchiveBodyInput) {
  assertAny(req, 'tax.gst.annual.archive', 'tax.gst.setup.manage')
  assertFeatureOn()
  const gstin = await resolveCompanyGstin(tenantId, body.legalEntityId, body.companyGstin)
  const periods = listReturnPeriodsForFinancialYear(body.financialYear)

  const [periodCount, annualCount, noticeCount] = await Promise.all([
    prisma.gstrReturnPeriod.count({
      where: {
        tenantId,
        legalEntityId: body.legalEntityId,
        companyGstin: gstin,
        returnPeriod: { in: periods },
      },
    }),
    prisma.gstAnnualReturn.count({
      where: {
        tenantId,
        legalEntityId: body.legalEntityId,
        companyGstin: gstin,
        financialYear: body.financialYear,
      },
    }),
    prisma.gstComplianceNotice
      .count({ where: { tenantId, legalEntityId: body.legalEntityId } })
      .catch(() => 0),
  ])

  const counts = {
    monthlyReturnPeriods: periodCount,
    annualReturns: annualCount,
    noticesForLe: noticeCount,
    archivedAtNote: 'Retention flag only — ledger and source period rows are not deleted.',
  }

  const existing = await prisma.gstFyArchive.findFirst({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
    },
  })

  const data = {
    status: 'ARCHIVED' as const,
    archivedAt: new Date(),
    archivedBy: userId(req) ?? null,
    retainUntil: body.retainUntil ? parseDateOnly(body.retainUntil) : null,
    notes: body.notes ?? null,
    snapshotCountsJson: counts as unknown as Prisma.InputJsonValue,
    updatedBy: userId(req) ?? null,
  }

  const row = existing
    ? await prisma.gstFyArchive.update({ where: { id: existing.id }, data })
    : await prisma.gstFyArchive.create({
        data: {
          tenantId,
          legalEntityId: body.legalEntityId,
          companyGstin: gstin,
          financialYear: body.financialYear,
          createdBy: userId(req) ?? null,
          ...data,
        },
      })

  // Best-effort: also mark annual worksheet ARCHIVED when already locked/filed
  const annuals = await prisma.gstAnnualReturn.findMany({
    where: {
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: gstin,
      financialYear: body.financialYear,
      status: { in: ['LOCKED', 'MARKED_FILED_EXTERNAL'] },
    },
  })
  for (const a of annuals) {
    await prisma.gstAnnualReturn.update({
      where: { id: a.id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: userId(req) ?? null,
        archiveReason: body.notes ?? 'FY archived',
        updatedBy: userId(req) ?? null,
      },
    })
  }

  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    financialYear: row.financialYear,
    status: row.status,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    retainUntil: row.retainUntil ? toDateOnlyString(row.retainUntil) : null,
    notes: row.notes,
    snapshotCounts: counts,
    annualWorksheetsArchived: annuals.length,
    disclaimer: 'FY archive is a retention marker only — no ledger purge · not FULL GST COMPLIANT.',
  }
}
