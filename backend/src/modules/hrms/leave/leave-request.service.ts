import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
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
import {
  calculateLeaveDays,
  resolveLeavePolicyForEmployee,
} from './leave-day-calc.service.js'
import {
  syncAttendanceOnLeaveApprove,
  syncAttendanceOnLeaveCancel,
} from '../attendance/leave-attendance-sync.service.js'
import { availableOf, dec, mapBalance } from './leave-setup.service.js'
import type {
  CreateLeaveRequestInput,
  ListRequestsQuery,
  PreviewLeaveInput,
  UpdateLeaveRequestInput,
} from './leave.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Resolves the caller's own HR employee record — used to scope "my" requests/balances. */
export async function findLinkedEmployeeId(tenantId: string, userId: string): Promise<string | null> {
  const emp = await prisma.hrEmployee.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
      status: { in: ['DRAFT', 'ACTIVE', 'ON_NOTICE'] },
    },
    select: { id: true },
  })
  return emp?.id ?? null
}

async function getOrCreateBalance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  userId?: string,
) {
  return tx.hrLeaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: { tenantId, employeeId, leaveTypeId, year },
    },
    create: {
      tenantId,
      employeeId,
      leaveTypeId,
      year,
      createdBy: userId,
      updatedBy: userId,
    },
    update: { updatedBy: userId },
  })
}

async function assertNoOverlap(
  tenantId: string,
  employeeId: string,
  fromDate: Date,
  toDate: Date,
  excludeId?: string,
) {
  const overlapping = await prisma.hrLeaveRequest.findFirst({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      status: { in: ['SUBMITTED', 'APPROVED'] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
  if (overlapping) {
    throw new ConflictError('Overlapping submitted or approved leave request exists')
  }
}

function mapRequest(row: {
  id: string
  employeeId: string
  leaveTypeId: string
  fromDate: Date
  toDate: Date
  durationType: string
  requestedDays: unknown
  reason: string
  status: string
  submittedAt: Date | null
  approvedByUserId: string | null
  approvedByEmployeeId: string | null
  approvedAt: Date | null
  rejectionReason: string | null
  cancelledAt: Date | null
  cancellationReason: string | null
  employee?: {
    id: string
    employeeCode: string
    displayName: string
    department?: { name: string } | null
    branch?: { name: string } | null
    reportingManager?: { id: string; displayName: string; userId: string | null } | null
  } | null
  leaveType?: { id: string; code: string; name: string } | null
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee
      ? {
          id: row.employee.id,
          employeeCode: row.employee.employeeCode,
          displayName: row.employee.displayName,
          department: row.employee.department?.name ?? null,
          branch: row.employee.branch?.name ?? null,
          reportingManager: row.employee.reportingManager
            ? {
                id: row.employee.reportingManager.id,
                displayName: row.employee.reportingManager.displayName,
              }
            : null,
        }
      : null,
    leaveTypeId: row.leaveTypeId,
    leaveType: row.leaveType ?? null,
    fromDate: row.fromDate.toISOString().slice(0, 10),
    toDate: row.toDate.toISOString().slice(0, 10),
    durationType: row.durationType,
    requestedDays: dec(row.requestedDays as number),
    reason: row.reason,
    status: row.status,
    submittedAt: row.submittedAt,
    approvedByUserId: row.approvedByUserId,
    approvedByEmployeeId: row.approvedByEmployeeId ?? null,
    approvedAt: row.approvedAt,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
  }
}

const requestInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      displayName: true,
      userId: true,
      legalEntityId: true,
      branchId: true,
      reportingManagerEmployeeId: true,
      department: { select: { name: true } },
      branch: { select: { name: true } },
      reportingManager: { select: { id: true, displayName: true, userId: true } },
    },
  },
  leaveType: { select: { id: true, code: true, name: true, allowHalfDay: true, allowNegativeBalance: true, paid: true } },
} satisfies Prisma.HrLeaveRequestInclude

