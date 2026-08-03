import type { DefaultAccountMappingKey, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
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
import { deactivateUser } from '../../users/user-invitation.service.js'
import { add, formatForPersistence, toDecimal } from '../../accounting/shared/finance-decimal.js'
import { post } from '../../accounting/posting/posting.service.js'
import { PostingError } from '../../accounting/posting/posting.errors.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../../accounting/posting/posting.types.js'
import type { ListFnfQuery, PayFnfInput } from './exit.schemas.js'

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

const settlementInclude = {
  employee: { select: { id: true, employeeCode: true, displayName: true, userId: true, status: true } },
  exit: { select: { id: true, code: true, status: true, employeeId: true } },
  components: { orderBy: { sequence: 'asc' } },
} satisfies Prisma.HrFullFinalSettlementInclude

type SettlementRow = Prisma.HrFullFinalSettlementGetPayload<{ include: typeof settlementInclude }>

export interface FnfException {
  code: string
  severity: 'WARNING' | 'BLOCKER'
  message: string
}

function parseExceptions(json: string | null): FnfException[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapComponent(c: {
  id: string
  kind: string
  code: string
  name: string
  amount: Prisma.Decimal
  calculationBasis: string | null
  sourceRef: string | null
  sequence: number
  mappingKeyHint: string | null
}) {
  return {
    id: c.id,
    kind: c.kind,
    code: c.code,
    name: c.name,
    amount: dec(c.amount),
    calculationBasis: c.calculationBasis,
    sourceRef: c.sourceRef,
    sequence: c.sequence,
    mappingKeyHint: c.mappingKeyHint,
  }
}

function mapSettlement(row: SettlementRow) {
  return {
    id: row.id,
    code: row.code,
    employeeExitId: row.employeeExitId,
    exit: row.exit,
    employeeId: row.employeeId,
    employee: row.employee
      ? { id: row.employee.id, employeeCode: row.employee.employeeCode, displayName: row.employee.displayName }
      : null,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    lastWorkingDate: isoDate(row.lastWorkingDate),
    status: row.status,
    earningsTotal: dec(row.earningsTotal),
    deductionsTotal: dec(row.deductionsTotal),
    netSettlement: dec(row.netSettlement),
    exceptions: parseExceptions(row.exceptionsJson),
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: row.reviewedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByUserId: row.approvedByUserId,
    postedAt: row.postedAt?.toISOString() ?? null,
    postedByUserId: row.postedByUserId,
    accountingVoucherId: row.accountingVoucherId,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidByUserId: row.paidByUserId,
    paymentMethod: row.paymentMethod,
    treasuryAccountId: row.treasuryAccountId,
    paymentReference: row.paymentReference,
    paymentVoucherId: row.paymentVoucherId,
    components: row.components.map(mapComponent),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadSettlementByExit(tenantId: string, exitId: string, scope: UserDataScope): Promise<SettlementRow> {
  const row = await prisma.hrFullFinalSettlement.findFirst({
    where: { employeeExitId: exitId, tenantId, deletedAt: null },
    include: settlementInclude,
  })
  if (!row) throw new NotFoundError('Full & final settlement not found for this exit — calculate it first')
  assertHrAccess(scope, { legalEntityId: row.legalEntityId, branchId: row.branchId })
  return row
}

export async function getSettlementByExit(tenantId: string, exitId: string, scope: UserDataScope) {
  const row = await loadSettlementByExit(tenantId, exitId, scope)
  return mapSettlement(row)
}

export async function listSettlements(tenantId: string, scope: UserDataScope, query: ListFnfQuery) {
  const { page, limit, skip } = getPagination(query)

  const where: Prisma.HrFullFinalSettlementWhereInput = {
    tenantId,
    deletedAt: null,
    ...hrScopeWhere(scope),
    ...(query.status ? { status: query.status } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrFullFinalSettlement.count({ where }),
    prisma.hrFullFinalSettlement.findMany({
      where,
      include: settlementInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapSettlement), total, page, limit }
}

export async function reviewSettlement(
  tenantId: string,
  userId: string,
  exitId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const row = await loadSettlementByExit(tenantId, exitId, scope)
  if (row.status !== 'CALCULATED') throw new ValidationError('Only a calculated settlement can be marked reviewed')

  const updated = await prisma.hrFullFinalSettlement.update({
    where: { id: row.id },
    data: { status: 'REVIEWED', reviewedAt: new Date(), reviewedByUserId: userId, updatedBy: audit?.userId ?? userId },
    include: settlementInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrFullFinalSettlement',
    entityId: row.id,
    action: 'REVIEW',
    oldValues: { status: 'CALCULATED' },
    newValues: { status: 'REVIEWED' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapSettlement(updated)
}

/** Approve is immutable after — recalculation and self-approval are both blocked from this point on. */
export async function approveSettlement(
  tenantId: string,
  userId: string,
  exitId: string,
  scope: UserDataScope,
  hasHrManage: boolean,
  audit?: AuditMeta,
) {
  const row = await loadSettlementByExit(tenantId, exitId, scope)
  if (!['CALCULATED', 'REVIEWED'].includes(row.status)) {
    throw new ValidationError('Only a calculated/reviewed settlement can be approved')
  }

  if (row.employee.userId && row.employee.userId === userId) {
    throw new AuthorizationError('Cannot approve your own full & final settlement')
  }
  if (!hasHrManage) {
    throw new AuthorizationError('Only an HR Manager can approve a full & final settlement')
  }

  const blockers = parseExceptions(row.exceptionsJson).filter((e) => e.severity === 'BLOCKER')
  if (blockers.length > 0) {
    throw new UnprocessableEntityError(
      `Settlement has ${blockers.length} unresolved blocker(s): ${blockers.map((b) => b.code).join(', ')}`,
      'FNF_BLOCKERS_UNRESOLVED',
      undefined,
      { blockers },
    )
  }

  const updated = await prisma.hrFullFinalSettlement.update({
    where: { id: row.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: userId, updatedBy: audit?.userId ?? userId },
    include: settlementInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrFullFinalSettlement',
    entityId: row.id,
    action: 'APPROVE',
    oldValues: { status: row.status },
    newValues: { status: 'APPROVED' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapSettlement(updated)
}

/**
 * Complete the exit lifecycle: employee → EXITED (exitDate/lastWorkingDate = settlement LWD),
 * linked user deactivated, exit status SETTLED then CLOSED. Called automatically after a
 * successful payment, or immediately after posting when nothing is payable to the employee.
 */
async function completeExit(tenantId: string, exitId: string, audit?: AuditMeta): Promise<void> {
  const exit = await prisma.hrEmployeeExit.findFirst({
    where: { id: exitId, tenantId, deletedAt: null },
    include: { employee: true },
  })
  if (!exit) throw new NotFoundError('Exit record not found')
  if (exit.status === 'CLOSED') return

  const lwd = exit.approvedLastWorkingDate ?? exit.requestedLastWorkingDate

  await prisma.$transaction(async (tx) => {
    await tx.hrEmployee.update({
      where: { id: exit.employeeId },
      data: { status: 'EXITED', exitDate: lwd, lastWorkingDate: lwd, updatedBy: audit?.userId },
    })
    await tx.hrEmployeeEmploymentHistory.create({
      data: {
        tenantId,
        employeeId: exit.employeeId,
        field: 'STATUS',
        oldValue: exit.employee.status,
        newValue: 'EXITED',
        effectiveFrom: lwd,
        changedBy: audit?.userId,
        reason: `Exit ${exit.code} settled`,
      },
    })
    await tx.hrEmployeeExit.update({ where: { id: exitId }, data: { status: 'SETTLED', updatedBy: audit?.userId } })
    await tx.hrEmployeeExit.update({ where: { id: exitId }, data: { status: 'CLOSED', updatedBy: audit?.userId } })
  })

  if (exit.employee.userId) {
    try {
      await deactivateUser(tenantId, exit.employee.userId, audit)
    } catch {
      // Non-fatal — user may already be inactive/archived; exit completion still proceeds.
    }
  }

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'COMPLETE_EXIT',
    newValues: { employeeStatus: 'EXITED', exitStatus: 'CLOSED', exitDate: isoDate(lwd) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
}

/**
 * Post the APPROVED settlement's journal: EARNING components debit their expense mapping,
 * DEDUCTION components credit their receivable/income/statutory mapping, and the net
 * balances against EMPLOYEE_FNF_PAYABLE (net > 0) or EMPLOYEE_FNF_RECEIVABLE (net < 0).
 * No EMPLOYEE partyType is set on any line. Idempotent via `FNF_POST:{id}:V1`.
 */
export async function postSettlement(tenantId: string, exitId: string, scope: UserDataScope, audit?: AuditMeta) {
  const row = await loadSettlementByExit(tenantId, exitId, scope)

  if (row.postingEventId) {
    return mapSettlement(row)
  }
  if (row.status !== 'APPROVED') {
    throw new InvalidStateError('Only an APPROVED settlement can be posted')
  }

  const buckets = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>()
  const bump = (key: string, side: 'debit' | 'credit', amount: Prisma.Decimal) => {
    const bucket = buckets.get(key) ?? { debit: toDecimal(0), credit: toDecimal(0) }
    bucket[side] = add(bucket[side], amount)
    buckets.set(key, bucket)
  }

  for (const component of row.components) {
    const amount = toDecimal(component.amount)
    if (amount.isZero()) continue
    if (!component.mappingKeyHint) {
      throw new UnprocessableEntityError(
        `Component ${component.code} has no account mapping configured`,
        'MISSING_FNF_ACCOUNT_MAPPING',
        undefined,
        { componentCode: component.code },
      )
    }
    bump(component.mappingKeyHint, component.kind === 'EARNING' ? 'debit' : 'credit', amount)
  }

  const net = toDecimal(row.netSettlement)
  if (net.gt(0)) {
    bump('EMPLOYEE_FNF_PAYABLE', 'credit', net)
  } else if (net.lt(0)) {
    bump('EMPLOYEE_FNF_RECEIVABLE', 'debit', net.abs())
  }

  const nonZeroKeys = [...buckets.entries()]
    .filter(([, bucket]) => !bucket.debit.isZero() || !bucket.credit.isZero())
    .map(([key]) => key)

  if (nonZeroKeys.length > 0) {
    const mappings = await prisma.defaultAccountMapping.findMany({
      where: { tenantId, legalEntityId: row.legalEntityId, mappingKey: { in: nonZeroKeys as DefaultAccountMappingKey[] } },
      select: { mappingKey: true },
    })
    const configured = new Set(mappings.map((m) => m.mappingKey))
    const missing = nonZeroKeys.filter((key) => !configured.has(key as DefaultAccountMappingKey))
    if (missing.length > 0) {
      throw new UnprocessableEntityError(
        `Default account mapping(s) not configured for: ${missing.join(', ')}`,
        'MISSING_FNF_ACCOUNT_MAPPING',
        undefined,
        { missingKeys: missing },
      )
    }
  }

  const lines: PostingRequestLine[] = []
  let lineNumber = 1
  let totalDebit = toDecimal(0)
  let totalCredit = toDecimal(0)
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.debit.isZero() && bucket.credit.isZero()) continue
    const isFnfLedgerLine = key === 'EMPLOYEE_FNF_PAYABLE' || key === 'EMPLOYEE_FNF_RECEIVABLE'
    lines.push({
      lineNumber,
      accountMappingKey: key,
      debitAmount: bucket.debit.isZero() ? ZERO : formatForPersistence(bucket.debit, 4),
      creditAmount: bucket.credit.isZero() ? ZERO : formatForPersistence(bucket.credit, 4),
      partyNameSnapshot: isFnfLedgerLine ? row.employee.displayName : undefined,
      lineNarration: `Full & final settlement — ${row.code} (${key})`,
    })
    totalDebit = add(totalDebit, bucket.debit)
    totalCredit = add(totalCredit, bucket.credit)
    lineNumber += 1
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new UnprocessableEntityError(
      `Full & final settlement entry is unbalanced: debit ${formatForPersistence(totalDebit, 2)} vs credit ${formatForPersistence(totalCredit, 2)}`,
      'FNF_ENTRY_UNBALANCED',
    )
  }

  const postingDate = isoDate(row.lastWorkingDate)
  const request: PostingRequest = {
    legalEntityId: row.legalEntityId,
    branchId: row.branchId ?? null,
    eventKey: `FNF_POST:${row.id}:V1`,
    eventType: 'FNF_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    referenceNumber: row.code,
    narration: `Full & final settlement — ${row.code}`,
    sourceModule: 'HRMS',
    sourceDocumentType: 'FULL_FINAL_SETTLEMENT',
    sourceDocumentId: row.id,
    lines,
  }

  let result
  try {
    result = await post(request, postingContext(tenantId, audit))
  } catch (error) {
    if (error instanceof PostingError && error.code === 'ACCOUNTING_PERIOD_CLOSED') {
      throw new UnprocessableEntityError(`Could not post settlement: ${error.message}`, 'NO_OPEN_ACCOUNTING_PERIOD')
    }
    if (error instanceof PostingError && (error.code === 'UNBALANCED' || error.code === 'UNBALANCED_BASE')) {
      throw new UnprocessableEntityError(`Full & final settlement entry is unbalanced: ${error.message}`, 'FNF_ENTRY_UNBALANCED')
    }
    throw error
  }

  await prisma.hrFullFinalSettlement.update({
    where: { id: row.id },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
      postedByUserId: audit?.userId ?? null,
      accountingVoucherId: result.voucherId,
      postingEventId: result.postingEventId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrFullFinalSettlement',
    entityId: row.id,
    action: 'POST',
    newValues: { voucherId: result.voucherId, netSettlement: dec(row.netSettlement) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  if (net.lte(0)) {
    await completeExit(tenantId, exitId, audit)
  }

  return getSettlementByExit(tenantId, exitId, scope)
}

/** Pay a POSTED settlement with net > 0 only — net ≤ 0 means the amount is recoverable from the employee, not payable. */
export async function paySettlement(
  tenantId: string,
  exitId: string,
  input: PayFnfInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const row = await loadSettlementByExit(tenantId, exitId, scope)

  if (row.paymentPostingEventId) {
    return getSettlementByExit(tenantId, exitId, scope)
  }
  if (row.status !== 'POSTED') {
    throw new InvalidStateError('Only a POSTED settlement can be paid')
  }

  const net = toDecimal(row.netSettlement)
  if (net.lte(0)) {
    throw new UnprocessableEntityError(
      'This settlement has no amount payable to the employee — the balance is recoverable from them instead',
      'AMOUNT_RECOVERABLE',
    )
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: input.treasuryAccountId, tenantId } })
  if (!treasuryAccount) throw new NotFoundError('Treasury account not found')
  if (treasuryAccount.status !== 'ACTIVE') throw new ValidationError('Treasury account is not active')
  if (treasuryAccount.legalEntityId !== row.legalEntityId) {
    throw new ValidationError('Treasury account does not belong to the settlement legal entity')
  }

  const amount = formatForPersistence(net, 4)
  const request: PostingRequest = {
    legalEntityId: row.legalEntityId,
    branchId: row.branchId ?? null,
    eventKey: `FNF_PAY:${row.id}:V1`,
    eventType: 'FNF_PAID',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'PAYMENT',
    documentDate: input.paymentDate,
    postingDate: input.paymentDate,
    referenceNumber: row.code,
    narration: `Full & final settlement payment — ${row.code}`,
    sourceModule: 'HRMS',
    sourceDocumentType: 'FULL_FINAL_SETTLEMENT',
    sourceDocumentId: row.id,
    lines: [
      {
        lineNumber: 1,
        accountMappingKey: 'EMPLOYEE_FNF_PAYABLE',
        debitAmount: amount,
        creditAmount: ZERO,
        partyNameSnapshot: row.employee.displayName,
        lineNarration: `${row.code} payment`,
      },
      {
        lineNumber: 2,
        accountId: treasuryAccount.glAccountId,
        debitAmount: ZERO,
        creditAmount: amount,
        lineNarration: `${row.code} payment`,
      },
    ],
  }

  let result
  try {
    result = await post(request, postingContext(tenantId, audit))
  } catch (error) {
    if (error instanceof PostingError && error.code === 'ACCOUNTING_PERIOD_CLOSED') {
      throw new UnprocessableEntityError(`Could not pay settlement: ${error.message}`, 'NO_OPEN_ACCOUNTING_PERIOD')
    }
    throw error
  }

  await prisma.hrFullFinalSettlement.update({
    where: { id: row.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paidByUserId: audit?.userId ?? null,
      paymentMethod: input.method,
      treasuryAccountId: input.treasuryAccountId,
      paymentReference: input.reference ?? null,
      paymentVoucherId: result.voucherId,
      paymentPostingEventId: result.postingEventId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrFullFinalSettlement',
    entityId: row.id,
    action: 'PAY',
    newValues: { voucherId: result.voucherId, amount: dec(net) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  await completeExit(tenantId, exitId, audit)

  return getSettlementByExit(tenantId, exitId, scope)
}

export { mapSettlement }
