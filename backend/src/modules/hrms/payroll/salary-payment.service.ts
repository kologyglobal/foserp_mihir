import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, NotFoundError, UnprocessableEntityError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { maskAccountNumber } from '../employees/employee.mapper.js'
import { add, formatForPersistence, toDecimal } from '../../accounting/shared/finance-decimal.js'
import { post } from '../../accounting/posting/posting.service.js'
import type { PostingContext, PostingRequest } from '../../accounting/posting/posting.types.js'
import type { ConfirmPaymentInput, CreatePaymentBatchInput, ListPaymentBatchesQuery } from './payroll.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const ZERO = '0.0000'

function dec(n: Prisma.Decimal | number | string | null | undefined): number {
  if (n == null) return 0
  return Number(n)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
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

function mapBatch(row: {
  id: string
  payrollRunId: string
  legalEntityId: string
  branchId: string | null
  code: string
  treasuryAccountId: string
  paymentDate: Date
  employeeCount: number
  totalAmount: Prisma.Decimal
  paidAmount: Prisma.Decimal
  pendingAmount: Prisma.Decimal
  failedCount: number
  status: string
  reference: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  accountingPostedAt: Date | null
  approvedAt: Date | null
  approvedByUserId: string | null
  paidAt: Date | null
  paidByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    code: row.code,
    treasuryAccountId: row.treasuryAccountId,
    paymentDate: isoDate(row.paymentDate),
    employeeCount: row.employeeCount,
    totalAmount: dec(row.totalAmount),
    paidAmount: dec(row.paidAmount),
    pendingAmount: dec(row.pendingAmount),
    failedCount: row.failedCount,
    status: row.status,
    reference: row.reference,
    accountingVoucherId: row.accountingVoucherId,
    postingEventId: row.postingEventId,
    accountingPostedAt: row.accountingPostedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByUserId: row.approvedByUserId,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidByUserId: row.paidByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapLine(row: {
  id: string
  batchId: string
  employeeId: string
  payslipId: string
  netPay: Prisma.Decimal
  bankName: string | null
  accountHolderName: string | null
  accountNumberMasked: string | null
  ifsc: string | null
  paymentStatus: string
  paymentReference: string | null
  failureReason: string | null
  paidAt: Date | null
  employee?: { id: string; employeeCode: string; displayName: string } | null
}) {
  return {
    id: row.id,
    batchId: row.batchId,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    payslipId: row.payslipId,
    netPay: dec(row.netPay),
    bankName: row.bankName,
    accountHolderName: row.accountHolderName,
    accountNumberMasked: row.accountNumberMasked,
    ifsc: row.ifsc,
    paymentStatus: row.paymentStatus,
    paymentReference: row.paymentReference,
    failureReason: row.failureReason,
    paidAt: row.paidAt?.toISOString() ?? null,
  }
}

async function loadBatchForAccess(tenantId: string, batchId: string, scope: UserDataScope) {
  const batch = await prisma.hrSalaryPaymentBatch.findFirst({
    where: { id: batchId, tenantId, deletedAt: null },
    include: { lines: { include: { employee: { select: { id: true, employeeCode: true, displayName: true } } } } },
  })
  if (!batch) throw new NotFoundError('Salary payment batch not found')
  assertHrAccess(scope, { legalEntityId: batch.legalEntityId, branchId: batch.branchId })
  return batch
}

async function generateBatchCode(tenantId: string): Promise<string> {
  return nextCode(tenantId, 'SALARY_PAYMENT_BATCH')
}

interface InvalidEmployee {
  employeeId: string
  employeeCode: string
  displayName: string
  reason: string
}

/**
 * Create a DRAFT salary payment batch for the eligible UNPAID/FAILED payslips of a
 * FINALIZED + accounting-POSTED run. Bank details are validated up front and snapshotted
 * onto each line (masked for display, full account number retained for the bank export only).
 */
export async function createBatch(
  tenantId: string,
  input: CreatePaymentBatchInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: input.payrollRunId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })

  if (run.status !== 'FINALIZED') {
    throw new UnprocessableEntityError('Payroll run must be FINALIZED before creating a payment batch', 'PAYROLL_NOT_FINALIZED')
  }
  if (run.accountingStatus !== 'POSTED') {
    throw new UnprocessableEntityError(
      'Payroll accounting must be POSTED before creating a payment batch',
      'PAYROLL_ACCOUNTING_NOT_POSTED',
    )
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: input.treasuryAccountId, tenantId },
  })
  if (!treasuryAccount) throw new NotFoundError('Treasury account not found')
  if (treasuryAccount.status !== 'ACTIVE') {
    throw new ValidationError('Treasury account is not active')
  }
  if (treasuryAccount.legalEntityId !== run.legalEntityId) {
    throw new ValidationError('Treasury account does not belong to the payroll run legal entity')
  }

  const eligiblePayslips = await prisma.hrPayslip.findMany({
    where: {
      tenantId,
      payrollRunId: run.id,
      paymentStatus: { in: ['UNPAID', 'FAILED'] },
      netAmount: { gt: 0 },
      ...(input.employeeIds && input.employeeIds.length > 0 ? { employeeId: { in: input.employeeIds } } : {}),
    },
    include: { employee: { select: { id: true, employeeCode: true, displayName: true } } },
  })

  if (input.employeeIds && input.employeeIds.length > 0) {
    const foundIds = new Set(eligiblePayslips.map((p) => p.employeeId))
    const missing = input.employeeIds.filter((id) => !foundIds.has(id))
    if (missing.length > 0) {
      throw new ValidationError('One or more selected employees have no eligible (UNPAID/FAILED) payslip on this run', [
        { field: 'employeeIds', message: `Not eligible: ${missing.join(', ')}` },
      ])
    }
  }

  if (eligiblePayslips.length === 0) {
    throw new ValidationError('No eligible employees to create a payment batch')
  }

  // Already-batched (non-cancelled) payslips cannot be added to a new batch.
  const alreadyBatched = await prisma.hrSalaryPaymentLine.findMany({
    where: {
      tenantId,
      payslipId: { in: eligiblePayslips.map((p) => p.id) },
      paymentStatus: { in: ['PENDING', 'READY', 'PAID'] },
      batch: { deletedAt: null, status: { not: 'CANCELLED' } },
    },
    select: { payslipId: true },
  })
  const alreadyBatchedIds = new Set(alreadyBatched.map((l) => l.payslipId))
  const candidates = eligiblePayslips.filter((p) => !alreadyBatchedIds.has(p.id))

  if (candidates.length === 0) {
    throw new ValidationError('All selected employees already have a payment in progress for this run')
  }

  const employeeIds = candidates.map((p) => p.employeeId)
  const banks = await prisma.hrEmployeeBankDetail.findMany({
    where: { tenantId, employeeId: { in: employeeIds }, isPrimary: true, deletedAt: null },
  })
  const bankByEmployee = new Map(banks.map((b) => [b.employeeId, b]))

  const invalidEmployees: InvalidEmployee[] = []
  const validPayslips: typeof candidates = []
  for (const payslip of candidates) {
    const bank = bankByEmployee.get(payslip.employeeId)
    if (!bank || !bank.accountNumber?.trim() || !bank.ifsc?.trim()) {
      invalidEmployees.push({
        employeeId: payslip.employeeId,
        employeeCode: payslip.employee.employeeCode,
        displayName: payslip.employee.displayName,
        reason: !bank ? 'No primary bank account on file' : 'Primary bank account is missing account number or IFSC',
      })
    } else {
      validPayslips.push(payslip)
    }
  }

  if (invalidEmployees.length > 0 && !input.skipInvalidEmployees) {
    throw new UnprocessableEntityError(
      `${invalidEmployees.length} employee(s) have invalid or missing bank details`,
      'INVALID_EMPLOYEE_BANK_DETAILS',
      undefined,
      { invalidEmployees },
    )
  }

  if (validPayslips.length === 0) {
    throw new ValidationError('No employees with valid bank details to create a payment batch')
  }

  const totalAmount = validPayslips.reduce((sum, p) => add(sum, p.netAmount), toDecimal(0))

  const batch = await prisma.$transaction(async (tx) => {
    const code = await generateBatchCode(tenantId)
    const created = await tx.hrSalaryPaymentBatch.create({
      data: {
        tenantId,
        payrollRunId: run.id,
        legalEntityId: run.legalEntityId,
        branchId: run.branchId,
        code,
        treasuryAccountId: treasuryAccount.id,
        paymentDate: new Date(input.paymentDate),
        employeeCount: validPayslips.length,
        totalAmount: formatForPersistence(totalAmount, 2),
        pendingAmount: formatForPersistence(totalAmount, 2),
        status: 'DRAFT',
        reference: input.reference ?? null,
        createdBy: audit?.userId,
        updatedBy: audit?.userId,
      },
    })

    for (const payslip of validPayslips) {
      const bank = bankByEmployee.get(payslip.employeeId)!
      await tx.hrSalaryPaymentLine.create({
        data: {
          tenantId,
          batchId: created.id,
          employeeId: payslip.employeeId,
          payslipId: payslip.id,
          netPay: payslip.netAmount,
          bankName: bank.bankName,
          accountHolderName: bank.accountHolderName,
          accountNumberMasked: maskAccountNumber(bank.accountNumber),
          accountNumber: bank.accountNumber,
          ifsc: bank.ifsc,
          paymentStatus: 'PENDING',
        },
      })
    }

    return created
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batch.id,
    action: 'CREATE',
    newValues: {
      code: batch.code,
      payrollRunId: run.id,
      employeeCount: validPayslips.length,
      totalAmount: formatForPersistence(totalAmount, 2),
      skippedInvalidCount: input.skipInvalidEmployees ? invalidEmployees.length : 0,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const full = await loadBatchForAccess(tenantId, batch.id, scope)
  return {
    ...mapBatch(full),
    lines: full.lines.map(mapLine),
    invalidEmployees: input.skipInvalidEmployees ? invalidEmployees : [],
  }
}

export async function listBatches(tenantId: string, scope: UserDataScope, query: ListPaymentBatchesQuery) {
  const { page, limit, skip } = getPagination(query)

  const and: Prisma.HrSalaryPaymentBatchWhereInput[] = []
  if (!scope.unrestricted) {
    if (scope.legalEntities.length > 0) {
      and.push({ legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } })
    }
    if (scope.branches.length > 0) {
      and.push({ branchId: { in: scope.branches.map((x) => x.branchId) } })
    }
  }

  const where: Prisma.HrSalaryPaymentBatchWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrSalaryPaymentBatch.count({ where }),
    prisma.hrSalaryPaymentBatch.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapBatch), total, page, limit }
}

