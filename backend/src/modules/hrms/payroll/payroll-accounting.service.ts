import type { DefaultAccountMappingKey, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, UnprocessableEntityError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { add, formatForPersistence, toDecimal } from '../../accounting/shared/finance-decimal.js'
import { post } from '../../accounting/posting/posting.service.js'
import { PostingError } from '../../accounting/posting/posting.errors.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../../accounting/posting/posting.types.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const ZERO = '0.0000'

/** All 16 salary/statutory GL mapping keys used by the payroll accrual posting. */
export const REQUIRED_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  'SALARY_BASIC_EXPENSE',
  'SALARY_HRA_EXPENSE',
  'SALARY_ALLOWANCE_EXPENSE',
  'SALARY_OT_EXPENSE',
  'SALARY_PAYABLE',
  'PF_EMPLOYEE_PAYABLE',
  'PF_EMPLOYER_PAYABLE',
  'PF_EMPLOYER_EXPENSE',
  'ESIC_EMPLOYEE_PAYABLE',
  'ESIC_EMPLOYER_PAYABLE',
  'ESIC_EMPLOYER_EXPENSE',
  'PT_PAYABLE',
  'TDS_SALARY_PAYABLE',
  'LWF_PAYABLE',
  'LWF_EMPLOYER_PAYABLE',
  'LWF_EMPLOYER_EXPENSE',
]

interface ComponentForBucket {
  type: string
  componentCode: string
  calculationType: string
  amount: Prisma.Decimal
}

interface EmployeeResultForBucket {
  netAmount: Prisma.Decimal
  components: ComponentForBucket[]
}

interface Bucket {
  debit: Prisma.Decimal
  credit: Prisma.Decimal
}

function emptyBucket(): Bucket {
  return { debit: toDecimal(0), credit: toDecimal(0) }
}

function addDebit(buckets: Map<DefaultAccountMappingKey, Bucket>, key: DefaultAccountMappingKey, amount: Prisma.Decimal) {
  const bucket = buckets.get(key) ?? emptyBucket()
  bucket.debit = add(bucket.debit, amount)
  buckets.set(key, bucket)
}

function addCredit(buckets: Map<DefaultAccountMappingKey, Bucket>, key: DefaultAccountMappingKey, amount: Prisma.Decimal) {
  const bucket = buckets.get(key) ?? emptyBucket()
  bucket.credit = add(bucket.credit, amount)
  buckets.set(key, bucket)
}

/**
 * Build balanced Dr/Cr GL buckets from finalized employee results' components.
 * Unmapped DEDUCTION components (amount > 0) block posting — finance must configure
 * a mapping (or the salary structure) before the run can post.
 */