export async function previewLeave(
  tenantId: string,
  userId: string,
  input: PreviewLeaveInput,
  scope: UserDataScope,
) {
  const employeeId = input.employeeId ?? (await findLinkedEmployeeId(tenantId, userId))
  if (!employeeId) throw new ValidationError('employeeId is required')

  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const leaveType = await prisma.hrLeaveType.findFirst({
    where: { id: input.leaveTypeId, tenantId, deletedAt: null, isActive: true },
  })
  if (!leaveType) throw new ValidationError('Leave type is invalid')

  const isHalf = input.durationType === 'FIRST_HALF' || input.durationType === 'SECOND_HALF'
  if (isHalf && !leaveType.allowHalfDay) {
    throw new ValidationError('This leave type does not allow half-day leave')
  }

  const policy = await resolveLeavePolicyForEmployee(tenantId, employeeId)
  if (policy.leaveTypeIds && !policy.leaveTypeIds.includes(input.leaveTypeId)) {
    throw new ValidationError('Leave type is not allowed by the applicable leave policy')
  }

  const calc = await calculateLeaveDays(
    tenantId,
    employeeId,
    input.fromDate,
    input.toDate,
    input.durationType,
    {
      excludeHolidays: policy.excludeHolidays,
      excludeWeeklyOff: policy.excludeWeeklyOff,
    },
  )

  const year = new Date(input.fromDate).getUTCFullYear()
  const balance = await prisma.hrLeaveBalance.findFirst({
    where: { tenantId, employeeId, leaveTypeId: input.leaveTypeId, year },
  })
  const mapped = balance
    ? mapBalance(balance)
    : {
        opening: 0,
        accrued: 0,
        pending: 0,
        used: 0,
        adjusted: 0,
        available: 0,
      }

  return {
    employeeId,
    leaveTypeId: input.leaveTypeId,
    leaveTypeCode: leaveType.code,
    requestedDays: calc.requestedDays,
    breakdown: calc.breakdown,
    availableBalance: mapped.available,
    balanceAfterApproval: Math.round((mapped.available - calc.requestedDays) * 100) / 100,
    policy: {
      policyId: policy.policyId,
      excludeHolidays: policy.excludeHolidays,
      excludeWeeklyOff: policy.excludeWeeklyOff,
    },
  }
}

export async function listRequests(tenantId: string, userId: string, scope: UserDataScope, query: ListRequestsQuery) {
  const { page, limit, skip } = getPagination(query)
  const linkedId = await findLinkedEmployeeId(tenantId, userId)

  const where: Prisma.HrLeaveRequestWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    ...(query.from || query.to
      ? {
          fromDate: query.to ? { lte: new Date(query.to) } : undefined,
          toDate: query.from ? { gte: new Date(query.from) } : undefined,
        }
      : {}),
    employee: {
      deletedAt: null,
      ...hrScopeWhere(scope),
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    },
  }

  if (query.mine) {
    if (!linkedId) return { items: [], total: 0, page, limit }
    where.employeeId = linkedId
  } else if (query.employeeId) {
    where.employeeId = query.employeeId
  }

  if (query.pendingApprovals) {
    where.status = 'SUBMITTED'
    if (linkedId) {
      where.employee = {
        ...(where.employee as object),
        reportingManagerEmployeeId: linkedId,
      }
    }
  }

  const [total, rows] = await Promise.all([
    prisma.hrLeaveRequest.count({ where }),
    prisma.hrLeaveRequest.findMany({
      where,
      include: requestInclude,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapRequest), total, page, limit }
}

export async function getRequest(tenantId: string, requestId: string, scope: UserDataScope) {
  const row = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: requestInclude,
  })
  if (!row) throw new NotFoundError('Leave request not found')
  assertHrAccess(scope, {
    legalEntityId: row.employee.legalEntityId,
    branchId: row.employee.branchId,
  })
  return mapRequest(row)
}

export async function createRequest(
  tenantId: string,
  userId: string,
  input: CreateLeaveRequestInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employeeId = input.employeeId ?? (await findLinkedEmployeeId(tenantId, userId))
  if (!employeeId) throw new ValidationError('employeeId is required')

  const preview = await previewLeave(
    tenantId,
    userId,
    { ...input, employeeId },
    scope,
  )
  if (preview.requestedDays <= 0) {
    throw new ValidationError('No leave days to request after holiday/weekly-off exclusions')
  }

  const row = await prisma.hrLeaveRequest.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId: input.leaveTypeId,
      fromDate: new Date(input.fromDate),
      toDate: new Date(input.toDate),
      durationType: input.durationType,
      requestedDays: preview.requestedDays,
      reason: input.reason.trim(),
      status: 'DRAFT',
      createdBy: audit?.userId ?? userId,
      updatedBy: audit?.userId ?? userId,
    },
    include: requestInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveRequest',
    entityId: row.id,
    action: 'CREATE',
    newValues: { status: 'DRAFT', requestedDays: preview.requestedDays },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRequest(row)
}

