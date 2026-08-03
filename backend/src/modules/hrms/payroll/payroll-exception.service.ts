import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import type { ListExceptionsQuery } from './payroll.schemas.js'

export type ExceptionSeverity = 'BLOCKER' | 'WARNING'

export interface PayrollExceptionDraft {
  code: string
  severity: ExceptionSeverity
  message: string
  employeeId?: string | null
}

/** Approved OT minutes for an employee within a period — payroll input (Phase 5 read-only). */
export async function sumApprovedOtMinutes(
  tenantId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const agg = await prisma.hrOvertimeRecord.aggregate({
    where: {
      tenantId,
      employeeId,
      status: 'APPROVED',
      deletedAt: null,
      attendanceDate: { gte: periodStart, lte: periodEnd },
    },
    _sum: { approvedMinutes: true },
  })
  return agg._sum.approvedMinutes ?? 0
}

/** Count of PENDING OT candidates within a period — surfaced as a WARNING at calculate time. */
export async function countPendingOt(
  tenantId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  return prisma.hrOvertimeRecord.count({
    where: {
      tenantId,
      employeeId,
      status: 'PENDING',
      deletedAt: null,
      attendanceDate: { gte: periodStart, lte: periodEnd },
    },
  })
}

/** Count of unresolved attendance exceptions within a period — a BLOCKER at calculate time. */
export async function countUnresolvedAttendanceExceptions(
  tenantId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  return prisma.hrAttendanceException.count({
    where: {
      tenantId,
      employeeId,
      resolved: false,
      attendanceDate: { gte: periodStart, lte: periodEnd },
    },
  })
}

/** True if the employee has a primary, non-deleted bank detail on file. */
export async function hasPrimaryBankDetail(tenantId: string, employeeId: string): Promise<boolean> {
  const bank = await prisma.hrEmployeeBankDetail.findFirst({
    where: { tenantId, employeeId, isPrimary: true, deletedAt: null },
    select: { id: true },
  })
  return Boolean(bank)
}

/** Employees (by id) among `employeeIds` that still have PENDING OT in the period — used to gate finalize. */
export async function findEmployeesWithPendingOt(
  tenantId: string,
  employeeIds: string[],
  periodStart: Date,
  periodEnd: Date,
): Promise<string[]> {
  if (employeeIds.length === 0) return []
  const rows = await prisma.hrOvertimeRecord.findMany({
    where: {
      tenantId,
      employeeId: { in: employeeIds },
      status: 'PENDING',
      deletedAt: null,
      attendanceDate: { gte: periodStart, lte: periodEnd },
    },
    select: { employeeId: true },
    distinct: ['employeeId'],
  })
  return rows.map((r) => r.employeeId)
}

export async function countUnresolvedBlockers(tenantId: string, payrollRunId: string): Promise<number> {
  return prisma.hrPayrollException.count({
    where: { tenantId, payrollRunId, severity: 'BLOCKER', resolved: false },
  })
}

async function assertRunAccess(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })
  return run
}

export async function listExceptions(
  tenantId: string,
  runId: string,
  scope: UserDataScope,
  query: ListExceptionsQuery,
) {
  await assertRunAccess(tenantId, runId, scope)
  const { page, limit, skip } = getPagination(query)

  const where: Prisma.HrPayrollExceptionWhereInput = {
    tenantId,
    payrollRunId: runId,
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
    ...(query.code ? { code: query.code } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayrollException.count({ where }),
    prisma.hrPayrollException.findMany({
      where,
      include: {
        employeeResult: {
          select: {
            id: true,
            employee: { select: { id: true, employeeCode: true, displayName: true } },
          },
        },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
    }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      payrollRunId: r.payrollRunId,
      payrollEmployeeResultId: r.payrollEmployeeResultId,
      employeeId: r.employeeId,
      employee: r.employeeResult?.employee ?? null,
      code: r.code,
      severity: r.severity,
      message: r.message,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}
