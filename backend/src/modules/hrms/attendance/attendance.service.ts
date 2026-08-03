import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import type { CreatePunchInput, ListAttendanceDaysQuery, ListExceptionsQuery } from './attendance.schemas.js'

export async function listAttendanceDays(
  tenantId: string,
  scope: UserDataScope,
  query: ListAttendanceDaysQuery,
) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrAttendanceDayWhereInput = {
    tenantId,
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          attendanceDate: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    employee: { deletedAt: null, ...hrScopeWhere(scope) },
  }

  const [total, rows] = await Promise.all([
    prisma.hrAttendanceDay.count({ where }),
    prisma.hrAttendanceDay.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, displayName: true } },
      },
      orderBy: [{ attendanceDate: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return {
    items: rows.map((r) => ({
      ...r,
      attendanceDate: r.attendanceDate.toISOString().slice(0, 10),
    })),
    total,
    page,
    limit,
  }
}

export async function listAttendanceExceptions(
  tenantId: string,
  scope: UserDataScope,
  query: ListExceptionsQuery,
) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrAttendanceExceptionWhereInput = {
    tenantId,
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
    ...(query.from || query.to
      ? {
          attendanceDate: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    employee: { deletedAt: null, ...hrScopeWhere(scope) },
  }

  const [total, rows] = await Promise.all([
    prisma.hrAttendanceException.count({ where }),
    prisma.hrAttendanceException.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, displayName: true } },
      },
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return {
    items: rows.map((r) => ({
      ...r,
      attendanceDate: r.attendanceDate.toISOString().slice(0, 10),
    })),
    total,
    page,
    limit,
  }
}

/**
 * Record punch evidence. Never deletes punches.
 * If the day is already LEAVE/HALF_DAY, raises an attendance exception and keeps leave status.
 */
export async function createPunch(
  tenantId: string,
  input: CreatePunchInput,
  scope: UserDataScope,
  audit?: { userId?: string; ipAddress?: string | null; userAgent?: string | null },
) {
  const employee = await prisma.hrEmployee.findFirst({
    where: { id: input.employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const punchedAt = new Date(input.punchedAt)
  const attendanceDate = toDateOnly(punchedAt)

  const punch = await prisma.$transaction(async (tx) => {
    const created = await tx.hrAttendancePunch.create({
      data: {
        tenantId,
        employeeId: input.employeeId,
        punchedAt,
        punchType: input.punchType,
        source: input.source ?? 'MANUAL',
        deviceRef: input.deviceRef ?? null,
        note: input.note ?? null,
        createdBy: audit?.userId,
      },
    })

    const existingDay = await tx.hrAttendanceDay.findFirst({
      where: { tenantId, employeeId: input.employeeId, attendanceDate },
    })

    if (existingDay && (existingDay.status === 'LEAVE' || existingDay.status === 'HALF_DAY')) {
      const isHalf = existingDay.status === 'HALF_DAY'
      await tx.hrAttendanceDay.update({
        where: { id: existingDay.id },
        data: {
          hasPunch: true,
          exceptionFlag: true,
          exceptionReason: `Punch retained on ${isHalf ? 'half-day ' : ''}leave`,
          updatedBy: audit?.userId,
        },
      })
      await tx.hrAttendanceException.create({
        data: {
          tenantId,
          employeeId: input.employeeId,
          attendanceDate,
          exceptionType: isHalf ? 'PUNCH_ON_HALF_DAY_LEAVE' : 'PUNCH_ON_LEAVE',
          reason: `Punch retained on ${isHalf ? 'half-day ' : ''}leave`,
          leaveRequestId: existingDay.leaveRequestId,
          punchId: created.id,
          createdBy: audit?.userId,
        },
      })
    } else {
      await tx.hrAttendanceDay.upsert({
        where: {
          tenantId_employeeId_attendanceDate: {
            tenantId,
            employeeId: input.employeeId,
            attendanceDate,
          },
        },
        create: {
          tenantId,
          employeeId: input.employeeId,
          attendanceDate,
          status: 'PRESENT',
          hasPunch: true,
          source: input.source ?? 'BIOMETRIC',
          createdBy: audit?.userId,
          updatedBy: audit?.userId,
        },
        update: {
          hasPunch: true,
          status: existingDay?.leaveRequestId ? existingDay.status : 'PRESENT',
          updatedBy: audit?.userId,
        },
      })
    }

    // Dynamic import avoids a static hrms/attendance ↔ hrms/overtime module cycle.
    const { refreshAttendanceWorkedTime, regenerateOtCandidate } = await import(
      '../overtime/ot-detection.service.js'
    )
    await refreshAttendanceWorkedTime(tx, tenantId, input.employeeId, attendanceDate, audit?.userId)
    await regenerateOtCandidate(tenantId, input.employeeId, attendanceDate, audit?.userId, tx)

    return created
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrAttendancePunch',
    entityId: punch.id,
    action: 'CREATE',
    newValues: { employeeId: input.employeeId, punchType: input.punchType, punchedAt: punch.punchedAt },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return punch
}
