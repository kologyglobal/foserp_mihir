import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { mapOt } from './ot-detection.service.js'
import type {
  ApproveOtInput,
  BulkOtActionInput,
  CreateManualOtInput,
  ListOtQuery,
  MonthlySummaryQuery,
} from './overtime.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const otInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      displayName: true,
      userId: true,
      legalEntityId: true,
      branchId: true,
      departmentId: true,
      reportingManagerEmployeeId: true,
      department: { select: { name: true } },
      branch: { select: { name: true } },
    },
  },
  shift: { select: { id: true, code: true, name: true } },
} satisfies Prisma.HrOvertimeRecordInclude

type OtRecordWithRelations = Prisma.HrOvertimeRecordGetPayload<{ include: typeof otInclude }>

async function findLinkedEmployeeId(tenantId: string, userId: string): Promise<string | null> {
  const emp = await prisma.hrEmployee.findFirst({
    where: { tenantId, userId, deletedAt: null, status: { in: ['DRAFT', 'ACTIVE', 'ON_NOTICE'] } },
    select: { id: true },
  })
  return emp?.id ?? null
}

async function assertCanApproveOt(
  tenantId: string,
  userId: string,
  employee: {
    userId: string | null
    legalEntityId: string
    branchId: string
    reportingManagerEmployeeId: string | null
  },
  scope: UserDataScope,
  hasHrManage: boolean,
): Promise<void> {
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  if (employee.userId && employee.userId === userId) {
    throw new AuthorizationError('Cannot approve or reject your own overtime request')
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
    throw new AuthorizationError('Only the reporting manager or HR Manager can approve this overtime request')
  }
}

