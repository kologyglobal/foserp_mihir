import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import {
  ConflictError,
  InvalidStateError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { runCalculation, type RunCalculationSummary } from './payroll-calc.service.js'
import { countUnresolvedBlockers, findEmployeesWithPendingOt } from './payroll-exception.service.js'
import { confirmRecoveriesForRun } from '../loans/loan-recovery.service.js'
import type { CreateRunInput, ListEmployeeResultsQuery, ListRunsQuery } from './payroll.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const OPEN_RUN_STATUSES = ['DRAFT', 'CALCULATED', 'REVIEWED'] as const

function dec(n: Prisma.Decimal | number | string | null | undefined): number {
  if (n == null) return 0
  return Number(n)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function mapRun(row: {
  id: string
  payrollPeriodId: string
  legalEntityId: string
  branchId: string | null
  code: string
  status: string
  employeeCount: number
  grossAmount: Prisma.Decimal
  deductionAmount: Prisma.Decimal
  employerAmount: Prisma.Decimal
  netAmount: Prisma.Decimal
  calculatedAt: Date | null
  reviewedAt: Date | null
  reviewedByUserId: string | null
  finalizedAt: Date | null
  finalizedByUserId: string | null
  accountingStatus: string
  accountingVoucherId: string | null
  postingEventId: string | null
  accountingPostedAt: Date | null
  accountingPostedByUserId: string | null
  accountingError: string | null
  payslipGeneratedAt: Date | null
  paymentStatus: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    payrollPeriodId: row.payrollPeriodId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    code: row.code,
    status: row.status,
    employeeCount: row.employeeCount,
    grossAmount: dec(row.grossAmount),
    deductionAmount: dec(row.deductionAmount),
    employerAmount: dec(row.employerAmount),
    netAmount: dec(row.netAmount),
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: row.reviewedByUserId,
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    finalizedByUserId: row.finalizedByUserId,
    accountingStatus: row.accountingStatus,
    accountingVoucherId: row.accountingVoucherId,
    postingEventId: row.postingEventId,
    accountingPostedAt: row.accountingPostedAt?.toISOString() ?? null,
    accountingPostedByUserId: row.accountingPostedByUserId,
    accountingError: row.accountingError,
    payslipGeneratedAt: row.payslipGeneratedAt?.toISOString() ?? null,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapEmployeeResultSummary(row: {
  id: string
  payrollRunId: string
  employeeId: string
  totalCalendarDays: number
  basisDays: number
  payableDays: Prisma.Decimal
  lopDays: Prisma.Decimal
  approvedOtMinutes: number
  grossAmount: Prisma.Decimal
  deductionAmount: Prisma.Decimal
  employerAmount: Prisma.Decimal
  netAmount: Prisma.Decimal
  status: string
  errorCode: string | null
  employee?: { id: string; employeeCode: string; displayName: string } | null
}) {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    basisDays: row.basisDays,
    totalCalendarDays: row.totalCalendarDays,
    payableDays: dec(row.payableDays),
    lopDays: dec(row.lopDays),
    approvedOtMinutes: row.approvedOtMinutes,
    grossAmount: dec(row.grossAmount),
    deductionAmount: dec(row.deductionAmount),
    employerAmount: dec(row.employerAmount),
    netAmount: dec(row.netAmount),
    status: row.status,
    errorCode: row.errorCode,
  }
}

function mapEmployeeResultDetail(row: {
  id: string
  payrollRunId: string
  payrollPeriodId: string
  employeeId: string
  salaryStructureId: string | null
  salaryStructureVersionId: string | null
  salaryAssignmentId: string | null
  totalCalendarDays: number
  basisDays: number
  payableDays: Prisma.Decimal
  presentDays: Prisma.Decimal
  paidLeaveDays: Prisma.Decimal
  unpaidLeaveDays: Prisma.Decimal
  lopDays: Prisma.Decimal
  weeklyOffDays: number
  holidayDays: number
  approvedOtMinutes: number
  grossAmount: Prisma.Decimal
  deductionAmount: Prisma.Decimal
  employerAmount: Prisma.Decimal
  netAmount: Prisma.Decimal
  status: string
  paidDaysBreakdownJson: string | null
  calculationNotesJson: string | null
  errorCode: string | null
  errorMessage: string | null
  employee?: { id: string; employeeCode: string; displayName: string } | null
  components: Array<{
    id: string
    salaryComponentId: string | null
    componentCode: string
    componentName: string
    type: string
    calculationType: string
    calculationBasis: string | null
    quantity: Prisma.Decimal | null
    rate: Prisma.Decimal | null
    amount: Prisma.Decimal
    sequence: number
    notes: string | null
  }>
  exceptions: Array<{
    id: string
    code: string
    severity: string
    message: string
    resolved: boolean
    createdAt: Date
  }>
}) {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    payrollPeriodId: row.payrollPeriodId,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    salaryStructureId: row.salaryStructureId,
    salaryStructureVersionId: row.salaryStructureVersionId,
    salaryAssignmentId: row.salaryAssignmentId,
    totalCalendarDays: row.totalCalendarDays,
    basisDays: row.basisDays,
    payableDays: dec(row.payableDays),
    presentDays: dec(row.presentDays),
    paidLeaveDays: dec(row.paidLeaveDays),
    unpaidLeaveDays: dec(row.unpaidLeaveDays),
    lopDays: dec(row.lopDays),
    weeklyOffDays: row.weeklyOffDays,
    holidayDays: row.holidayDays,
    approvedOtMinutes: row.approvedOtMinutes,
    grossAmount: dec(row.grossAmount),
    deductionAmount: dec(row.deductionAmount),
    employerAmount: dec(row.employerAmount),
    netAmount: dec(row.netAmount),
    status: row.status,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    paidDaysBreakdown: parseJson(row.paidDaysBreakdownJson),
    calculationNotes: parseJson(row.calculationNotesJson),
    components: row.components.map((c) => ({
      id: c.id,
      salaryComponentId: c.salaryComponentId,
      componentCode: c.componentCode,
      componentName: c.componentName,
      type: c.type,
      calculationType: c.calculationType,
      calculationBasis: c.calculationBasis,
      quantity: c.quantity == null ? null : dec(c.quantity),
      rate: c.rate == null ? null : dec(c.rate),
      amount: dec(c.amount),
      sequence: c.sequence,
      notes: c.notes,
    })),
    exceptions: row.exceptions.map((e) => ({
      id: e.id,
      code: e.code,
      severity: e.severity,
      message: e.message,
      resolved: e.resolved,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

async function loadRunWithAccess(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })
  return run
}

async function generateRunCode(tenantId: string, period: { year: number; month: number }): Promise<string> {
  const yyyymm = `${period.year}${String(period.month).padStart(2, '0')}`
  const prefix = `PR-${yyyymm}-`
  const existingCount = await prisma.hrPayrollRun.count({ where: { tenantId, code: { startsWith: prefix } } })

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seq = existingCount + 1 + attempt
    const code = `${prefix}${String(seq).padStart(3, '0')}`
    const clash = await prisma.hrPayrollRun.findFirst({ where: { tenantId, code } })
    if (!clash) return code
  }
  throw new ConflictError('Unable to generate a unique payroll run code — please retry')
}

export async function listRuns(tenantId: string, scope: UserDataScope, query: ListRunsQuery) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrPayrollRunWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.payrollPeriodId ? { payrollPeriodId: query.payrollPeriodId } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...hrScopeWhere(scope),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayrollRun.count({ where }),
    prisma.hrPayrollRun.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapRun), total, page, limit }
}

export async function createRun(tenantId: string, input: CreateRunInput, scope: UserDataScope, audit?: AuditMeta) {
  const period = await prisma.hrPayrollPeriod.findFirst({
    where: { id: input.payrollPeriodId, tenantId, deletedAt: null },
  })
  if (!period) throw new NotFoundError('Payroll period not found')
  if (period.status !== 'OPEN') {
    throw new InvalidStateError('Payroll period must be OPEN to create a new run')
  }

  assertHrAccess(scope, { legalEntityId: period.legalEntityId, branchId: input.branchId ?? null })

  if (input.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: input.branchId, tenantId } })
    if (!branch) throw new NotFoundError('Branch not found')
    if (branch.legalEntityId !== period.legalEntityId) {
      throw new ValidationError('Branch does not belong to the period legal entity')
    }
  }

  let code: string
  if (input.code) {
    code = input.code.trim().toUpperCase()
    const clash = await prisma.hrPayrollRun.findFirst({ where: { tenantId, code } })
    if (clash) throw new ConflictError(`Payroll run ${code} already exists`)
  } else {
    code = await generateRunCode(tenantId, period)
  }

  const row = await prisma.hrPayrollRun.create({
    data: {
      tenantId,
      payrollPeriodId: period.id,
      legalEntityId: period.legalEntityId,
      branchId: input.branchId ?? null,
      code,
      status: 'DRAFT',
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, payrollPeriodId: row.payrollPeriodId, branchId: row.branchId },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRun(row)
}

export async function getRun(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await prisma.hrPayrollRun.findFirst({
    where: { id: runId, tenantId, deletedAt: null },
    include: {
      period: true,
      legalEntity: { select: { id: true, code: true, displayName: true, legalName: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })

  const [blockers, warnings, statusCounts] = await Promise.all([
    prisma.hrPayrollException.count({ where: { tenantId, payrollRunId: runId, severity: 'BLOCKER', resolved: false } }),
    prisma.hrPayrollException.count({ where: { tenantId, payrollRunId: runId, severity: 'WARNING', resolved: false } }),
    prisma.hrPayrollEmployeeResult.groupBy({ by: ['status'], where: { tenantId, payrollRunId: runId }, _count: { _all: true } }),
  ])

  return {
    ...mapRun(run),
    period: {
      id: run.period.id,
      year: run.period.year,
      month: run.period.month,
      startDate: isoDate(run.period.startDate),
      endDate: isoDate(run.period.endDate),
      status: run.period.status,
    },
    legalEntity: run.legalEntity,
    branch: run.branch,
    exceptionSummary: { blockers, warnings },
    employeeResultsByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
  }
}

export async function calculateRun(
  tenantId: string,
  runId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
): Promise<RunCalculationSummary> {
  await loadRunWithAccess(tenantId, runId, scope)
  return runCalculation(tenantId, runId, audit)
}

export async function reviewRun(tenantId: string, runId: string, scope: UserDataScope, audit?: AuditMeta) {
  const run = await loadRunWithAccess(tenantId, runId, scope)
  if (run.status !== 'CALCULATED') {
    throw new InvalidStateError('Only a CALCULATED payroll run can be moved to REVIEWED')
  }

  const row = await prisma.hrPayrollRun.update({
    where: { id: runId },
    data: {
      status: 'REVIEWED',
      reviewedAt: new Date(),
      reviewedByUserId: audit?.userId ?? null,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: run.id,
    action: 'REVIEW',
    newValues: { status: 'REVIEWED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRun(row)
}

export async function finalizeRun(tenantId: string, runId: string, scope: UserDataScope, audit?: AuditMeta) {
  const run = await loadRunWithAccess(tenantId, runId, scope)
  if (run.status !== 'REVIEWED') {
    throw new InvalidStateError('Only a REVIEWED payroll run can be finalized')
  }

  const period = await prisma.hrPayrollPeriod.findFirst({ where: { id: run.payrollPeriodId, tenantId } })
  if (!period) throw new NotFoundError('Payroll period not found')

  const results = await prisma.hrPayrollEmployeeResult.findMany({
    where: { tenantId, payrollRunId: runId },
    select: { id: true, employeeId: true, status: true },
  })

  const errorResults = results.filter((r) => r.status === 'ERROR')
  if (errorResults.length > 0) {
    throw new UnprocessableEntityError(
      `${errorResults.length} employee result(s) are in ERROR status — resolve before finalizing`,
      'PAYROLL_FINALIZE_BLOCKED_ERROR_RESULTS',
      undefined,
      { employeeResultIds: errorResults.map((r) => r.id) },
    )
  }

  const includedEmployeeIds = results.filter((r) => r.status === 'CALCULATED').map((r) => r.employeeId)
  const pendingOtEmployeeIds = await findEmployeesWithPendingOt(
    tenantId,
    includedEmployeeIds,
    toDateOnly(period.startDate),
    toDateOnly(period.endDate),
  )
  if (pendingOtEmployeeIds.length > 0) {
    await prisma.hrPayrollException.createMany({
      data: pendingOtEmployeeIds.map((employeeId) => ({
        tenantId,
        payrollRunId: runId,
        employeeId,
        code: 'PENDING_OT_APPROVAL',
        severity: 'BLOCKER' as const,
        message: 'Pending OT approval must be resolved before finalizing payroll',
      })),
    })
    throw new UnprocessableEntityError(
      `${pendingOtEmployeeIds.length} employee(s) have pending OT approvals in this period`,
      'PAYROLL_FINALIZE_BLOCKED_PENDING_OT',
      undefined,
      { employeeIds: pendingOtEmployeeIds },
    )
  }

  const blockerCount = await countUnresolvedBlockers(tenantId, runId)
  if (blockerCount > 0) {
    throw new UnprocessableEntityError(
      `${blockerCount} unresolved BLOCKER exception(s) — resolve before finalizing`,
      'PAYROLL_FINALIZE_BLOCKED',
    )
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.hrPayrollEmployeeResult.updateMany({
      where: { tenantId, payrollRunId: runId, status: 'CALCULATED' },
      data: { status: 'FINALIZED', updatedBy: audit?.userId },
    })

    // Loan/advance recoveries are only ever confirmed here (on finalize), never on calculate —
    // this is the single point where a recovery schedule row is marked RECOVERED/PARTIAL.
    await confirmRecoveriesForRun(tenantId, runId, tx, { userId: audit?.userId })

    await tx.hrPayrollRun.update({
      where: { id: runId },
      data: {
        status: 'FINALIZED',
        finalizedAt: now,
        finalizedByUserId: audit?.userId ?? null,
        updatedBy: audit?.userId,
      },
    })

    const otherOpenRuns = await tx.hrPayrollRun.count({
      where: {
        tenantId,
        payrollPeriodId: run.payrollPeriodId,
        deletedAt: null,
        status: { in: [...OPEN_RUN_STATUSES] },
        NOT: { id: runId },
      },
    })
    if (otherOpenRuns === 0) {
      await tx.hrPayrollPeriod.update({
        where: { id: run.payrollPeriodId },
        data: { status: 'CLOSED', updatedBy: audit?.userId },
      })
    }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: run.id,
    action: 'FINALIZE',
    newValues: { status: 'FINALIZED', employeeCount: includedEmployeeIds.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getRun(tenantId, runId, scope)
}

export async function cancelRun(tenantId: string, runId: string, scope: UserDataScope, audit?: AuditMeta) {
  const run = await loadRunWithAccess(tenantId, runId, scope)
  if (run.status !== 'DRAFT' && run.status !== 'CALCULATED') {
    throw new InvalidStateError('Only DRAFT or CALCULATED payroll runs can be cancelled')
  }
  if (run.accountingStatus === 'POSTED') {
    throw new InvalidStateError('Cannot cancel a payroll run whose accounting has already been posted')
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrPayrollEmployeeResult.deleteMany({ where: { tenantId, payrollRunId: runId } })
    await tx.hrPayrollException.deleteMany({ where: { tenantId, payrollRunId: runId, payrollEmployeeResultId: null } })
    await tx.hrPayrollRun.update({
      where: { id: runId },
      data: {
        status: 'CANCELLED',
        employeeCount: 0,
        grossAmount: 0,
        deductionAmount: 0,
        employerAmount: 0,
        netAmount: 0,
        calculatedAt: null,
        updatedBy: audit?.userId,
      },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: run.id,
    action: 'CANCEL',
    newValues: { status: 'CANCELLED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getRun(tenantId, runId, scope)
}

export async function listEmployeeResults(
  tenantId: string,
  runId: string,
  scope: UserDataScope,
  query: ListEmployeeResultsQuery,
) {
  await loadRunWithAccess(tenantId, runId, scope)
  const { page, limit, skip } = getPagination(query)

  const where: Prisma.HrPayrollEmployeeResultWhereInput = {
    tenantId,
    payrollRunId: runId,
    ...(query.status ? { status: query.status } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayrollEmployeeResult.count({ where }),
    prisma.hrPayrollEmployeeResult.findMany({
      where,
      include: { employee: { select: { id: true, employeeCode: true, displayName: true } } },
      orderBy: [{ createdAt: 'asc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapEmployeeResultSummary), total, page, limit }
}

export async function getEmployeeResult(
  tenantId: string,
  runId: string,
  employeeResultId: string,
  scope: UserDataScope,
) {
  await loadRunWithAccess(tenantId, runId, scope)
  const row = await prisma.hrPayrollEmployeeResult.findFirst({
    where: { id: employeeResultId, tenantId, payrollRunId: runId },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true } },
      components: { orderBy: { sequence: 'asc' } },
      exceptions: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  if (!row) throw new NotFoundError('Payroll employee result not found')
  return mapEmployeeResultDetail(row)
}
