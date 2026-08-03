import { randomUUID } from 'node:crypto'
import type { HrEmployeeLoanType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import {
  AuthorizationError,
  InvalidStateError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import { add, formatForPersistence, subtract, toDecimal } from '../../accounting/shared/finance-decimal.js'
import { post } from '../../accounting/posting/posting.service.js'
import { PostingError } from '../../accounting/posting/posting.errors.js'
import type { PostingContext, PostingRequest } from '../../accounting/posting/posting.types.js'
import { generateSchedule } from './loan-schedule.service.js'
import type {
  ApproveLoanInput,
  ChangeFutureInstallmentInput,
  CreateLoanInput,
  DisburseLoanInput,
  EarlyRepaymentInput,
  ListLoansQuery,
  ListMyLoansQuery,
  PartialRecoverInput,
  UpdateLoanDraftInput,
} from './loan.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function dec(n: Prisma.Decimal | number | string | null | undefined): number {
  if (n == null) return 0
  return Number(n)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function receivableMappingKey(type: HrEmployeeLoanType): 'EMPLOYEE_LOAN_RECEIVABLE' | 'SALARY_ADVANCE_RECEIVABLE' {
  return type === 'LOAN' ? 'EMPLOYEE_LOAN_RECEIVABLE' : 'SALARY_ADVANCE_RECEIVABLE'
}

function postingContext(tenantId: string, audit?: AuditMeta): PostingContext {
  return {
    tenantId,
    userId: audit?.userId ?? null,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit?.ipAddress ?? null,
    userAgent: audit?.userAgent ?? null,
  }
}

async function findLinkedEmployeeId(tenantId: string, userId: string): Promise<string | null> {
  const emp = await prisma.hrEmployee.findFirst({
    where: { tenantId, userId, deletedAt: null, status: { in: ['DRAFT', 'ACTIVE', 'ON_NOTICE'] } },
    select: { id: true },
  })
  return emp?.id ?? null
}

const loanInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      displayName: true,
      userId: true,
      legalEntityId: true,
      branchId: true,
      reportingManagerEmployeeId: true,
    },
  },
} satisfies Prisma.HrEmployeeLoanInclude

type LoanWithEmployee = Prisma.HrEmployeeLoanGetPayload<{ include: typeof loanInclude }>