export function buildPayrollAccrualBuckets(
  results: EmployeeResultForBucket[],
): Map<DefaultAccountMappingKey, Bucket> {
  const buckets = new Map<DefaultAccountMappingKey, Bucket>()

  for (const result of results) {
    for (const component of result.components) {
      const amount = toDecimal(component.amount)
      if (amount.isZero()) continue
      const code = component.componentCode.toUpperCase()

      if (component.type === 'EARNING') {
        if (code === 'BASIC') {
          addDebit(buckets, 'SALARY_BASIC_EXPENSE', amount)
        } else if (code === 'HRA') {
          addDebit(buckets, 'SALARY_HRA_EXPENSE', amount)
        } else if (component.calculationType === 'OT_LINKED' || code === 'OT') {
          addDebit(buckets, 'SALARY_OT_EXPENSE', amount)
        } else {
          addDebit(buckets, 'SALARY_ALLOWANCE_EXPENSE', amount)
        }
        continue
      }

      if (component.type === 'EMPLOYER_CONTRIBUTION') {
        if (code === 'PF_EMPLOYER') {
          addDebit(buckets, 'PF_EMPLOYER_EXPENSE', amount)
          addCredit(buckets, 'PF_EMPLOYER_PAYABLE', amount)
        } else if (code === 'ESIC_EMPLOYER') {
          addDebit(buckets, 'ESIC_EMPLOYER_EXPENSE', amount)
          addCredit(buckets, 'ESIC_EMPLOYER_PAYABLE', amount)
        } else if (code === 'LWF_EMPLOYER') {
          addDebit(buckets, 'LWF_EMPLOYER_EXPENSE', amount)
          addCredit(buckets, 'LWF_EMPLOYER_PAYABLE', amount)
        } else {
          throw new UnprocessableEntityError(
            `No payroll account mapping is configured for employer contribution component ${code}`,
            'MISSING_PAYROLL_ACCOUNT_MAPPING',
            undefined,
            { componentCode: code },
          )
        }
        continue
      }

      if (component.type === 'DEDUCTION') {
        if (code === 'LOP') {
          // LOP deduction nets salary expense (credit BASIC expense) so Dr expenses = Cr payables.
          addCredit(buckets, 'SALARY_BASIC_EXPENSE', amount)
        } else if (code === 'PF_EMPLOYEE') {
          addCredit(buckets, 'PF_EMPLOYEE_PAYABLE', amount)
        } else if (code === 'ESIC_EMPLOYEE') {
          addCredit(buckets, 'ESIC_EMPLOYEE_PAYABLE', amount)
        } else if (code === 'PT') {
          addCredit(buckets, 'PT_PAYABLE', amount)
        } else if (code === 'TDS') {
          addCredit(buckets, 'TDS_SALARY_PAYABLE', amount)
        } else if (code === 'LWF_EMPLOYEE' || code === 'LWF') {
          addCredit(buckets, 'LWF_PAYABLE', amount)
        } else if (code === 'LOAN_RECOVERY') {
          // Recovery folds into the accrual journal: crediting the receivable (instead of
          // SALARY_PAYABLE) for this slice keeps Dr expenses = Cr payables + Cr receivable.
          addCredit(buckets, 'EMPLOYEE_LOAN_RECEIVABLE', amount)
        } else if (code === 'ADVANCE_RECOVERY') {
          addCredit(buckets, 'SALARY_ADVANCE_RECEIVABLE', amount)
        } else {
          throw new UnprocessableEntityError(
            `No payroll account mapping is configured for deduction component ${code}`,
            'MISSING_PAYROLL_ACCOUNT_MAPPING',
            undefined,
            { componentCode: code },
          )
        }
      }
    }

    const net = toDecimal(result.netAmount)
    if (!net.isZero()) {
      addCredit(buckets, 'SALARY_PAYABLE', net)
    }
  }

  return buckets
}

async function loadRunForAccess(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })
  return run
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

export interface PayrollAccountingResult {
  runId: string
  accountingStatus: string
  accountingVoucherId: string | null
  voucherNumber: string | null
  postingEventId: string | null
  accountingPostedAt: string | null
  accountingPostedByUserId: string | null
  accountingError: string | null
}

async function buildAccountingResult(runId: string, run: {
  accountingStatus: string
  accountingVoucherId: string | null
  postingEventId: string | null
  accountingPostedAt: Date | null
  accountingPostedByUserId: string | null
  accountingError: string | null
}, tenantId: string): Promise<PayrollAccountingResult> {
  let voucherNumber: string | null = null
  if (run.accountingVoucherId) {
    const voucher = await prisma.accountingVoucher.findFirst({
      where: { id: run.accountingVoucherId, tenantId },
      select: { voucherNumber: true },
    })
    voucherNumber = voucher?.voucherNumber ?? null
  }
  return {
    runId,
    accountingStatus: run.accountingStatus,
    accountingVoucherId: run.accountingVoucherId,
    voucherNumber,
    postingEventId: run.postingEventId,
    accountingPostedAt: run.accountingPostedAt?.toISOString() ?? null,
    accountingPostedByUserId: run.accountingPostedByUserId,
    accountingError: run.accountingError,
  }
}

export async function getPayrollAccounting(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await loadRunForAccess(tenantId, runId, scope)
  return buildAccountingResult(runId, run, tenantId)
}

/**
 * Post the payroll accrual journal for a FINALIZED run: Dr salary/employer expense
 * buckets, Cr salary/statutory payable buckets. Idempotent per run via a deterministic
 * eventKey — calling this again after a successful post returns the existing result.
 */