export async function updateDraft(
  tenantId: string,
  userId: string,
  requestId: string,
  input: UpdateLeaveRequestInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: { employee: true },
  })
  if (!existing) throw new NotFoundError('Leave request not found')
  if (existing.status !== 'DRAFT') throw new ValidationError('Only draft leave requests can be edited')
  assertHrAccess(scope, {
    legalEntityId: existing.employee.legalEntityId,
    branchId: existing.employee.branchId,
  })

  const linkedId = await findLinkedEmployeeId(tenantId, userId)
  const isOwner = linkedId === existing.employeeId || existing.createdBy === userId
  if (!isOwner) {
    // HR manage can edit drafts
  }

  const leaveTypeId = input.leaveTypeId ?? existing.leaveTypeId
  const fromDate = input.fromDate ?? existing.fromDate.toISOString().slice(0, 10)
  const toDate = input.toDate ?? existing.toDate.toISOString().slice(0, 10)
  const durationType = input.durationType ?? existing.durationType

  const preview = await previewLeave(
    tenantId,
    userId,
    { employeeId: existing.employeeId, leaveTypeId, fromDate, toDate, durationType },
    scope,
  )

  const row = await prisma.hrLeaveRequest.update({
    where: { id: requestId },
    data: {
      leaveTypeId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      durationType,
      requestedDays: preview.requestedDays,
      ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      updatedBy: audit?.userId ?? userId,
    },
    include: requestInclude,
  })

  return mapRequest(row)
}

export async function submitRequest(
  tenantId: string,
  userId: string,
  requestId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: { employee: true, leaveType: true },
  })
  if (!existing) throw new NotFoundError('Leave request not found')
  if (existing.status !== 'DRAFT') throw new ValidationError('Only draft requests can be submitted')
  assertHrAccess(scope, {
    legalEntityId: existing.employee.legalEntityId,
    branchId: existing.employee.branchId,
  })

  const days = dec(existing.requestedDays)
  if (days <= 0) throw new ValidationError('Requested days must be greater than zero')

  await assertNoOverlap(tenantId, existing.employeeId, existing.fromDate, existing.toDate, requestId)

  const year = existing.fromDate.getUTCFullYear()
  const policy = await resolveLeavePolicyForEmployee(tenantId, existing.employeeId)
  const allowNeg = existing.leaveType.allowNegativeBalance || policy.allowNegativeBalance

  const updated = await prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(
      tx,
      tenantId,
      existing.employeeId,
      existing.leaveTypeId,
      year,
      userId,
    )
    const avail = availableOf(balance)
    if (!allowNeg && avail < days) {
      throw new ValidationError(`Insufficient leave balance (available ${avail}, requested ${days})`)
    }

    await tx.hrLeaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: days }, updatedBy: userId },
    })

    return tx.hrLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        updatedBy: userId,
      },
      include: requestInclude,
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveRequest',
    entityId: requestId,
    action: 'SUBMIT',
    oldValues: { status: 'DRAFT' },
    newValues: { status: 'SUBMITTED', pendingIncrement: days },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRequest(updated)
}

async function assertCanApprove(
  tenantId: string,
  userId: string,
  employee: { reportingManagerEmployeeId: string | null; legalEntityId: string; branchId: string },
  scope: UserDataScope,
  hasHrManage: boolean,
) {
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })
  if (hasHrManage) return

  if (!employee.reportingManagerEmployeeId) {
    throw new AuthorizationError('No reporting manager assigned; HR Manager must approve')
  }
  const manager = await prisma.hrEmployee.findFirst({
    where: { id: employee.reportingManagerEmployeeId, tenantId, deletedAt: null },
    select: { userId: true },
  })
  if (!manager?.userId || manager.userId !== userId) {
    throw new AuthorizationError('Only the reporting manager or HR Manager can approve this request')
  }
}

export async function approveRequest(
  tenantId: string,
  userId: string,
  requestId: string,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: { employee: true, leaveType: true },
  })
  if (!existing) throw new NotFoundError('Leave request not found')
  if (existing.status !== 'SUBMITTED') throw new ValidationError('Only submitted requests can be approved')

  await assertCanApprove(tenantId, userId, existing.employee, scope, hasHrManage)
  const days = dec(existing.requestedDays)
  const year = existing.fromDate.getUTCFullYear()
  const approverEmployeeId = await findLinkedEmployeeId(tenantId, userId)

  const updated = await prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(
      tx,
      tenantId,
      existing.employeeId,
      existing.leaveTypeId,
      year,
      userId,
    )
    await tx.hrLeaveBalance.update({
      where: { id: balance.id },
      data: {
        pending: { decrement: days },
        used: { increment: days },
        updatedBy: userId,
      },
    })
    const row = await tx.hrLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedByEmployeeId: approverEmployeeId,
        approvedAt: new Date(),
        updatedBy: userId,
      },
      include: requestInclude,
    })

    await syncAttendanceOnLeaveApprove(tx, {
      tenantId,
      leaveRequestId: requestId,
      employeeId: existing.employeeId,
      leaveTypeCode: existing.leaveType.code,
      fromDate: existing.fromDate,
      toDate: existing.toDate,
      durationType: existing.durationType,
      userId,
    })

    return row
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveRequest',
    entityId: requestId,
    action: 'APPROVE',
    oldValues: { status: 'SUBMITTED' },
    newValues: { status: 'APPROVED', attendanceSynced: true },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRequest(updated)
}