function mapLoan(row: LoanWithEmployee) {
  return {
    id: row.id,
    code: row.code,
    employeeId: row.employeeId,
    employee: row.employee
      ? { id: row.employee.id, employeeCode: row.employee.employeeCode, displayName: row.employee.displayName }
      : null,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    type: row.type,
    requestDate: isoDate(row.requestDate),
    requestedAmount: dec(row.requestedAmount),
    approvedAmount: row.approvedAmount == null ? null : dec(row.approvedAmount),
    disbursedAmount: dec(row.disbursedAmount),
    recoveredAmount: dec(row.recoveredAmount),
    outstandingAmount: dec(row.outstandingAmount),
    recoveryStartYear: row.recoveryStartYear,
    recoveryStartMonth: row.recoveryStartMonth,
    installmentAmount: row.installmentAmount == null ? null : dec(row.installmentAmount),
    installmentCount: row.installmentCount,
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejectionReason,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedByUserId: row.rejectedByUserId,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    disbursedAt: row.disbursedAt?.toISOString() ?? null,
    disbursementMethod: row.disbursementMethod,
    treasuryAccountId: row.treasuryAccountId,
    disbursementReference: row.disbursementReference,
    disbursementVoucherId: row.disbursementVoucherId,
    closedAt: row.closedAt?.toISOString() ?? null,
    closedByUserId: row.closedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapSchedule(row: {
  id: string
  installmentNo: number
  year: number
  month: number
  dueAmount: Prisma.Decimal
  recoveredAmount: Prisma.Decimal
  status: string
  payrollRunId: string | null
  payrollEmployeeResultId: string | null
  skipReason: string | null
  notes: string | null
  recoveredAt: Date | null
}) {
  return {
    id: row.id,
    installmentNo: row.installmentNo,
    year: row.year,
    month: row.month,
    dueAmount: dec(row.dueAmount),
    recoveredAmount: dec(row.recoveredAmount),
    status: row.status,
    payrollRunId: row.payrollRunId,
    payrollEmployeeResultId: row.payrollEmployeeResultId,
    skipReason: row.skipReason,
    notes: row.notes,
    recoveredAt: row.recoveredAt?.toISOString() ?? null,
  }
}

function mapRepayment(row: {
  id: string
  amount: Prisma.Decimal
  repaymentDate: Date
  method: string
  treasuryAccountId: string | null
  reference: string | null
  reason: string | null
  accountingVoucherId: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    amount: dec(row.amount),
    repaymentDate: isoDate(row.repaymentDate),
    method: row.method,
    treasuryAccountId: row.treasuryAccountId,
    reference: row.reference,
    reason: row.reason,
    accountingVoucherId: row.accountingVoucherId,
    createdAt: row.createdAt.toISOString(),
  }
}

async function generateLoanCode(tenantId: string, type: HrEmployeeLoanType): Promise<string> {
  return nextCode(tenantId, type === 'LOAN' ? 'EMPLOYEE_LOAN' : 'SALARY_ADVANCE')
}

async function loadLoanForAccess(tenantId: string, loanId: string, scope: UserDataScope): Promise<LoanWithEmployee> {
  const row = await prisma.hrEmployeeLoan.findFirst({
    where: { id: loanId, tenantId, deletedAt: null },
    include: loanInclude,
  })
  if (!row) throw new NotFoundError('Loan not found')
  assertHrAccess(scope, { legalEntityId: row.employee.legalEntityId, branchId: row.employee.branchId })
  return row
}

async function assertCanApprove(
  tenantId: string,
  userId: string,
  employee: { userId: string | null; legalEntityId: string; branchId: string; reportingManagerEmployeeId: string | null },
  scope: UserDataScope,
  hasHrManage: boolean,
): Promise<void> {
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  if (employee.userId && employee.userId === userId) {
    throw new AuthorizationError('Cannot approve or reject your own loan/advance request')
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
    throw new AuthorizationError('Only the reporting manager or HR Manager can approve this request')
  }
}

export async function listLoans(tenantId: string, scope: UserDataScope, query: ListLoansQuery) {
  const { page, limit, skip } = getPagination(query)

  const where: Prisma.HrEmployeeLoanWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    employee: {
      deletedAt: null,
      ...hrScopeWhere(scope),
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    },
  }

  const [total, rows] = await Promise.all([
    prisma.hrEmployeeLoan.count({ where }),
    prisma.hrEmployeeLoan.findMany({
      where,
      include: loanInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapLoan), total, page, limit }
}

export async function listMine(tenantId: string, userId: string, query: ListMyLoansQuery) {
  const { page, limit, skip } = getPagination(query)
  const employeeId = await findLinkedEmployeeId(tenantId, userId)
  if (!employeeId) return { items: [], total: 0, page, limit }

  const where: Prisma.HrEmployeeLoanWhereInput = {
    tenantId,
    deletedAt: null,
    employeeId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrEmployeeLoan.count({ where }),
    prisma.hrEmployeeLoan.findMany({
      where,
      include: loanInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapLoan), total, page, limit }
}

export async function getLoan(tenantId: string, loanId: string, scope: UserDataScope) {
  const row = await loadLoanForAccess(tenantId, loanId, scope)
  const [schedules, repayments] = await Promise.all([
    prisma.hrLoanRecoverySchedule.findMany({ where: { tenantId, loanId }, orderBy: { installmentNo: 'asc' } }),
    prisma.hrLoanRepayment.findMany({ where: { tenantId, loanId }, orderBy: { createdAt: 'desc' } }),
  ])
  return {
    ...mapLoan(row),
    schedules: schedules.map(mapSchedule),
    repayments: repayments.map(mapRepayment),
  }
}

export async function createLoan(
  tenantId: string,
  userId: string,
  input: CreateLoanInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const employeeId = input.employeeId ?? (await findLinkedEmployeeId(tenantId, userId))
  if (!employeeId) throw new ValidationError('employeeId is required')

  const employee = await prisma.hrEmployee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
  })
  if (!employee) throw new NotFoundError('Employee not found')
  assertHrAccess(scope, { legalEntityId: employee.legalEntityId, branchId: employee.branchId })

  const code = await generateLoanCode(tenantId, input.type)

  const row = await prisma.hrEmployeeLoan.create({
    data: {
      tenantId,
      code,
      employeeId,
      legalEntityId: employee.legalEntityId,
      branchId: employee.branchId,
      type: input.type,
      requestDate: new Date(input.requestDate),
      requestedAmount: formatForPersistence(input.requestedAmount, 2),
      reason: input.reason?.trim() ?? null,
      status: 'DRAFT',
      createdBy: audit?.userId ?? userId,
      updatedBy: audit?.userId ?? userId,
    },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, type: row.type, requestedAmount: dec(row.requestedAmount) },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

export async function updateDraft(
  tenantId: string,
  userId: string,
  loanId: string,
  input: UpdateLoanDraftInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (existing.status !== 'DRAFT') throw new ValidationError('Only draft loans/advances can be edited')

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.requestDate !== undefined ? { requestDate: new Date(input.requestDate) } : {}),
      ...(input.requestedAmount !== undefined ? { requestedAmount: formatForPersistence(input.requestedAmount, 2) } : {}),
      ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      updatedBy: audit?.userId ?? userId,
    },
    include: loanInclude,
  })

  return mapLoan(row)
}

