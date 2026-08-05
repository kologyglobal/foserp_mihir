/**
 * Phase 12 — GSTR portal filing sessions.
 * Reuses Phase 5 locked snapshots; SIMULATED submit by default; LIVE hard-gated.
 * Mark-filed wires into existing markFiledExternally (ledger FILED).
 */
import type { GstrFilingSessionStatus, GstrReturnType, Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AppError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { markFiledExternally } from './gstr-return.service.js'
import {
  assertLiveGstrFilingConfigured,
  buildFilingPackageEnvelope,
  canApproveChecker,
  canCaptureArn,
  canCreateFilingPackage,
  canMarkFiledFromSession,
  canSubmitFiling,
  getPortalFilingCapabilitySummary,
  resolveGstrFilingProviderMode,
  simulatePortalSubmit,
  type GstrFilingSessionStatusLike,
  type ReturnPeriodStatusLike,
} from './gstr-portal-filing.util.js'

function asSessionStatus(s: GstrFilingSessionStatus): GstrFilingSessionStatusLike {
  return s as GstrFilingSessionStatusLike
}

function mapSession(row: {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  returnType: GstrReturnType
  returnPeriodId: string
  status: GstrFilingSessionStatus
  providerMode: string
  packageJson: Prisma.JsonValue | null
  packageVersion: number
  requestJson: Prisma.JsonValue | null
  responseJson: Prisma.JsonValue | null
  acknowledgmentRef: string | null
  filedOnPortalDate: Date | null
  providerRef: string | null
  failureMessage: string | null
  makerUserId: string | null
  checkerUserId: string | null
  submittedAt: Date | null
  submittedBy: string | null
  acceptedAt: Date | null
  markedFiledAt: Date | null
  markedFiledBy: string | null
  remarks: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.returnPeriod,
    returnType: row.returnType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B',
    returnPeriodId: row.returnPeriodId,
    status: row.status,
    providerMode: row.providerMode,
    packageVersion: row.packageVersion,
    package: row.packageJson,
    request: row.requestJson,
    response: row.responseJson,
    acknowledgmentRef: row.acknowledgmentRef,
    filedOnPortalDate: row.filedOnPortalDate?.toISOString().slice(0, 10) ?? null,
    providerRef: row.providerRef,
    failureMessage: row.failureMessage,
    makerUserId: row.makerUserId,
    checkerUserId: row.checkerUserId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submittedBy: row.submittedBy,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    markedFiledAt: row.markedFiledAt?.toISOString() ?? null,
    markedFiledBy: row.markedFiledBy,
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readinessLabel: 'GST_PORTAL_FILING_SIMULATED',
    disclaimer:
      'Portal filing foundation only. Default path is SIMULATED. LIVE requires UAT + transport flags and is not certified in core FOS. Not FULL GST COMPLIANT.',
  }
}

export function getFilingCapability(_req?: Request) {
  return getPortalFilingCapabilitySummary()
}

export async function listFilingSessions(
  _req: Request,
  tenantId: string,
  query: {
    legalEntityId: string
    returnPeriod?: string
    companyGstin?: string | null
    returnType?: 'GSTR1' | 'GSTR3B'
    page?: number
    pageSize?: number
  },
) {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const where: Prisma.GstrFilingSessionWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.returnPeriod ? { returnPeriod: query.returnPeriod } : {}),
    ...(query.companyGstin ? { companyGstin: query.companyGstin.trim().toUpperCase() } : {}),
    ...(query.returnType ? { returnType: query.returnType } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstrFilingSession.count({ where }),
    prisma.gstrFilingSession.findMany({
      where,
      orderBy: [{ returnPeriod: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items: rows.map(mapSession), total, page, pageSize }
}

export async function getFilingSession(_req: Request, tenantId: string, id: string) {
  const row = await prisma.gstrFilingSession.findFirst({
    where: { id, tenantId },
  })
  if (!row) throw new NotFoundError('GSTR filing session')
  return mapSession(row)
}

/**
 * Create a filing package from a Phase 5 LOCKED return period.
 * Does not recompute — freezes `snapshotJson` into the session package.
 */
export async function createFilingPackage(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    returnPeriod: string
    returnType: 'GSTR1' | 'GSTR3B'
    companyGstin?: string | null
    requireChecker?: boolean
    remarks?: string | null
  },
) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const gstinFilter = input.companyGstin?.trim().toUpperCase()
  const period = await prisma.gstrReturnPeriod.findFirst({
    where: {
      tenantId,
      legalEntityId: input.legalEntityId,
      returnPeriod: input.returnPeriod,
      returnType: input.returnType,
      ...(gstinFilter ? { companyGstin: gstinFilter } : {}),
    },
  })
  if (!period) {
    throw new AppError(
      404,
      `No ${input.returnType} period for ${input.returnPeriod} — prepare and lock on GSTR prep first`,
      'RETURN_PERIOD_NOT_FOUND',
    )
  }
  if (!canCreateFilingPackage(period.status as ReturnPeriodStatusLike)) {
    throw new InvalidStateError(
      `Can only package a LOCKED return (current: ${period.status}). Lock on GSTR Prep first.`,
    )
  }
  if (!period.snapshotJson) {
    throw new InvalidStateError('Locked return has no snapshot — re-lock after prepare.')
  }

  const providerMode = resolveGstrFilingProviderMode()
  const packagedAt = new Date().toISOString()
  const envelope = buildFilingPackageEnvelope({
    returnType: period.returnType,
    returnPeriod: period.returnPeriod,
    companyGstin: period.companyGstin,
    legalEntityId: period.legalEntityId,
    snapshot: period.snapshotJson,
    draftVersion: period.draftVersion,
    packagedAt,
  })

  const actor = req.context?.userId ?? null
  const status: GstrFilingSessionStatus = input.requireChecker ? 'PENDING_CHECKER' : 'PACKAGE_READY'

  const row = await prisma.gstrFilingSession.create({
    data: {
      tenantId,
      legalEntityId: period.legalEntityId,
      companyGstin: period.companyGstin,
      returnPeriod: period.returnPeriod,
      returnType: period.returnType,
      returnPeriodId: period.id,
      status,
      providerMode,
      packageJson: envelope as object,
      packageVersion: 1,
      makerUserId: actor,
      remarks: input.remarks?.trim() || null,
      createdBy: actor,
      updatedBy: actor,
    },
  })

  await createAuditLog({
    ...auditFromRequest(req),
    tenantId,
    module: 'tax-compliance',
    entity: 'GstrFilingSession',
    entityId: row.id,
    action: 'CREATE_PACKAGE',
    newValues: {
      returnType: row.returnType,
      returnPeriod: row.returnPeriod,
      status: row.status,
      providerMode,
      snapshotHash: (envelope as { snapshotHash?: string }).snapshotHash,
    },
  })

  return mapSession(row)
}

export async function approveChecker(
  req: Request,
  tenantId: string,
  id: string,
  input?: { remarks?: string | null },
) {
  const row = await prisma.gstrFilingSession.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GSTR filing session')
  if (!canApproveChecker(asSessionStatus(row.status))) {
    throw new InvalidStateError(`Cannot approve checker from status ${row.status}.`)
  }
  const actor = req.context?.userId ?? null
  if (row.makerUserId && actor && row.makerUserId === actor) {
    throw new InvalidStateError('Maker-checker separation: checker cannot be the same user as maker.')
  }

  const updated = await prisma.gstrFilingSession.update({
    where: { id: row.id },
    data: {
      status: 'PACKAGE_READY',
      checkerUserId: actor,
      remarks: input?.remarks?.trim() || row.remarks,
      updatedBy: actor,
    },
  })

  await createAuditLog({
    ...auditFromRequest(req),
    tenantId,
    module: 'tax-compliance',
    entity: 'GstrFilingSession',
    entityId: updated.id,
    action: 'CHECKER_APPROVE',
    oldValues: { status: row.status },
    newValues: { status: updated.status, checkerUserId: actor },
  })

  return mapSession(updated)
}

export async function submitFiling(req: Request, tenantId: string, id: string) {
  const row = await prisma.gstrFilingSession.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GSTR filing session')
  if (!canSubmitFiling(asSessionStatus(row.status))) {
    throw new InvalidStateError(
      row.status === 'PENDING_CHECKER'
        ? 'Awaiting checker approval before submit.'
        : `Cannot submit filing in status ${row.status}.`,
    )
  }

  const mode = resolveGstrFilingProviderMode()
  const actor = req.context?.userId ?? null

  if (mode === 'LIVE') {
    const live = assertLiveGstrFilingConfigured()
    if (!live.ready) {
      const updated = await prisma.gstrFilingSession.update({
        where: { id: row.id },
        data: {
          status: 'LIVE_BLOCKED',
          providerMode: 'LIVE',
          failureMessage: live.blockers.join('; ').slice(0, 1000),
          requestJson: {
            mode: 'LIVE',
            operation: 'SAVE_AND_FILE',
            blocked: true,
            blockers: live.blockers,
          } as object,
          responseJson: {
            mode: 'LIVE',
            status: 'BLOCKED',
            blockers: live.blockers,
            note: 'LIVE portal filing refused — gates not met; no GSTN call made.',
          } as object,
          submittedAt: new Date(),
          submittedBy: actor,
          updatedBy: actor,
        },
      })
      await createAuditLog({
        ...auditFromRequest(req),
        tenantId,
        module: 'tax-compliance',
        entity: 'GstrFilingSession',
        entityId: updated.id,
        action: 'SUBMIT_LIVE_BLOCKED',
        newValues: { blockers: live.blockers },
      })
      return mapSession(updated)
    }
    // Gates passed but no HTTP transport factory in core FOS
    const updated = await prisma.gstrFilingSession.update({
      where: { id: row.id },
      data: {
        status: 'LIVE_BLOCKED',
        providerMode: 'LIVE',
        failureMessage:
          'LIVE gates passed but no certified GSP/GSTN HTTP transport is registered in this process.',
        requestJson: {
          mode: 'LIVE',
          operation: 'SAVE_AND_FILE',
          blocked: true,
          reason: 'NO_HTTP_TRANSPORT',
        } as object,
        responseJson: {
          mode: 'LIVE',
          status: 'BLOCKED',
          note: 'Core FOS refuses LIVE portal HTTP until connector module registers a transport factory after UAT.',
        } as object,
        submittedAt: new Date(),
        submittedBy: actor,
        updatedBy: actor,
      },
    })
    await createAuditLog({
      ...auditFromRequest(req),
      tenantId,
      module: 'tax-compliance',
      entity: 'GstrFilingSession',
      entityId: updated.id,
      action: 'SUBMIT_LIVE_NO_TRANSPORT',
      newValues: { status: 'LIVE_BLOCKED' },
    })
    return mapSession(updated)
  }

  // SIMULATED path
  const pkg = row.packageJson as { snapshotHash?: string } | null
  const sim = simulatePortalSubmit({
    returnType: row.returnType,
    returnPeriod: row.returnPeriod,
    companyGstin: row.companyGstin,
    packageVersion: row.packageVersion,
    snapshotHash: pkg?.snapshotHash ?? null,
  })

  const updated = await prisma.gstrFilingSession.update({
    where: { id: row.id },
    data: {
      status: 'ACCEPTED_SIMULATED',
      providerMode: 'SIMULATED',
      requestJson: sim.request as object,
      responseJson: sim.response as object,
      acknowledgmentRef: sim.acknowledgmentRef,
      providerRef: sim.providerRef,
      filedOnPortalDate: new Date(`${sim.filedOnPortalDate}T00:00:00.000Z`),
      submittedAt: new Date(),
      submittedBy: actor,
      acceptedAt: new Date(),
      failureMessage: null,
      updatedBy: actor,
    },
  })

  await createAuditLog({
    ...auditFromRequest(req),
    tenantId,
    module: 'tax-compliance',
    entity: 'GstrFilingSession',
    entityId: updated.id,
    action: 'SUBMIT_SIMULATED',
    newValues: {
      acknowledgmentRef: sim.acknowledgmentRef,
      providerRef: sim.providerRef,
      mode: 'SIMULATED',
    },
  })

  return mapSession(updated)
}

/** Manually attach ARN after external portal file (or correct simulated ARN). */
export async function captureArn(
  req: Request,
  tenantId: string,
  id: string,
  input: {
    acknowledgmentRef: string
    filedOnPortalDate: string
    remarks?: string | null
  },
) {
  const row = await prisma.gstrFilingSession.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GSTR filing session')
  if (!canCaptureArn(asSessionStatus(row.status))) {
    throw new InvalidStateError(`Cannot capture ARN in status ${row.status}.`)
  }
  const actor = req.context?.userId ?? null
  const updated = await prisma.gstrFilingSession.update({
    where: { id: row.id },
    data: {
      acknowledgmentRef: input.acknowledgmentRef.trim(),
      filedOnPortalDate: new Date(`${input.filedOnPortalDate}T00:00:00.000Z`),
      remarks: input.remarks?.trim() || row.remarks,
      responseJson: {
        ...(typeof row.responseJson === 'object' && row.responseJson !== null
          ? (row.responseJson as object)
          : {}),
        acknowledgmentRef: input.acknowledgmentRef.trim(),
        filedOnPortalDate: input.filedOnPortalDate,
        capturedManually: true,
      } as object,
      status:
        row.status === 'ACCEPTED_SIMULATED' || row.status === 'SUBMITTED_SIMULATED'
          ? row.status
          : 'ACCEPTED_SIMULATED',
      updatedBy: actor,
    },
  })

  await createAuditLog({
    ...auditFromRequest(req),
    tenantId,
    module: 'tax-compliance',
    entity: 'GstrFilingSession',
    entityId: updated.id,
    action: 'CAPTURE_ARN',
    newValues: {
      acknowledgmentRef: input.acknowledgmentRef.trim(),
      filedOnPortalDate: input.filedOnPortalDate,
    },
  })

  return mapSession(updated)
}

/**
 * Apply Phase 5 mark-filed-external using session ARN — single filing source, no second engine.
 */
export async function markFiledFromSession(
  req: Request,
  tenantId: string,
  id: string,
  input?: { remarks?: string | null },
) {
  const row = await prisma.gstrFilingSession.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GSTR filing session')
  if (!canMarkFiledFromSession(asSessionStatus(row.status))) {
    throw new InvalidStateError(
      row.status === 'MARKED_FILED'
        ? 'Filing session already marked filed.'
        : `Cannot mark filed from status ${row.status}. Submit or capture ARN first.`,
    )
  }
  if (!row.acknowledgmentRef?.trim()) {
    throw new AppError(422, 'Acknowledgment / ARN is required before mark filed', 'ARN_REQUIRED')
  }
  const filedOn =
    row.filedOnPortalDate?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  await markFiledExternally({
    tenantId,
    legalEntityId: row.legalEntityId,
    returnPeriod: row.returnPeriod,
    returnType: row.returnType,
    companyGstin: row.companyGstin,
    actorUserId: req.context?.userId ?? null,
    acknowledgmentRef: row.acknowledgmentRef,
    filedOnPortalDate: filedOn,
    remarks: input?.remarks?.trim() || row.remarks || 'Marked filed via Phase 12 portal filing session',
  })

  const actor = req.context?.userId ?? null
  const updated = await prisma.gstrFilingSession.update({
    where: { id: row.id },
    data: {
      status: 'MARKED_FILED',
      markedFiledAt: new Date(),
      markedFiledBy: actor,
      updatedBy: actor,
    },
  })

  await createAuditLog({
    ...auditFromRequest(req),
    tenantId,
    module: 'tax-compliance',
    entity: 'GstrFilingSession',
    entityId: updated.id,
    action: 'MARK_FILED_FROM_SESSION',
    newValues: {
      acknowledgmentRef: row.acknowledgmentRef,
      returnPeriodId: row.returnPeriodId,
    },
  })

  return mapSession(updated)
}