export async function rejectRequest(
  tenantId: string,
  userId: string,
  requestId: string,
  reason: string,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: { employee: true },
  })
  if (!existing) throw new NotFoundError('Leave request not found')
  if (existing.status !== 'SUBMITTED') throw new ValidationError('Only submitted requests can be rejected')

  await assertCanApprove(tenantId, userId, existing.employee, scope, hasHrManage)
  const days = dec(existing.requestedDays)
  const year = existing.fromDate.getUTCFullYear()

  const updated = await prisma.$transaction(async (tx) => {
    const balance = await tx.hrLeaveBalance.findFirst({
      where: {
        tenantId,
        employeeId: existing.employeeId,
        leaveTypeId: existing.leaveTypeId,
        year,
      },
    })
    if (balance) {
      await tx.hrLeaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: days }, updatedBy: userId },
      })
    }
    return tx.hrLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedByUserId: userId,
        approvedAt: new Date(),
        updatedBy: userId,
      },
      include: requestInclude,
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveRequest',
    entityId: requestId,
    action: 'REJECT',
    oldValues: { status: 'SUBMITTED' },
    newValues: { status: 'REJECTED', reason },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRequest(updated)
}

export async function cancelRequest(
  tenantId: string,
  userId: string,
  requestId: string,
  reason: string | undefined,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrLeaveRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: { employee: true },
  })
  if (!existing) throw new NotFoundError('Leave request not found')
  assertHrAccess(scope, {
    legalEntityId: existing.employee.legalEntityId,
    branchId: existing.employee.branchId,
  })

  if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(existing.status)) {
    throw new ValidationError('This leave request cannot be cancelled')
  }

  const linkedId = await findLinkedEmployeeId(tenantId, userId)
  const isOwner = linkedId === existing.employeeId
  if (existing.status === 'APPROVED' && !hasHrManage && !isOwner) {
    throw new AuthorizationError('Approved leave cancellation requires HR manage or ownership')
  }

  const days = dec(existing.requestedDays)
  const year = existing.fromDate.getUTCFullYear()

  const updated = await prisma.$transaction(async (tx) => {
    if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED') {
      const balance = await tx.hrLeaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: existing.employeeId,
          leaveTypeId: existing.leaveTypeId,
          year,
        },
      })
      if (balance) {
        if (existing.status === 'SUBMITTED') {
          await tx.hrLeaveBalance.update({
            where: { id: balance.id },
            data: { pending: { decrement: days }, updatedBy: userId },
          })
        } else {
          await tx.hrLeaveBalance.update({
            where: { id: balance.id },
            data: { used: { decrement: days }, updatedBy: userId },
          })
        }
      }
    }

    if (existing.status === 'APPROVED') {
      await syncAttendanceOnLeaveCancel(tx, {
        tenantId,
        leaveRequestId: requestId,
        employeeId: existing.employeeId,
        userId,
      })
    }

    return tx.hrLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByUserId: userId,
        cancellationReason: reason ?? null,
        updatedBy: userId,
      },
      include: requestInclude,
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLeaveRequest',
    entityId: requestId,
    action: 'CANCEL',
    oldValues: { status: existing.status },
    newValues: {
      status: 'CANCELLED',
      reason: reason ?? null,
      attendanceRecalculated: existing.status === 'APPROVED',
    },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRequest(updated)
}

/** Canonical approved-leave source for Attendance Phase (no fake attendance rows). */
export async function listApprovedLeaveDays(
  tenantId: string,
  employeeId: string,
  from: string,
  to: string,
  scope: UserDataScope,
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const rows = await prisma.hrLeaveRequest.findMany({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      status: 'APPROVED',
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
    },
    include: { leaveType: { select: { id: true, code: true, name: true, paid: true } } },
    orderBy: { fromDate: 'asc' },
  })

  return {
    employeeId,
    from,
    to,
    items: rows.map((r) => ({
      requestId: r.id,
      leaveTypeId: r.leaveTypeId,
      leaveType: r.leaveType,
      fromDate: r.fromDate.toISOString().slice(0, 10),
      toDate: r.toDate.toISOString().slice(0, 10),
      durationType: r.durationType,
      requestedDays: dec(r.requestedDays),
      paid: r.leaveType.paid,
    })),
  }
}
