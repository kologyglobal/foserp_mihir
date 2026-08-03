import type { Prisma } from '@prisma/client'
import { ValidationError } from '../../../utils/errors.js'
import { add, formatForPersistence, subtract, toDecimal } from '../../accounting/shared/finance-decimal.js'

export interface ScheduleGenerationInput {
  loanId: string
  tenantId: string
  disbursedAmount: Prisma.Decimal | string | number
  installmentAmount: Prisma.Decimal | string | number | null
  installmentCount: number | null
  recoveryStartYear: number
  recoveryStartMonth: number
}

export interface GeneratedInstallment {
  installmentNo: number
  year: number
  month: number
  dueAmount: string
}

function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const zeroBased = month - 1 + offset
  const y = year + Math.floor(zeroBased / 12)
  const m = (((zeroBased % 12) + 12) % 12) + 1
  return { year: y, month: m }
}

/**
 * Determine (count, perInstallment) from whatever combination of installmentAmount /
 * installmentCount was finalized at approval. The last installment always absorbs the
 * rounding remainder so the schedule sums exactly to the disbursed amount.
 */
export function planInstallments(
  disbursedAmount: Prisma.Decimal | string | number,
  installmentAmount: Prisma.Decimal | string | number | null,
  installmentCount: number | null,
): { count: number; perInstallment: Prisma.Decimal } {
  const disbursed = toDecimal(disbursedAmount)
  if (disbursed.lte(0)) {
    throw new ValidationError('Disbursed amount must be greater than zero to generate a recovery schedule')
  }

  if (installmentCount && installmentCount > 0) {
    if (installmentAmount != null) {
      return { count: installmentCount, perInstallment: toDecimal(installmentAmount) }
    }
    const per = toDecimal(formatForPersistence(disbursed.div(installmentCount), 2))
    return { count: installmentCount, perInstallment: per }
  }

  if (installmentAmount != null) {
    const per = toDecimal(installmentAmount)
    if (per.lte(0)) throw new ValidationError('installmentAmount must be greater than zero')
    const count = disbursed.div(per).ceil().toNumber()
    return { count: Math.max(count, 1), perInstallment: per }
  }

  throw new ValidationError('Either installmentAmount or installmentCount must be set before disbursement')
}

/** Build the ordered installment rows for a freshly disbursed loan (never mutates existing rows). */
export function buildScheduleRows(input: ScheduleGenerationInput): GeneratedInstallment[] {
  const { count, perInstallment } = planInstallments(
    input.disbursedAmount,
    input.installmentAmount,
    input.installmentCount,
  )

  const disbursed = toDecimal(input.disbursedAmount)
  const rows: GeneratedInstallment[] = []
  let running = toDecimal(0)

  for (let i = 1; i <= count; i += 1) {
    const { year, month } = addMonths(input.recoveryStartYear, input.recoveryStartMonth, i - 1)
    const isLast = i === count
    const dueAmount = isLast ? subtract(disbursed, running) : perInstallment
    running = add(running, dueAmount)
    rows.push({
      installmentNo: i,
      year,
      month,
      dueAmount: formatForPersistence(dueAmount, 2),
    })
  }

  return rows
}

/**
 * Persist the recovery schedule for a loan inside the disbursement transaction.
 * Only ever called once per loan (on disbursement) — never touches existing rows.
 */
export async function generateSchedule(
  tx: Prisma.TransactionClient,
  input: ScheduleGenerationInput,
): Promise<GeneratedInstallment[]> {
  const rows = buildScheduleRows(input)
  await tx.hrLoanRecoverySchedule.createMany({
    data: rows.map((row) => ({
      tenantId: input.tenantId,
      loanId: input.loanId,
      installmentNo: row.installmentNo,
      year: row.year,
      month: row.month,
      dueAmount: row.dueAmount,
      status: 'PENDING' as const,
    })),
  })
  return rows
}
