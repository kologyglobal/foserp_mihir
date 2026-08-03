import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { add, formatForPersistence, toDecimal } from '../../accounting/shared/finance-decimal.js'

export interface DueRecoveryLine {
  scheduleId: string
  loanId: string
  loanCode: string
  type: 'LOAN' | 'SALARY_ADVANCE'
  dueAmount: number
}

export interface RecoveryComponent {
  componentCode: 'LOAN_RECOVERY' | 'ADVANCE_RECOVERY'
  componentName: string
  componentType: 'DEDUCTION'
  calculationType: 'FIXED'
  amount: number
  notes: string
  calculationBasis: string
}

interface ExceptionDraft {
  code: string
  severity: 'BLOCKER' | 'WARNING'
  message: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function componentCodeFor(type: 'LOAN' | 'SALARY_ADVANCE'): 'LOAN_RECOVERY' | 'ADVANCE_RECOVERY' {
  return type === 'LOAN' ? 'LOAN_RECOVERY' : 'ADVANCE_RECOVERY'
}

function componentNameFor(type: 'LOAN' | 'SALARY_ADVANCE'): string {
  return type === 'LOAN' ? 'Loan Recovery' : 'Salary Advance Recovery'
}

/** PENDING recovery schedule lines due in this payroll period for one employee. */
export async function getDueRecoveriesForEmployee(
  tenantId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<DueRecoveryLine[]> {
  const schedules = await prisma.hrLoanRecoverySchedule.findMany({
    where: {
      tenantId,
      year,
      month,
      status: 'PENDING',
      loan: {
        tenantId,
        employeeId,
        deletedAt: null,
        status: { in: ['DISBURSED', 'RECOVERING'] },
      },
    },
    include: { loan: { select: { id: true, code: true, type: true } } },
    orderBy: { installmentNo: 'asc' },
  })

  return schedules.map((s) => ({
    scheduleId: s.id,
    loanId: s.loan.id,
    loanCode: s.loan.code,
    type: s.loan.type,
    dueAmount: Number(s.dueAmount),
  }))
}

/**
 * Map due recovery lines to payroll deduction components, capping recovery to the
 * remaining net pay (fail-safe practical payroll policy) rather than blocking payroll
 * outright — a capped/skipped recovery raises a WARNING so payroll review can act on it.
 * The schedule id is embedded in calculationBasis (`scheduleId:<uuid>|loan:<code>`) so
 * finalizeRun can deterministically match the component back to its schedule row.
 */
export function buildPayrollRecoveryComponents(
  dueLines: DueRecoveryLine[],
  netBeforeRecovery: number,
): { components: RecoveryComponent[]; exceptions: ExceptionDraft[] } {
  const components: RecoveryComponent[] = []
  const exceptions: ExceptionDraft[] = []
  let remaining = round2(Math.max(0, netBeforeRecovery))

  for (const line of dueLines) {
    let amount = round2(line.dueAmount)
    if (amount > remaining) {
      const capped = round2(remaining)
      exceptions.push({
        code: 'LOAN_RECOVERY_CAPPED',
        severity: 'WARNING',
        message:
          capped > 0
            ? `Recovery for ${line.loanCode} capped to ${capped} (due ${amount}) to avoid negative net pay`
            : `Recovery for ${line.loanCode} skipped this period (due ${amount}) — no net pay remaining`,
      })
      amount = capped
    }
    remaining = round2(remaining - amount)
    if (amount <= 0) continue

    components.push({
      componentCode: componentCodeFor(line.type),
      componentName: componentNameFor(line.type),
      componentType: 'DEDUCTION',
      calculationType: 'FIXED',
      amount,
      notes: `Source ${line.loanCode}`,
      calculationBasis: `scheduleId:${line.scheduleId}|loan:${line.loanCode}`,
    })
  }

  return { components, exceptions }
}

const SCHEDULE_ID_PATTERN = /scheduleId:([0-9a-fA-F-]{36})/

interface AuditMeta {
  userId?: string
}

/**
 * Confirm loan/advance recoveries for a run's FINALIZED employee results.
 * Called only from payroll finalizeRun (never from calculate) inside the same
 * transaction, so a schedule is only ever marked RECOVERED/PARTIAL once per run.
 */
export async function confirmRecoveriesForRun(
  tenantId: string,
  runId: string,
  tx: Prisma.TransactionClient,
  audit?: AuditMeta,
): Promise<void> {
  const run = await tx.hrPayrollRun.findFirst({
    where: { id: runId, tenantId },
    select: { payrollPeriodId: true },
  })
  if (!run) return
  const period = await tx.hrPayrollPeriod.findFirst({
    where: { id: run.payrollPeriodId, tenantId },
    select: { year: true, month: true },
  })
  if (!period) return

  const componentRows = await tx.hrPayrollComponentResult.findMany({
    where: {
      tenantId,
      componentCode: { in: ['LOAN_RECOVERY', 'ADVANCE_RECOVERY'] },
      employeeResult: { tenantId, payrollRunId: runId, status: 'FINALIZED' },
    },
    include: { employeeResult: { select: { id: true, employeeId: true } } },
  })

  const now = new Date()

  for (const row of componentRows) {
    const type: 'LOAN' | 'SALARY_ADVANCE' = row.componentCode === 'LOAN_RECOVERY' ? 'LOAN' : 'SALARY_ADVANCE'
    const employeeId = row.employeeResult.employeeId
    const employeeResultId = row.employeeResult.id
    const recoveredAmt = toDecimal(row.amount)
    if (recoveredAmt.lte(0)) continue

    const match = row.calculationBasis ? SCHEDULE_ID_PATTERN.exec(row.calculationBasis) : null
    let schedule = match
      ? await tx.hrLoanRecoverySchedule.findFirst({
          where: { id: match[1], tenantId },
          include: { loan: { select: { id: true, code: true, status: true, type: true } } },
        })
      : null

    if (!schedule) {
      schedule = await tx.hrLoanRecoverySchedule.findFirst({
        where: {
          tenantId,
          year: period.year,
          month: period.month,
          status: 'PENDING',
          loan: { tenantId, employeeId, type, deletedAt: null, status: { in: ['DISBURSED', 'RECOVERING'] } },
        },
        include: { loan: { select: { id: true, code: true, status: true, type: true } } },
      })
    }

    if (!schedule || schedule.status !== 'PENDING') {
      // Already processed for this run (idempotent replay) or no matching schedule found.
      continue
    }

    const dueAmount = toDecimal(schedule.dueAmount)
    const newStatus: 'RECOVERED' | 'PARTIAL' = recoveredAmt.gte(dueAmount) ? 'RECOVERED' : 'PARTIAL'

    await tx.hrLoanRecoverySchedule.update({
      where: { id: schedule.id },
      data: {
        recoveredAmount: formatForPersistence(recoveredAmt, 2),
        status: newStatus,
        payrollRunId: runId,
        payrollEmployeeResultId: employeeResultId,
        recoveredAt: now,
      },
    })

    const loan = await tx.hrEmployeeLoan.findFirst({
      where: { id: schedule.loanId, tenantId },
      select: { recoveredAmount: true, outstandingAmount: true },
    })
    if (!loan) continue

    const newRecovered = add(loan.recoveredAmount, recoveredAmt)
    const newOutstandingRaw = toDecimal(loan.outstandingAmount).sub(recoveredAmt)
    const newOutstanding = newOutstandingRaw.isNegative() ? toDecimal(0) : newOutstandingRaw

    const remainingPending = await tx.hrLoanRecoverySchedule.count({
      where: { tenantId, loanId: schedule.loanId, status: 'PENDING' },
    })

    const shouldClose = newOutstanding.lte(0) && remainingPending === 0

    await tx.hrEmployeeLoan.update({
      where: { id: schedule.loanId },
      data: {
        recoveredAmount: formatForPersistence(newRecovered, 2),
        outstandingAmount: formatForPersistence(newOutstanding, 2),
        ...(shouldClose
          ? { status: 'CLOSED' as const, closedAt: now, closedByUserId: audit?.userId ?? null }
          : {}),
      },
    })
  }
}