export async function postPayrollAccounting(
  tenantId: string,
  runId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
): Promise<PayrollAccountingResult> {
  const run = await loadRunForAccess(tenantId, runId, scope)

  if (run.status !== 'FINALIZED') {
    throw new UnprocessableEntityError(
      'Only a FINALIZED payroll run can be posted to accounting',
      'PAYROLL_NOT_FINALIZED',
    )
  }

  if (run.accountingStatus === 'POSTED') {
    if (run.postingEventId) {
      return buildAccountingResult(runId, run, tenantId)
    }
    throw new UnprocessableEntityError(
      'Payroll accounting has already been posted for this run',
      'PAYROLL_ALREADY_POSTED',
    )
  }

  const period = await prisma.hrPayrollPeriod.findFirst({ where: { id: run.payrollPeriodId, tenantId } })
  if (!period) throw new NotFoundError('Payroll period not found')

  const results = await prisma.hrPayrollEmployeeResult.findMany({
    where: { tenantId, payrollRunId: runId, status: 'FINALIZED' },
    include: { components: true },
  })

  if (results.length === 0) {
    throw new UnprocessableEntityError(
      'This payroll run has no finalized employee results to post',
      'PAYROLL_NOT_FINALIZED',
    )
  }

  const buckets = buildPayrollAccrualBuckets(results)

  const nonZeroKeys = [...buckets.entries()]
    .filter(([, bucket]) => !bucket.debit.isZero() || !bucket.credit.isZero())
    .map(([key]) => key)

  if (nonZeroKeys.length > 0) {
    const mappings = await prisma.defaultAccountMapping.findMany({
      where: { tenantId, legalEntityId: run.legalEntityId, mappingKey: { in: nonZeroKeys } },
      select: { mappingKey: true },
    })
    const configured = new Set(mappings.map((m) => m.mappingKey))
    const missing = nonZeroKeys.filter((key) => !configured.has(key))
    if (missing.length > 0) {
      throw new UnprocessableEntityError(
        `Default account mapping(s) not configured for: ${missing.join(', ')}`,
        'MISSING_PAYROLL_ACCOUNT_MAPPING',
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
    lines.push({
      lineNumber,
      accountMappingKey: key,
      debitAmount: bucket.debit.isZero() ? ZERO : formatForPersistence(bucket.debit, 4),
      creditAmount: bucket.credit.isZero() ? ZERO : formatForPersistence(bucket.credit, 4),
      lineNarration: `Payroll accrual — ${key}`,
    })
    totalDebit = add(totalDebit, bucket.debit)
    totalCredit = add(totalCredit, bucket.credit)
    lineNumber += 1
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new UnprocessableEntityError(
      `Payroll accrual entry is unbalanced: debit ${formatForPersistence(totalDebit, 2)} vs credit ${formatForPersistence(totalCredit, 2)}`,
      'PAYROLL_ENTRY_UNBALANCED',
    )
  }

  const postingDate = toDateOnly(period.endDate).toISOString().slice(0, 10)
  const request: PostingRequest = {
    legalEntityId: run.legalEntityId,
    branchId: run.branchId ?? null,
    eventKey: `PAYROLL_ACCRUAL_POST:${runId}:V1`,
    eventType: 'PAYROLL_ACCRUAL_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    referenceNumber: run.code,
    narration: `Payroll accrual for run ${run.code}`,
    sourceModule: 'HRMS',
    sourceDocumentType: 'PAYROLL_RUN',
    sourceDocumentId: runId,
    lines,
  }

  let result
  try {
    result = await post(request, postingContext(tenantId, audit))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payroll accounting posting failed'
    await prisma.hrPayrollRun.update({
      where: { id: runId },
      data: { accountingStatus: 'FAILED', accountingError: message.slice(0, 500) },
    })
    if (error instanceof PostingError && error.code === 'ACCOUNTING_PERIOD_CLOSED') {
      throw new UnprocessableEntityError(
        `Could not post payroll accounting: ${error.message}`,
        'NO_OPEN_ACCOUNTING_PERIOD',
      )
    }
    if (error instanceof PostingError && (error.code === 'UNBALANCED' || error.code === 'UNBALANCED_BASE')) {
      throw new UnprocessableEntityError(
        `Payroll accrual entry is unbalanced: ${error.message}`,
        'PAYROLL_ENTRY_UNBALANCED',
      )
    }
    throw error
  }

  const updated = await prisma.hrPayrollRun.update({
    where: { id: runId },
    data: {
      accountingStatus: 'POSTED',
      accountingVoucherId: result.voucherId,
      postingEventId: result.postingEventId,
      accountingPostedAt: new Date(),
      accountingPostedByUserId: audit?.userId ?? null,
      accountingError: null,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: runId,
    action: 'PAYROLL_POSTED',
    newValues: {
      voucherId: result.voucherId,
      voucherNumber: result.voucherNumber,
      totalDebit: formatForPersistence(totalDebit, 2),
      totalCredit: formatForPersistence(totalCredit, 2),
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return buildAccountingResult(runId, updated, tenantId)
}