export async function getBatch(tenantId: string, batchId: string, scope: UserDataScope) {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)
  return { ...mapBatch(batch), lines: batch.lines.map(mapLine) }
}

/** Re-validate bank details + totals, then move DRAFT → READY. */
export async function markReady(tenantId: string, batchId: string, scope: UserDataScope, audit?: AuditMeta) {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)
  if (batch.status !== 'DRAFT') {
    throw new InvalidStateError('Only a DRAFT payment batch can be marked READY')
  }

  const invalidLines = batch.lines.filter((l) => !l.accountNumber?.trim() || !l.ifsc?.trim())
  if (invalidLines.length > 0) {
    throw new UnprocessableEntityError(
      `${invalidLines.length} line(s) have invalid or missing bank details`,
      'INVALID_EMPLOYEE_BANK_DETAILS',
      undefined,
      { invalidEmployeeIds: invalidLines.map((l) => l.employeeId) },
    )
  }

  const linesTotal = batch.lines.reduce((sum, l) => add(sum, l.netPay), toDecimal(0))
  if (!linesTotal.equals(toDecimal(batch.totalAmount))) {
    throw new UnprocessableEntityError(
      'Batch line totals do not match the batch total amount',
      'PAYMENT_BATCH_TOTAL_MISMATCH',
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrSalaryPaymentLine.updateMany({
      where: { batchId, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'READY' },
    })
    await tx.hrSalaryPaymentBatch.update({
      where: { id: batchId },
      data: { status: 'READY', updatedBy: audit?.userId },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batchId,
    action: 'READY',
    newValues: { status: 'READY' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getBatch(tenantId, batchId, scope)
}

export async function approveBatch(tenantId: string, batchId: string, scope: UserDataScope, audit?: AuditMeta) {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)
  if (batch.status !== 'READY') {
    throw new InvalidStateError('Only a READY payment batch can be approved')
  }

  const updated = await prisma.hrSalaryPaymentBatch.update({
    where: { id: batchId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: audit?.userId ?? null, updatedBy: audit?.userId },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batchId,
    action: 'APPROVE',
    newValues: { status: 'APPROVED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { ...mapBatch(updated), lines: batch.lines.map(mapLine) }
}

async function recomputeRunPaymentStatus(tenantId: string, runId: string): Promise<void> {
  const statusCounts = await prisma.hrPayslip.groupBy({
    by: ['paymentStatus'],
    where: { tenantId, payrollRunId: runId },
    _count: { _all: true },
  })
  const total = statusCounts.reduce((s, c) => s + c._count._all, 0)
  const paid = statusCounts.find((c) => c.paymentStatus === 'PAID')?._count._all ?? 0
  const attempted =
    (statusCounts.find((c) => c.paymentStatus === 'FAILED')?._count._all ?? 0) +
    (statusCounts.find((c) => c.paymentStatus === 'PARTIAL')?._count._all ?? 0)

  let paymentStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIALLY_PAID' | 'PAID' = 'NOT_STARTED'
  if (total > 0 && paid === total) {
    paymentStatus = 'PAID'
  } else if (paid > 0) {
    paymentStatus = 'PARTIALLY_PAID'
  } else if (attempted > 0) {
    paymentStatus = 'IN_PROGRESS'
  }

  await prisma.hrPayrollRun.update({ where: { id: runId }, data: { paymentStatus } })
}

/**
 * Mark selected lines PAID/FAILED, post the settlement journal for the paid amount
 * (Dr SALARY_PAYABLE / Cr treasury bank GL account), and sync payslip + run payment status.
 * Statutory liability accounts (PF/ESIC/PT/TDS/LWF payable) are never touched here.
 */
export async function confirmPayment(
  tenantId: string,
  batchId: string,
  input: ConfirmPaymentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)
  if (batch.status !== 'APPROVED') {
    throw new InvalidStateError('Only an APPROVED payment batch can be confirmed')
  }

  const failedMap = new Map((input.failedLineIds ?? []).map((f) => [f.id, f.reason]))
  const explicitPaidIds = input.lineIds ? new Set(input.lineIds) : null

  const paidLines = batch.lines.filter((l) => {
    if (failedMap.has(l.id)) return false
    if (explicitPaidIds) return explicitPaidIds.has(l.id)
    return l.paymentStatus === 'PENDING' || l.paymentStatus === 'READY'
  })
  const failedLines = batch.lines.filter((l) => failedMap.has(l.id))

  if (paidLines.length === 0 && failedLines.length === 0) {
    throw new ValidationError('No lines were confirmed as paid or failed')
  }

  const paidTotal = paidLines.reduce((sum, l) => add(sum, l.netPay), toDecimal(0))

  let postingResult: { voucherId: string; postingEventId: string } | null = null
  if (!paidTotal.isZero()) {
    const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: batch.treasuryAccountId, tenantId } })
    if (!treasuryAccount) throw new NotFoundError('Treasury account not found')

    const amount = formatForPersistence(paidTotal, 4)
    const request: PostingRequest = {
      legalEntityId: batch.legalEntityId,
      branchId: batch.branchId ?? null,
      eventKey: `PAYROLL_PAYMENT_POST:${batchId}:V1`,
      eventType: 'PAYROLL_PAYMENT_POSTED',
      postingPurpose: 'SYSTEM_DOCUMENT',
      voucherType: 'PAYMENT',
      documentDate: isoDate(batch.paymentDate),
      postingDate: isoDate(batch.paymentDate),
      referenceNumber: batch.code,
      narration: `Salary payment — batch ${batch.code}`,
      sourceModule: 'HRMS',
      sourceDocumentType: 'SALARY_PAYMENT_BATCH',
      sourceDocumentId: batchId,
      lines: [
        {
          lineNumber: 1,
          accountMappingKey: 'SALARY_PAYABLE',
          debitAmount: amount,
          creditAmount: ZERO,
          lineNarration: `Salary payment — batch ${batch.code}`,
        },
        {
          lineNumber: 2,
          accountId: treasuryAccount.glAccountId,
          debitAmount: ZERO,
          creditAmount: amount,
          lineNarration: `Salary payment — batch ${batch.code}`,
        },
      ],
    }

    const result = await post(request, postingContext(tenantId, audit))
    postingResult = { voucherId: result.voucherId, postingEventId: result.postingEventId }
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const line of paidLines) {
      await tx.hrSalaryPaymentLine.update({
        where: { id: line.id },
        data: { paymentStatus: 'PAID', paidAt: now, paymentReference: batch.reference ?? batch.code },
      })
      await tx.hrPayslip.update({ where: { id: line.payslipId }, data: { paymentStatus: 'PAID' } })
    }
    for (const line of failedLines) {
      const reason = failedMap.get(line.id) ?? 'Payment failed'
      await tx.hrSalaryPaymentLine.update({
        where: { id: line.id },
        data: { paymentStatus: 'FAILED', failureReason: reason.slice(0, 500) },
      })
      await tx.hrPayslip.update({ where: { id: line.payslipId }, data: { paymentStatus: 'FAILED' } })
    }

    const paidAmount = add(toDecimal(batch.paidAmount), paidTotal)
    const failedTotal = failedLines.reduce((sum, l) => add(sum, l.netPay), toDecimal(0))
    const pendingAmount = toDecimal(toDecimal(batch.pendingAmount).sub(paidTotal).sub(failedTotal))

    await tx.hrSalaryPaymentBatch.update({
      where: { id: batchId },
      data: {
        status: 'PAID',
        paidAmount: formatForPersistence(paidAmount, 2),
        pendingAmount: formatForPersistence(pendingAmount.isNegative() ? toDecimal(0) : pendingAmount, 2),
        failedCount: batch.failedCount + failedLines.length,
        paidAt: now,
        paidByUserId: audit?.userId ?? null,
        updatedBy: audit?.userId,
        ...(postingResult
          ? { accountingVoucherId: postingResult.voucherId, postingEventId: postingResult.postingEventId, accountingPostedAt: now }
          : {}),
      },
    })
  })

  await recomputeRunPaymentStatus(tenantId, batch.payrollRunId)

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batchId,
    action: 'CONFIRM_PAYMENT',
    newValues: {
      paidCount: paidLines.length,
      failedCount: failedLines.length,
      paidAmount: formatForPersistence(paidTotal, 2),
      voucherId: postingResult?.voucherId ?? null,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getBatch(tenantId, batchId, scope)
}

export async function exportCsv(tenantId: string, batchId: string, scope: UserDataScope, audit?: AuditMeta): Promise<{ filename: string; csv: string }> {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)

  const header = ['Employee Code', 'Name', 'Account Number', 'IFSC', 'Amount', 'Reference']
  const csvRows = [header.join(',')]
  for (const line of batch.lines) {
    const row = [
      line.employee?.employeeCode ?? '',
      line.employee?.displayName ?? '',
      line.accountNumber ?? '',
      line.ifsc ?? '',
      dec(line.netPay).toFixed(2),
      batch.reference ?? batch.code,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
    csvRows.push(row.join(','))
  }
  const csv = csvRows.join('\n')

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batchId,
    action: 'BANK_EXPORT_GENERATED',
    newValues: { code: batch.code, lineCount: batch.lines.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { filename: `${batch.code}-bank-export.csv`, csv }
}

export async function cancelBatch(tenantId: string, batchId: string, scope: UserDataScope, audit?: AuditMeta) {
  const batch = await loadBatchForAccess(tenantId, batchId, scope)
  if (batch.status === 'PAID' || batch.status === 'CANCELLED') {
    throw new InvalidStateError(`A ${batch.status} payment batch cannot be cancelled`)
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.hrSalaryPaymentLine.updateMany({
      where: { batchId, paymentStatus: { in: ['PENDING', 'READY'] } },
      data: { paymentStatus: 'SKIPPED' },
    })
    return tx.hrSalaryPaymentBatch.update({
      where: { id: batchId },
      data: { status: 'CANCELLED', updatedBy: audit?.userId },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryPaymentBatch',
    entityId: batchId,
    action: 'CANCEL',
    newValues: { status: 'CANCELLED' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { ...mapBatch(updated), lines: batch.lines.map(mapLine) }
}