export async function submitLoan(tenantId: string, userId: string, loanId: string, scope: UserDataScope, audit?: AuditMeta) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (existing.status !== 'DRAFT') throw new ValidationError('Only draft loans/advances can be submitted')
  if (dec(existing.requestedAmount) <= 0) throw new ValidationError('Requested amount must be greater than zero')

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: { status: 'SUBMITTED', updatedBy: audit?.userId ?? userId },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'SUBMIT',
    oldValues: { status: 'DRAFT' },
    newValues: { status: 'SUBMITTED' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

export async function approveLoan(
  tenantId: string,
  userId: string,
  loanId: string,
  input: ApproveLoanInput,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (existing.status !== 'SUBMITTED') throw new ValidationError('Only submitted loans/advances can be approved')

  await assertCanApprove(tenantId, userId, existing.employee, scope, hasHrManage)

  const approvedAmount = input.approvedAmount ?? dec(existing.requestedAmount)
  if (approvedAmount <= 0) throw new ValidationError('Approved amount must be greater than zero')
  if (approvedAmount > dec(existing.requestedAmount)) {
    throw new ValidationError('Approved amount cannot exceed the requested amount')
  }

  const installmentAmount = input.installmentAmount ?? (existing.installmentAmount == null ? null : dec(existing.installmentAmount))
  const installmentCount = input.installmentCount ?? existing.installmentCount ?? null
  if (installmentAmount == null && installmentCount == null) {
    throw new ValidationError('Either installmentAmount or installmentCount must be provided to approve')
  }

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: {
      status: 'APPROVED',
      approvedAmount: formatForPersistence(approvedAmount, 2),
      installmentAmount: installmentAmount == null ? null : formatForPersistence(installmentAmount, 2),
      installmentCount,
      recoveryStartYear: input.recoveryStartYear,
      recoveryStartMonth: input.recoveryStartMonth,
      approvedByUserId: userId,
      approvedAt: new Date(),
      updatedBy: audit?.userId ?? userId,
    },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'APPROVE',
    oldValues: { status: 'SUBMITTED' },
    newValues: { status: 'APPROVED', approvedAmount },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

export async function rejectLoan(
  tenantId: string,
  userId: string,
  loanId: string,
  reason: string,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (existing.status !== 'SUBMITTED') throw new ValidationError('Only submitted loans/advances can be rejected')

  await assertCanApprove(tenantId, userId, existing.employee, scope, hasHrManage)

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      rejectedByUserId: userId,
      rejectedAt: new Date(),
      updatedBy: audit?.userId ?? userId,
    },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'REJECT',
    oldValues: { status: 'SUBMITTED' },
    newValues: { status: 'REJECTED', reason },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

export async function cancelLoan(
  tenantId: string,
  userId: string,
  loanId: string,
  reason: string | undefined,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(existing.status)) {
    throw new ValidationError('This loan/advance cannot be cancelled once disbursed')
  }

  const linkedId = await findLinkedEmployeeId(tenantId, userId)
  const isOwner = linkedId === existing.employeeId
  if (existing.status === 'APPROVED' && !hasHrManage && !isOwner) {
    throw new AuthorizationError('Approved loan/advance cancellation requires HR manage or ownership')
  }

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: {
      status: 'CANCELLED',
      rejectionReason: reason ?? existing.rejectionReason,
      updatedBy: audit?.userId ?? userId,
    },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'CANCEL',
    oldValues: { status: existing.status },
    newValues: { status: 'CANCELLED', reason: reason ?? null },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

/**
 * Disburse an APPROVED loan/advance: post Dr receivable / Cr treasury bank, then generate
 * the recovery schedule. Idempotent via a deterministic eventKey — replaying after a
 * successful disbursement returns the already-disbursed loan unchanged.
 */
export async function disburseLoan(
  tenantId: string,
  loanId: string,
  input: DisburseLoanInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)

  if (existing.disbursementPostingEventId && existing.status !== 'APPROVED') {
    return getLoan(tenantId, loanId, scope)
  }
  if (existing.status !== 'APPROVED') {
    throw new InvalidStateError('Only an APPROVED loan/advance can be disbursed')
  }
  if (existing.approvedAmount == null || dec(existing.approvedAmount) <= 0) {
    throw new ValidationError('Loan/advance has no approved amount to disburse')
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: input.treasuryAccountId, tenantId } })
  if (!treasuryAccount) throw new NotFoundError('Treasury account not found')
  if (treasuryAccount.status !== 'ACTIVE') throw new ValidationError('Treasury account is not active')
  if (treasuryAccount.legalEntityId !== existing.legalEntityId) {
    throw new ValidationError('Treasury account does not belong to the loan legal entity')
  }

  const disbursedAmount = toDecimal(existing.approvedAmount)
  const amountStr = formatForPersistence(disbursedAmount, 4)
  const mappingKey = receivableMappingKey(existing.type)

  const request: PostingRequest = {
    legalEntityId: existing.legalEntityId,
    branchId: existing.branchId ?? null,
    eventKey: `LOAN_DISBURSE:${loanId}:V1`,
    eventType: 'LOAN_DISBURSED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'PAYMENT',
    documentDate: input.paymentDate,
    postingDate: input.paymentDate,
    referenceNumber: existing.code,
    narration: `${existing.type === 'LOAN' ? 'Loan' : 'Salary advance'} disbursement — ${existing.code}`,
    sourceModule: 'HRMS',
    sourceDocumentType: 'EMPLOYEE_LOAN',
    sourceDocumentId: loanId,
    lines: [
      {
        lineNumber: 1,
        accountMappingKey: mappingKey,
        debitAmount: amountStr,
        creditAmount: '0.0000',
        partyNameSnapshot: existing.employee?.displayName ?? existing.code,
        lineNarration: `${existing.code} disbursement`,
      },
      {
        lineNumber: 2,
        accountId: treasuryAccount.glAccountId,
        debitAmount: '0.0000',
        creditAmount: amountStr,
        lineNarration: `${existing.code} disbursement`,
      },
    ],
  }

  let result
  try {
    result = await post(request, postingContext(tenantId, audit))
  } catch (error) {
    if (error instanceof PostingError && error.code === 'ACCOUNTING_PERIOD_CLOSED') {
      throw new UnprocessableEntityError(`Could not disburse: ${error.message}`, 'NO_OPEN_ACCOUNTING_PERIOD')
    }
    throw error
  }

  const scheduleInput = {
    loanId,
    tenantId,
    disbursedAmount,
    installmentAmount: existing.installmentAmount,
    installmentCount: existing.installmentCount,
    recoveryStartYear: existing.recoveryStartYear ?? new Date(input.paymentDate).getUTCFullYear(),
    recoveryStartMonth: existing.recoveryStartMonth ?? new Date(input.paymentDate).getUTCMonth() + 1,
  }

  await prisma.$transaction(async (tx) => {
    const generated = await generateSchedule(tx, scheduleInput)
    await tx.hrEmployeeLoan.update({
      where: { id: loanId },
      data: {
        status: generated.length > 0 ? 'RECOVERING' : 'DISBURSED',
        disbursedAmount: formatForPersistence(disbursedAmount, 2),
        outstandingAmount: formatForPersistence(disbursedAmount, 2),
        disbursedAt: new Date(input.paymentDate),
        disbursementMethod: input.method,
        treasuryAccountId: input.treasuryAccountId,
        disbursementReference: input.reference ?? null,
        disbursementVoucherId: result.voucherId,
        disbursementPostingEventId: result.postingEventId,
        updatedBy: audit?.userId,
      },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'DISBURSE',
    newValues: { voucherId: result.voucherId, disbursedAmount: formatForPersistence(disbursedAmount, 2) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getLoan(tenantId, loanId, scope)
}

export async function skipInstallment(
  tenantId: string,
  loanId: string,
  scheduleId: string,
  reason: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const loan = await loadLoanForAccess(tenantId, loanId, scope)
  const schedule = await prisma.hrLoanRecoverySchedule.findFirst({ where: { id: scheduleId, tenantId, loanId } })
  if (!schedule) throw new NotFoundError('Recovery schedule row not found')
  if (schedule.status !== 'PENDING') throw new ValidationError('Only a pending installment can be skipped')

  const row = await prisma.hrLoanRecoverySchedule.update({
    where: { id: scheduleId },
    data: { status: 'SKIPPED', skipReason: reason },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLoanRecoverySchedule',
    entityId: scheduleId,
    action: 'SKIP',
    oldValues: { status: 'PENDING' },
    newValues: { status: 'SKIPPED', reason },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { loan: mapLoan(loan), schedule: mapSchedule(row) }
}

export async function partialRecover(
  tenantId: string,
  loanId: string,
  scheduleId: string,
  input: PartialRecoverInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const loan = await loadLoanForAccess(tenantId, loanId, scope)
  const schedule = await prisma.hrLoanRecoverySchedule.findFirst({ where: { id: scheduleId, tenantId, loanId } })
  if (!schedule) throw new NotFoundError('Recovery schedule row not found')
  if (schedule.status !== 'PENDING') {
    throw new ValidationError('Only a pending installment can be manually recovered')
  }

  const dueAmount = toDecimal(schedule.dueAmount)
  const amount = toDecimal(input.amount)
  if (amount.gt(dueAmount)) {
    throw new ValidationError('Amount exceeds the due installment — use early repayment for full payoff amounts')
  }

  const newStatus = amount.gte(dueAmount) ? ('RECOVERED' as const) : ('PARTIAL' as const)

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSchedule = await tx.hrLoanRecoverySchedule.update({
      where: { id: scheduleId },
      data: {
        recoveredAmount: formatForPersistence(amount, 2),
        status: newStatus,
        notes: input.reason,
        recoveredAt: new Date(),
      },
    })

    const newRecovered = add(loan.recoveredAmount, amount)
    const newOutstandingRaw = subtract(loan.outstandingAmount, amount)
    const newOutstanding = newOutstandingRaw.isNegative() ? toDecimal(0) : newOutstandingRaw
    const remainingPending = await tx.hrLoanRecoverySchedule.count({
      where: { tenantId, loanId, status: 'PENDING' },
    })
    const shouldClose = newOutstanding.lte(0) && remainingPending === 0

    const updatedLoan = await tx.hrEmployeeLoan.update({
      where: { id: loanId },
      data: {
        recoveredAmount: formatForPersistence(newRecovered, 2),
        outstandingAmount: formatForPersistence(newOutstanding, 2),
        ...(shouldClose ? { status: 'CLOSED' as const, closedAt: new Date(), closedByUserId: audit?.userId ?? null } : {}),
        updatedBy: audit?.userId,
      },
      include: loanInclude,
    })

    return { schedule: updatedSchedule, loan: updatedLoan }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrLoanRecoverySchedule',
    entityId: scheduleId,
    action: 'PARTIAL_RECOVER',
    oldValues: { status: 'PENDING' },
    newValues: { status: newStatus, amount: formatForPersistence(amount, 2), reason: input.reason },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { loan: mapLoan(updated.loan), schedule: mapSchedule(updated.schedule) }
}

/** Cancel/reduce future PENDING installments (most-future-first) to absorb an early repayment. */
async function reduceFutureSchedules(
  tx: Prisma.TransactionClient,
  tenantId: string,
  loanId: string,
  amount: Prisma.Decimal,
): Promise<void> {
  let remaining = amount
  if (remaining.lte(0)) return

  const pending = await tx.hrLoanRecoverySchedule.findMany({
    where: { tenantId, loanId, status: 'PENDING' },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { installmentNo: 'desc' }],
  })

  for (const schedule of pending) {
    if (remaining.lte(0)) break
    const dueAmount = toDecimal(schedule.dueAmount)
    if (dueAmount.lte(remaining)) {
      await tx.hrLoanRecoverySchedule.update({
        where: { id: schedule.id },
        data: { status: 'SKIPPED', skipReason: 'Cancelled by early repayment' },
      })
      remaining = subtract(remaining, dueAmount)
    } else {
      await tx.hrLoanRecoverySchedule.update({
        where: { id: schedule.id },
        data: { dueAmount: formatForPersistence(subtract(dueAmount, remaining), 2) },
      })
      remaining = toDecimal(0)
    }
  }
}

/**
 * Record a lump-sum repayment against a disbursed loan/advance: posts Dr treasury bank /
 * Cr receivable, reduces outstanding, and cancels/shrinks future PENDING installments from
 * the end so total remaining schedule dues stay in sync with the new outstanding balance.
 */
export async function recordEarlyRepayment(
  tenantId: string,
  userId: string,
  loanId: string,
  input: EarlyRepaymentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (!['DISBURSED', 'RECOVERING'].includes(existing.status)) {
    throw new ValidationError('Only a disbursed loan/advance can receive a repayment')
  }

  const amount = toDecimal(input.amount)
  const outstanding = toDecimal(existing.outstandingAmount)
  if (amount.gt(outstanding)) {
    throw new ValidationError(`Repayment amount (${formatForPersistence(amount, 2)}) exceeds outstanding balance (${formatForPersistence(outstanding, 2)})`)
  }

  let postingResult: { voucherId: string; postingEventId: string } | null = null
  if (input.treasuryAccountId) {
    const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: input.treasuryAccountId, tenantId } })
    if (!treasuryAccount) throw new NotFoundError('Treasury account not found')
    if (treasuryAccount.status !== 'ACTIVE') throw new ValidationError('Treasury account is not active')

    const amountStr = formatForPersistence(amount, 4)
    const mappingKey = receivableMappingKey(existing.type)
    const repaymentId = randomUUID()

    const request: PostingRequest = {
      legalEntityId: existing.legalEntityId,
      branchId: existing.branchId ?? null,
      eventKey: `LOAN_REPAY:${repaymentId}:V1`,
      eventType: 'LOAN_REPAYMENT',
      postingPurpose: 'SYSTEM_DOCUMENT',
      voucherType: 'RECEIPT',
      documentDate: input.date,
      postingDate: input.date,
      referenceNumber: existing.code,
      narration: `${existing.type === 'LOAN' ? 'Loan' : 'Salary advance'} repayment — ${existing.code}`,
      sourceModule: 'HRMS',
      sourceDocumentType: 'EMPLOYEE_LOAN',
      sourceDocumentId: loanId,
      lines: [
        {
          lineNumber: 1,
          accountId: treasuryAccount.glAccountId,
          debitAmount: amountStr,
          creditAmount: '0.0000',
          lineNarration: `${existing.code} repayment`,
        },
        {
          lineNumber: 2,
          accountMappingKey: mappingKey,
          debitAmount: '0.0000',
          creditAmount: amountStr,
          partyNameSnapshot: existing.employee?.displayName ?? existing.code,
          lineNarration: `${existing.code} repayment`,
        },
      ],
    }

    const result = await post(request, postingContext(tenantId, audit))
    postingResult = { voucherId: result.voucherId, postingEventId: result.postingEventId }

    const updated = await prisma.$transaction(async (tx) => {
      await reduceFutureSchedules(tx, tenantId, loanId, amount)

      const newRecovered = add(existing.recoveredAmount, amount)
      const newOutstandingRaw = subtract(existing.outstandingAmount, amount)
      const newOutstanding = newOutstandingRaw.isNegative() ? toDecimal(0) : newOutstandingRaw
      const remainingPending = await tx.hrLoanRecoverySchedule.count({
        where: { tenantId, loanId, status: 'PENDING' },
      })
      const shouldClose = newOutstanding.lte(0) && remainingPending === 0

      const updatedLoan = await tx.hrEmployeeLoan.update({
        where: { id: loanId },
        data: {
          recoveredAmount: formatForPersistence(newRecovered, 2),
          outstandingAmount: formatForPersistence(newOutstanding, 2),
          ...(shouldClose ? { status: 'CLOSED' as const, closedAt: new Date(), closedByUserId: audit?.userId ?? userId } : {}),
          updatedBy: audit?.userId ?? userId,
        },
        include: loanInclude,
      })

      const repayment = await tx.hrLoanRepayment.create({
        data: {
          id: repaymentId,
          tenantId,
          loanId,
          amount: formatForPersistence(amount, 2),
          repaymentDate: new Date(input.date),
          method: input.method,
          treasuryAccountId: input.treasuryAccountId ?? null,
          reference: input.reference ?? null,
          reason: input.reason ?? null,
          accountingVoucherId: postingResult?.voucherId ?? null,
          postingEventId: postingResult?.postingEventId ?? null,
          createdBy: audit?.userId ?? userId,
        },
      })

      return { loan: updatedLoan, repayment }
    })

    await createAuditLog({
      tenantId,
      module: 'hrms',
      entity: 'HrEmployeeLoan',
      entityId: loanId,
      action: 'REPAYMENT',
      newValues: { amount: formatForPersistence(amount, 2), voucherId: postingResult?.voucherId ?? null },
      userId: audit?.userId ?? userId,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    })

    return { loan: mapLoan(updated.loan), repayment: mapRepayment(updated.repayment) }
  }

  throw new ValidationError('treasuryAccountId is required to post this repayment to accounting')
}

export async function changeFutureInstallment(
  tenantId: string,
  loanId: string,
  input: ChangeFutureInstallmentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (!['DISBURSED', 'RECOVERING'].includes(existing.status)) {
    throw new ValidationError('Only a disbursed loan/advance can have its future installments changed')
  }

  const pending = await prisma.hrLoanRecoverySchedule.findMany({
    where: { tenantId, loanId, status: 'PENDING' },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })
  if (pending.length === 0) {
    throw new ValidationError('No pending installments remain to adjust')
  }

  const perInstallment = toDecimal(input.installmentAmount)
  const outstanding = toDecimal(existing.outstandingAmount)
  const count = outstanding.div(perInstallment).ceil().toNumber()
  const applicable = pending.slice(0, Math.max(count, 1))

  await prisma.$transaction(async (tx) => {
    let running = toDecimal(0)
    for (let i = 0; i < applicable.length; i += 1) {
      const isLast = i === applicable.length - 1
      const dueAmount = isLast ? subtract(outstanding, running) : perInstallment
      running = add(running, dueAmount)
      await tx.hrLoanRecoverySchedule.update({
        where: { id: applicable[i].id },
        data: { dueAmount: formatForPersistence(dueAmount, 2), notes: input.reason },
      })
    }
    await tx.hrEmployeeLoan.update({
      where: { id: loanId },
      data: { installmentAmount: formatForPersistence(perInstallment, 2), updatedBy: audit?.userId },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'CHANGE_FUTURE_INSTALLMENT',
    newValues: { installmentAmount: formatForPersistence(perInstallment, 2), reason: input.reason },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getLoan(tenantId, loanId, scope)
}

export async function closeLoan(tenantId: string, loanId: string, scope: UserDataScope, audit?: AuditMeta) {
  const existing = await loadLoanForAccess(tenantId, loanId, scope)
  if (!['DISBURSED', 'RECOVERING'].includes(existing.status)) {
    throw new ValidationError('Only a disbursed loan/advance can be closed')
  }
  if (dec(existing.outstandingAmount) > 0) {
    throw new ValidationError('Loan/advance still has an outstanding balance')
  }
  const pendingCount = await prisma.hrLoanRecoverySchedule.count({ where: { tenantId, loanId, status: 'PENDING' } })
  if (pendingCount > 0) {
    throw new ValidationError('Loan/advance still has pending installments')
  }

  const row = await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: { status: 'CLOSED', closedAt: new Date(), closedByUserId: audit?.userId ?? null, updatedBy: audit?.userId },
    include: loanInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeLoan',
    entityId: loanId,
    action: 'CLOSE',
    newValues: { status: 'CLOSED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapLoan(row)
}

/** Defensive recompute of recoveredAmount/outstandingAmount from schedule + repayment rows. */
export async function recalculateOutstanding(tenantId: string, loanId: string): Promise<void> {
  const loan = await prisma.hrEmployeeLoan.findFirst({ where: { id: loanId, tenantId, deletedAt: null } })
  if (!loan) throw new NotFoundError('Loan not found')

  const [schedules, repayments] = await Promise.all([
    prisma.hrLoanRecoverySchedule.findMany({ where: { tenantId, loanId } }),
    prisma.hrLoanRepayment.findMany({ where: { tenantId, loanId } }),
  ])

  const fromSchedules = schedules.reduce((sum, s) => add(sum, s.recoveredAmount), toDecimal(0))
  const fromRepayments = repayments.reduce((sum, r) => add(sum, r.amount), toDecimal(0))
  const recovered = add(fromSchedules, fromRepayments)
  const outstandingRaw = subtract(loan.disbursedAmount, recovered)
  const outstanding = outstandingRaw.isNegative() ? toDecimal(0) : outstandingRaw

  await prisma.hrEmployeeLoan.update({
    where: { id: loanId },
    data: {
      recoveredAmount: formatForPersistence(recovered, 2),
      outstandingAmount: formatForPersistence(outstanding, 2),
    },
  })
}

export { mapLoan, mapSchedule, mapRepayment }