export async function listOt(tenantId: string, userId: string, scope: UserDataScope, query: ListOtQuery) {
  const { page, limit, skip } = getPagination(query)
  const linkedId = await findLinkedEmployeeId(tenantId, userId)

  const where: Prisma.HrOvertimeRecordWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          attendanceDate: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
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

  if (query.pendingTeam) {
    where.status = 'PENDING'
    if (linkedId) {
      where.employee = {
        ...(where.employee as object),
        reportingManagerEmployeeId: linkedId,
      }
    }
  }

  const [total, rows] = await Promise.all([
    prisma.hrOvertimeRecord.count({ where }),
    prisma.hrOvertimeRecord.findMany({
      where,
      include: otInclude,
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapOt), total, page, limit }
}

export async function getOt(tenantId: string, otId: string, scope: UserDataScope) {
  const row = await prisma.hrOvertimeRecord.findFirst({
    where: { id: otId, tenantId, deletedAt: null },
    include: otInclude,
  })
  if (!row) throw new NotFoundError('Overtime record not found')
  assertHrAccess(scope, { legalEntityId: row.employee.legalEntityId, branchId: row.employee.branchId })
  return mapOt(row)
}

/**
 * Manual OT entry (e.g. field staff without biometric punches). Always lands as PENDING —
 * even manager-entered records go through the same approval workflow for audit consistency.
 * If a CANCELLED record already exists for the date, it is revived in place (unique constraint
 * on tenantId+employeeId+attendanceDate means a "correction" reuses the same row; the prior
 * cancelled state is preserved in the audit log, not a new row).
 */
export async function createManualOt(
  tenantId: string,
  userId: string,
  input: CreateManualOtInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employee = await prisma.hrEmployee.findFirst({ where: { id: input.employeeId, tenantId, deletedAt: null } })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const attendanceDate = toDateOnly(input.attendanceDate)
  const existing = await prisma.hrOvertimeRecord.findFirst({
    where: { tenantId, employeeId: input.employeeId, attendanceDate, deletedAt: null },
  })
  if (existing && existing.status !== 'CANCELLED') {
    throw new ConflictError(
      'An overtime record already exists for this employee/date — cancel it first to submit a correction',
    )
  }

  const data = {
    status: 'PENDING' as const,
    detectedMinutes: input.minutes,
    eligibleMinutes: input.minutes,
    approvedMinutes: null,
    reason: input.reason.trim(),
    requestedByUserId: userId,
    source: 'MANUAL' as const,
    approvedByUserId: null,
    approvedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    updatedBy: userId,
  }

  const row = existing
    ? await prisma.hrOvertimeRecord.update({ where: { id: existing.id }, data, include: otInclude })
    : await prisma.hrOvertimeRecord.create({
        data: { tenantId, employeeId: input.employeeId, attendanceDate, createdBy: userId, ...data },
        include: otInclude,
      })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimeRecord',
    entityId: row.id,
    action: existing ? 'REVIVE_MANUAL' : 'CREATE_MANUAL',
    oldValues: existing
      ? { status: existing.status, approvedMinutes: existing.approvedMinutes, cancellationReason: existing.cancellationReason }
      : undefined,
    newValues: { minutes: input.minutes, status: 'PENDING' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapOt(row)
}

export async function approveOt(
  tenantId: string,
  userId: string,
  otId: string,
  input: ApproveOtInput,
  scope: UserDataScope,
  hasHrManage: boolean,
  hasOverrideLimit: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrOvertimeRecord.findFirst({
    where: { id: otId, tenantId, deletedAt: null },
    include: otInclude,
  })
  if (!existing) throw new NotFoundError('Overtime record not found')
  if (existing.status !== 'PENDING') throw new ValidationError('Only pending overtime requests can be approved')

  await assertCanApproveOt(tenantId, userId, existing.employee, scope, hasHrManage)

  const canOverride = Boolean(input.overrideLimit) && hasOverrideLimit
  if (input.approvedMinutes > existing.eligibleMinutes && !canOverride) {
    throw new ValidationError(
      `Approved minutes (${input.approvedMinutes}) cannot exceed eligible minutes (${existing.eligibleMinutes}) without override permission`,
    )
  }

  const row = await prisma.hrOvertimeRecord.update({
    where: { id: otId },
    data: {
      status: 'APPROVED',
      approvedMinutes: input.approvedMinutes,
      approvedByUserId: userId,
      approvedAt: new Date(),
      ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      updatedBy: userId,
    },
    include: otInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimeRecord',
    entityId: otId,
    action: 'APPROVE',
    oldValues: { status: 'PENDING', eligibleMinutes: existing.eligibleMinutes },
    newValues: { status: 'APPROVED', approvedMinutes: input.approvedMinutes, overrideUsed: canOverride },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapOt(row)
}

export async function rejectOt(
  tenantId: string,
  userId: string,
  otId: string,
  reason: string,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrOvertimeRecord.findFirst({
    where: { id: otId, tenantId, deletedAt: null },
    include: otInclude,
  })
  if (!existing) throw new NotFoundError('Overtime record not found')
  if (existing.status !== 'PENDING') throw new ValidationError('Only pending overtime requests can be rejected')

  await assertCanApproveOt(tenantId, userId, existing.employee, scope, hasHrManage)

  const row = await prisma.hrOvertimeRecord.update({
    where: { id: otId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      approvedByUserId: userId,
      approvedAt: new Date(),
      updatedBy: userId,
    },
    include: otInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimeRecord',
    entityId: otId,
    action: 'REJECT',
    oldValues: { status: 'PENDING' },
    newValues: { status: 'REJECTED', reason },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapOt(row)
}

export async function cancelOt(
  tenantId: string,
  userId: string,
  otId: string,
  reason: string | undefined,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrOvertimeRecord.findFirst({
    where: { id: otId, tenantId, deletedAt: null },
    include: otInclude,
  })
  if (!existing) throw new NotFoundError('Overtime record not found')
  assertHrAccess(scope, { legalEntityId: existing.employee.legalEntityId, branchId: existing.employee.branchId })

  if (existing.status !== 'PENDING' && existing.status !== 'APPROVED') {
    throw new ValidationError('Only pending or approved overtime requests can be cancelled')
  }

  const linkedId = await findLinkedEmployeeId(tenantId, userId)
  const isOwner = linkedId === existing.employeeId
  if (existing.status === 'APPROVED' && !hasHrManage && !isOwner) {
    throw new AuthorizationError('Approved overtime cancellation requires HR manage or ownership')
  }

  const row = await prisma.hrOvertimeRecord.update({
    where: { id: otId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledByUserId: userId,
      cancellationReason: reason ?? null,
      updatedBy: userId,
    },
    include: otInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrOvertimeRecord',
    entityId: otId,
    action: 'CANCEL',
    oldValues: { status: existing.status },
    newValues: { status: 'CANCELLED', reason: reason ?? null },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapOt(row)
}

export async function bulkApprove(
  tenantId: string,
  userId: string,
  input: BulkOtActionInput,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const approved: string[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const id of input.ids) {
    try {
      const record = await prisma.hrOvertimeRecord.findFirst({ where: { id, tenantId, deletedAt: null } })
      if (!record) throw new NotFoundError('Overtime record not found')
      await approveOt(
        tenantId,
        userId,
        id,
        { approvedMinutes: record.eligibleMinutes, reason: input.reason, overrideLimit: false },
        scope,
        hasHrManage,
        false,
        audit,
      )
      approved.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { approved, failed }
}

export async function bulkReject(
  tenantId: string,
  userId: string,
  input: BulkOtActionInput,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const reason = input.reason?.trim()
  if (!reason) throw new ValidationError('reason is required for bulk rejection')

  const rejected: string[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const id of input.ids) {
    try {
      await rejectOt(tenantId, userId, id, reason, scope, hasHrManage, audit)
      rejected.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { rejected, failed }
}

interface MonthlySummaryBucket {
  employeeId: string
  employee: { id: string; employeeCode: string; displayName: string } | null
  recordCount: number
  detectedMinutes: number
  pendingMinutes: number
  approvedMinutes: number
  rejectedMinutes: number
  cancelledMinutes: number
}

export async function monthlySummary(tenantId: string, scope: UserDataScope, query: MonthlySummaryQuery) {
  const from = new Date(Date.UTC(query.year, query.month - 1, 1))
  const to = new Date(Date.UTC(query.year, query.month, 0))

  const where: Prisma.HrOvertimeRecordWhereInput = {
    tenantId,
    deletedAt: null,
    attendanceDate: { gte: from, lte: to },
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    employee: {
      deletedAt: null,
      ...hrScopeWhere(scope),
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    },
  }

  const rows = await prisma.hrOvertimeRecord.findMany({
    where,
    include: { employee: { select: { id: true, employeeCode: true, displayName: true } } },
    orderBy: { attendanceDate: 'asc' },
  })

  const byEmployee = new Map<string, MonthlySummaryBucket>()
  for (const r of rows) {
    const bucket =
      byEmployee.get(r.employeeId) ??
      ({
        employeeId: r.employeeId,
        employee: r.employee,
        recordCount: 0,
        detectedMinutes: 0,
        pendingMinutes: 0,
        approvedMinutes: 0,
        rejectedMinutes: 0,
        cancelledMinutes: 0,
      } satisfies MonthlySummaryBucket)

    bucket.recordCount += 1
    bucket.detectedMinutes += r.detectedMinutes
    if (r.status === 'PENDING') bucket.pendingMinutes += r.eligibleMinutes
    if (r.status === 'APPROVED') bucket.approvedMinutes += r.approvedMinutes ?? 0
    if (r.status === 'REJECTED') bucket.rejectedMinutes += r.eligibleMinutes
    if (r.status === 'CANCELLED') bucket.cancelledMinutes += r.approvedMinutes ?? 0

    byEmployee.set(r.employeeId, bucket)
  }

  return {
    year: query.year,
    month: query.month,
    items: [...byEmployee.values()].sort((a, b) =>
      (a.employee?.displayName ?? '').localeCompare(b.employee?.displayName ?? ''),
    ),
  }
}

export type { OtRecordWithRelations }
