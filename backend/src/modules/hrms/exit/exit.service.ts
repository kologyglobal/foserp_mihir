import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { seedClearanceLinesTx } from './exit-clearance.service.js'
import { computeNotice } from './notice.util.js'
import type {
  ApproveExitInput,
  CreateExitInput,
  ListExitsQuery,
  ListMyExitsQuery,
  UpdateExitDraftInput,
} from './exit.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const ACTIVE_ISH_STATUSES = ['DRAFT', 'ACTIVE', 'ON_NOTICE'] as const
/** Exit statuses that still count as "an exit in progress" for the duplicate-exit guard. */
const OPEN_EXIT_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CLEARANCE_PENDING', 'READY_FOR_SETTLEMENT', 'SETTLED'] as const

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const exitInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      displayName: true,
      userId: true,
      legalEntityId: true,
      branchId: true,
      reportingManagerEmployeeId: true,
      noticePeriodDays: true,
      status: true,
    },
  },
  legalEntity: { select: { id: true, code: true, displayName: true } },
  branch: { select: { id: true, code: true, name: true } },
} satisfies Prisma.HrEmployeeExitInclude

type ExitWithEmployee = Prisma.HrEmployeeExitGetPayload<{ include: typeof exitInclude }>

function mapExit(row: ExitWithEmployee) {
  return {
    id: row.id,
    code: row.code,
    employeeId: row.employeeId,
    employee: row.employee
      ? { id: row.employee.id, employeeCode: row.employee.employeeCode, displayName: row.employee.displayName }
      : null,
    legalEntityId: row.legalEntityId,
    legalEntity: row.legalEntity,
    branchId: row.branchId,
    branch: row.branch,
    exitType: row.exitType,
    resignationDate: row.resignationDate ? isoDate(row.resignationDate) : null,
    requestedLastWorkingDate: isoDate(row.requestedLastWorkingDate),
    approvedLastWorkingDate: row.approvedLastWorkingDate ? isoDate(row.approvedLastWorkingDate) : null,
    noticePeriodDays: row.noticePeriodDays,
    noticeServedDays: row.noticeServedDays,
    noticeShortfallDays: row.noticeShortfallDays,
    noticeExcessDays: row.noticeExcessDays,
    noticeSettlementMode: row.noticeSettlementMode,
    reason: row.reason,
    remarks: row.remarks,
    status: row.status,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function findLinkedEmployeeId(tenantId: string, userId: string): Promise<string | null> {
  const emp = await prisma.hrEmployee.findFirst({
    where: { tenantId, userId, deletedAt: null, status: { in: [...ACTIVE_ISH_STATUSES] } },
    select: { id: true },
  })
  return emp?.id ?? null
}

async function loadExitForAccess(tenantId: string, exitId: string, scope: UserDataScope): Promise<ExitWithEmployee> {
  const row = await prisma.hrEmployeeExit.findFirst({
    where: { id: exitId, tenantId, deletedAt: null },
    include: exitInclude,
  })
  if (!row) throw new NotFoundError('Exit record not found')
  assertHrAccess(scope, { legalEntityId: row.employee.legalEntityId, branchId: row.employee.branchId })
  return row
}

/** Self-approve block (like loans): the employee cannot approve their own exit; otherwise reporting manager or HR manage. */
async function assertCanApprove(
  tenantId: string,
  userId: string,
  employee: { userId: string | null; legalEntityId: string; branchId: string; reportingManagerEmployeeId: string | null },
  scope: UserDataScope,
  hasHrManage: boolean,
): Promise<void> {
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  if (employee.userId && employee.userId === userId) {
    throw new AuthorizationError('Cannot approve your own exit request')
  }
  if (hasHrManage) return

  if (!employee.reportingManagerEmployeeId) {
    throw new AuthorizationError('No reporting manager assigned; HR Manager must approve')
  }
  const manager = await prisma.hrEmployee.findFirst({
    where: { id: employee.reportingManagerEmployeeId, tenantId, deletedAt: null },
    select: { userId: true },
  })
  if (!manager?.userId || manager.userId !== userId) {
    throw new AuthorizationError('Only the reporting manager or HR Manager can approve this exit')
  }
}

export async function listExits(tenantId: string, scope: UserDataScope, query: ListExitsQuery) {
  const { page, limit, skip } = getPagination(query)

  const where: Prisma.HrEmployeeExitWhereInput = {
    tenantId,
    deletedAt: null,
    ...hrScopeWhere(scope),
    ...(query.exitType ? { exitType: query.exitType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrEmployeeExit.count({ where }),
    prisma.hrEmployeeExit.findMany({
      where,
      include: exitInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapExit), total, page, limit }
}

export async function listMine(tenantId: string, userId: string, query: ListMyExitsQuery) {
  const { page, limit, skip } = getPagination(query)
  const employeeId = await findLinkedEmployeeId(tenantId, userId)
  if (!employeeId) return { items: [], total: 0, page, limit }

  const where: Prisma.HrEmployeeExitWhereInput = {
    tenantId,
    deletedAt: null,
    employeeId,
    ...(query.status ? { status: query.status } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrEmployeeExit.count({ where }),
    prisma.hrEmployeeExit.findMany({
      where,
      include: exitInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapExit), total, page, limit }
}

export async function getExit(tenantId: string, exitId: string, scope: UserDataScope) {
  const row = await loadExitForAccess(tenantId, exitId, scope)
  return mapExit(row)
}

export async function createExit(
  tenantId: string,
  userId: string,
  input: CreateExitInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employeeId = input.employeeId ?? (await findLinkedEmployeeId(tenantId, userId))
  if (!employeeId) throw new ValidationError('employeeId is required')

  const employee = await prisma.hrEmployee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  if (!['DRAFT', 'ACTIVE'].includes(employee.status)) {
    throw new ValidationError('Employee must be ACTIVE to initiate an exit')
  }

  const activeExit = await prisma.hrEmployeeExit.findFirst({
    where: { tenantId, employeeId, deletedAt: null, status: { in: [...OPEN_EXIT_STATUSES] } },
  })
  if (activeExit) throw new ConflictError('This employee already has an exit in progress')

  if (input.resignationDate && new Date(input.resignationDate) > new Date(input.requestedLastWorkingDate)) {
    throw new ValidationError('Resignation date cannot be after the requested last working date')
  }

  const noticePeriodDays = input.noticePeriodDays ?? employee.noticePeriodDays ?? 0

  const row = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tenantId, 'EMPLOYEE_EXIT', tx)
    return tx.hrEmployeeExit.create({
      data: {
        tenantId,
        code,
        employeeId,
        legalEntityId: employee.legalEntityId,
        branchId: employee.branchId,
        exitType: input.exitType,
        resignationDate: input.resignationDate ? new Date(input.resignationDate) : null,
        requestedLastWorkingDate: new Date(input.requestedLastWorkingDate),
        noticePeriodDays,
        noticeSettlementMode: input.noticeSettlementMode ?? 'recover',
        reason: input.reason?.trim() ?? null,
        remarks: input.remarks?.trim() ?? null,
        status: 'DRAFT',
        createdBy: audit?.userId ?? userId,
        updatedBy: audit?.userId ?? userId,
      },
      include: exitInclude,
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, exitType: row.exitType, requestedLastWorkingDate: isoDate(row.requestedLastWorkingDate) },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapExit(row)
}

export async function updateDraft(
  tenantId: string,
  userId: string,
  exitId: string,
  input: UpdateExitDraftInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await loadExitForAccess(tenantId, exitId, scope)
  if (existing.status !== 'DRAFT') throw new ValidationError('Only a draft exit can be edited')

  const resignationDate =
    input.resignationDate !== undefined
      ? input.resignationDate === null
        ? null
        : new Date(input.resignationDate)
      : existing.resignationDate
  const requestedLwd = input.requestedLastWorkingDate ? new Date(input.requestedLastWorkingDate) : existing.requestedLastWorkingDate
  if (resignationDate && resignationDate > requestedLwd) {
    throw new ValidationError('Resignation date cannot be after the requested last working date')
  }

  const row = await prisma.hrEmployeeExit.update({
    where: { id: exitId },
    data: {
      ...(input.exitType !== undefined ? { exitType: input.exitType } : {}),
      ...(input.resignationDate !== undefined ? { resignationDate } : {}),
      ...(input.requestedLastWorkingDate !== undefined ? { requestedLastWorkingDate: requestedLwd } : {}),
      ...(input.noticePeriodDays !== undefined ? { noticePeriodDays: input.noticePeriodDays } : {}),
      ...(input.noticeSettlementMode !== undefined ? { noticeSettlementMode: input.noticeSettlementMode } : {}),
      ...(input.reason !== undefined ? { reason: input.reason?.trim() ?? null } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() ?? null } : {}),
      updatedBy: audit?.userId ?? userId,
    },
    include: exitInclude,
  })

  return mapExit(row)
}

export async function submitExit(tenantId: string, userId: string, exitId: string, scope: UserDataScope, audit?: AuditMeta) {
  const existing = await loadExitForAccess(tenantId, exitId, scope)
  if (existing.status !== 'DRAFT') throw new ValidationError('Only a draft exit can be submitted')

  const row = await prisma.hrEmployeeExit.update({
    where: { id: exitId },
    data: { status: 'SUBMITTED', updatedBy: audit?.userId ?? userId },
    include: exitInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'SUBMIT',
    oldValues: { status: 'DRAFT' },
    newValues: { status: 'SUBMITTED' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapExit(row)
}

/**
 * Approve a SUBMITTED exit: locks the last working date, reconciles the notice period,
 * moves the employee to ON_NOTICE (with an employment-history entry), and seeds the
 * clearance checklist — all inside one transaction.
 */
export async function approveExit(
  tenantId: string,
  userId: string,
  exitId: string,
  input: ApproveExitInput,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await loadExitForAccess(tenantId, exitId, scope)
  if (existing.status !== 'SUBMITTED') throw new ValidationError('Only a submitted exit can be approved')

  await assertCanApprove(tenantId, userId, existing.employee, scope, hasHrManage)

  const approvedLwd = input.approvedLastWorkingDate ? new Date(input.approvedLastWorkingDate) : existing.requestedLastWorkingDate
  const noticeMode = input.noticeSettlementMode ?? existing.noticeSettlementMode
  const notice = computeNotice(existing.noticePeriodDays, existing.resignationDate, approvedLwd)

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hrEmployeeExit.update({
      where: { id: exitId },
      data: {
        status: 'CLEARANCE_PENDING',
        approvedLastWorkingDate: approvedLwd,
        noticeServedDays: notice.served,
        noticeShortfallDays: notice.shortfall,
        noticeExcessDays: notice.excess,
        noticeSettlementMode: noticeMode,
        approvedByUserId: userId,
        approvedAt: new Date(),
        remarks: input.remarks?.trim() ?? existing.remarks,
        updatedBy: audit?.userId ?? userId,
      },
      include: exitInclude,
    })

    if (existing.employee.status !== 'ON_NOTICE') {
      await tx.hrEmployee.update({
        where: { id: existing.employeeId },
        data: { status: 'ON_NOTICE', lastWorkingDate: approvedLwd, updatedBy: audit?.userId ?? userId },
      })
      await tx.hrEmployeeEmploymentHistory.create({
        data: {
          tenantId,
          employeeId: existing.employeeId,
          field: 'STATUS',
          oldValue: existing.employee.status,
          newValue: 'ON_NOTICE',
          effectiveFrom: new Date(),
          changedBy: audit?.userId ?? userId,
          reason: `Exit ${existing.code} approved`,
        },
      })
    } else {
      await tx.hrEmployee.update({
        where: { id: existing.employeeId },
        data: { lastWorkingDate: approvedLwd },
      })
    }

    await seedClearanceLinesTx(tx, tenantId, exitId, existing.legalEntityId)

    return row
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'APPROVE',
    oldValues: { status: 'SUBMITTED' },
    newValues: {
      status: 'CLEARANCE_PENDING',
      approvedLastWorkingDate: isoDate(approvedLwd),
      notice,
    },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapExit(updated)
}

export async function cancelExit(
  tenantId: string,
  userId: string,
  exitId: string,
  reason: string | undefined,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await loadExitForAccess(tenantId, exitId, scope)
  if (['SETTLED', 'CLOSED', 'CANCELLED'].includes(existing.status)) {
    throw new ValidationError('This exit cannot be cancelled')
  }

  const settlement = await prisma.hrFullFinalSettlement.findFirst({ where: { tenantId, employeeExitId: exitId } })
  if (settlement && !['DRAFT', 'CALCULATED'].includes(settlement.status)) {
    throw new ValidationError('Cannot cancel an exit once its settlement has been reviewed or approved')
  }

  const linkedId = await findLinkedEmployeeId(tenantId, userId)
  const isOwner = linkedId === existing.employeeId
  if (['APPROVED', 'CLEARANCE_PENDING', 'READY_FOR_SETTLEMENT'].includes(existing.status) && !hasHrManage && !isOwner) {
    throw new AuthorizationError('Cancelling an approved exit requires HR manage or ownership')
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (settlement) {
      await tx.hrFullFinalSettlement.update({ where: { id: settlement.id }, data: { deletedAt: new Date() } })
    }

    const row = await tx.hrEmployeeExit.update({
      where: { id: exitId },
      data: {
        status: 'CANCELLED',
        rejectedReason: reason ?? existing.rejectedReason,
        updatedBy: audit?.userId ?? userId,
      },
      include: exitInclude,
    })

    if (existing.employee.status === 'ON_NOTICE') {
      await tx.hrEmployee.update({
        where: { id: existing.employeeId },
        data: { status: 'ACTIVE', lastWorkingDate: null, updatedBy: audit?.userId ?? userId },
      })
      await tx.hrEmployeeEmploymentHistory.create({
        data: {
          tenantId,
          employeeId: existing.employeeId,
          field: 'STATUS',
          oldValue: 'ON_NOTICE',
          newValue: 'ACTIVE',
          effectiveFrom: new Date(),
          changedBy: audit?.userId ?? userId,
          reason: `Exit ${existing.code} cancelled`,
        },
      })
    }

    return row
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'CANCEL',
    oldValues: { status: existing.status },
    newValues: { status: 'CANCELLED', reason: reason ?? null },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapExit(updated)
}

export { mapExit, findLinkedEmployeeId }
