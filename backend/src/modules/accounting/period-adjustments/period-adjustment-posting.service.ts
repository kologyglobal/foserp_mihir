/**
 * GL posting for period-close adjustments.
 *
 * ACCRUAL post     — Dr expense / Cr accrued liability, dated the period end date.
 * ACCRUAL reversal — mirror of the above, dated the first day of the next period.
 * PREPAID recognition — Dr expense / Cr prepaid asset, one schedule row per period.
 */
import type { Request } from 'express'
import type { AccountingPeriod } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { add, formatForPersistence, subtract } from '../shared/finance-decimal.js'
import { post } from '../posting/posting.service.js'
import { PostingError } from '../posting/posting.errors.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import { PERIOD_ADJUSTMENT_ERROR_CODES as CODES, unprocessable } from './period-adjustment.errors.js'
import * as repo from './period-adjustment.repository.js'
import {
  assertFinanceActive,
  resolveNextPeriod,
  serializeAdjustment,
  type PeriodAdjustmentDto,
} from './period-adjustment.service.js'
import type { ReversePeriodAdjustmentInput } from './period-adjustment.schemas.js'

const SOURCE_MODULE = 'ACCOUNTING'
const SOURCE_DOCUMENT_TYPE = 'PERIOD_END_ADJUSTMENT'
const ZERO = '0.0000'

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function postingContext(req: Request, tenantId: string): PostingContext {
  return {
    tenantId,
    userId: req.context?.userId ?? null,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  }
}

async function audit(req: Request, tenantId: string, id: string, action: string, values?: Record<string, unknown>) {
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'ACCOUNTING',
    entity: 'PeriodEndAdjustment',
    entityId: id,
    action,
    newValues: values,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  })
}

/**
 * Posting-engine failures are configuration problems for this document (closed period,
 * backdating disabled, unbalanced), so they surface as 422s with the engine code attached.
 */
function translatePostingError(error: unknown, adjustmentNumber: string): never {
  if (error instanceof PostingError) {
    throw unprocessable(
      `Could not post ${adjustmentNumber}: ${error.message}`,
      CODES.POSTING_FAILED,
      { postingCode: error.code },
    )
  }
  throw error
}

function assertPeriodOpen(period: Pick<AccountingPeriod, 'name' | 'status'>): void {
  if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
    throw unprocessable(
      `Period ${period.name} is ${period.status}; reopen it before posting period-end adjustments`,
      CODES.PERIOD_NOT_OPEN,
    )
  }
}

function accrualLines(
  expenseAccountId: string,
  liabilityAccountId: string,
  amount: string,
  costCentreId: string | null,
  narration: string,
  reverse: boolean,
): PostingRequestLine[] {
  const expenseLine: PostingRequestLine = {
    lineNumber: 1,
    accountId: expenseAccountId,
    debitAmount: reverse ? ZERO : amount,
    creditAmount: reverse ? amount : ZERO,
    costCentreId,
    lineNarration: narration,
  }
  const balanceLine: PostingRequestLine = {
    lineNumber: 2,
    accountId: liabilityAccountId,
    debitAmount: reverse ? amount : ZERO,
    creditAmount: reverse ? ZERO : amount,
    lineNarration: narration,
  }
  return [expenseLine, balanceLine]
}

/**
 * ACCRUAL — posts the accrual journal on the period end date.
 * PREPAID — activates the amortisation schedule (rows post individually).
 */
export async function postPeriodAdjustment(req: Request, tenantId: string, id: string): Promise<PeriodAdjustmentDto> {
  const adjustment = await repo.findByIdOrThrow(tenantId, id)

  if (adjustment.status === 'POSTED' || adjustment.status === 'PARTIALLY_RECOGNISED' || adjustment.status === 'FULLY_RECOGNISED') {
    return serializeAdjustment(adjustment)
  }
  if (adjustment.status !== 'READY_TO_POST') {
    throw unprocessable(
      `Adjustment ${adjustment.adjustmentNumber} is ${adjustment.status}; mark it ready before posting`,
      CODES.NOT_READY,
    )
  }
  await assertFinanceActive(tenantId, adjustment.legalEntityId)
  assertPeriodOpen(adjustment.period)

  if (adjustment.kind === 'PREPAID') {
    const activated = await prisma.periodEndAdjustment.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date(), postedBy: req.context?.userId ?? null },
      include: repo.adjustmentInclude,
    })
    await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_SCHEDULE_ACTIVATED', {
      adjustmentNumber: activated.adjustmentNumber,
      numberOfPeriods: activated.numberOfPeriods,
    })
    return serializeAdjustment(activated)
  }

  const amount = formatForPersistence(adjustment.totalAmount, 4)
  const postingDate = toIsoDate(adjustment.period.endDate)
  const narration = (adjustment.narration ?? `Accrual — ${adjustment.description}`).slice(0, 500)

  const request: PostingRequest = {
    legalEntityId: adjustment.legalEntityId,
    eventKey: `PERIOD_ACCRUAL_POST:${adjustment.id}:V1`,
    eventType: 'PERIOD_ACCRUAL_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    referenceNumber: adjustment.adjustmentNumber,
    narration,
    currencyCode: adjustment.currencyCode,
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: adjustment.id,
    lines: accrualLines(
      adjustment.expenseAccountId,
      adjustment.balanceSheetAccountId,
      amount,
      adjustment.costCentreId,
      narration,
      false,
    ),
  }

  let result
  try {
    result = await post(request, postingContext(req, tenantId))
  } catch (error) {
    translatePostingError(error, adjustment.adjustmentNumber)
  }

  const updated = await prisma.periodEndAdjustment.update({
    where: { id },
    data: {
      status: 'POSTED',
      recognisedAmount: adjustment.totalAmount,
      voucherId: result.voucherId,
      postingEventId: result.postingEventId,
      voucherNumber: result.voucherNumber,
      postedAt: new Date(),
      postedBy: req.context?.userId ?? null,
    },
    include: repo.adjustmentInclude,
  })
  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_POSTED', {
    adjustmentNumber: updated.adjustmentNumber,
    voucherNumber: result.voucherNumber,
    amount,
  })
  return serializeAdjustment(updated)
}

/** ACCRUAL only — books the mirror journal into the following period. */
export async function reversePeriodAdjustment(
  req: Request,
  tenantId: string,
  id: string,
  input: ReversePeriodAdjustmentInput,
): Promise<PeriodAdjustmentDto> {
  const adjustment = await repo.findByIdOrThrow(tenantId, id)

  if (adjustment.kind !== 'ACCRUAL') {
    throw unprocessable(
      `Adjustment ${adjustment.adjustmentNumber} is a prepaid schedule; reverse the individual recognitions instead`,
      CODES.KIND_MISMATCH,
    )
  }
  if (adjustment.status === 'REVERSED' || adjustment.reversalVoucherId) {
    return serializeAdjustment(adjustment)
  }
  if (adjustment.status !== 'POSTED') {
    throw unprocessable(`Adjustment ${adjustment.adjustmentNumber} is ${adjustment.status}; only POSTED accruals can be reversed`, CODES.NOT_POSTED)
  }

  const period = await prisma.accountingPeriod.findFirst({ where: { id: adjustment.periodId, tenantId } })
  if (!period) throw new NotFoundError('Accounting period not found')
  const nextPeriod = await resolveNextPeriod(tenantId, adjustment.legalEntityId, period)
  if (!nextPeriod) {
    throw unprocessable(
      `No accounting period follows ${period.name}; generate the next financial year's periods before reversing`,
      CODES.NEXT_PERIOD_MISSING,
    )
  }
  assertPeriodOpen(nextPeriod)

  const reversalDate = input.reversalDate ?? toIsoDate(nextPeriod.startDate)
  const amount = formatForPersistence(adjustment.totalAmount, 4)
  const narration = `Reversal of accrual ${adjustment.adjustmentNumber}: ${input.reason}`.slice(0, 500)

  const request: PostingRequest = {
    legalEntityId: adjustment.legalEntityId,
    eventKey: `PERIOD_ACCRUAL_REVERSE:${adjustment.id}:V1`,
    eventType: 'PERIOD_ACCRUAL_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: reversalDate,
    postingDate: reversalDate,
    referenceNumber: adjustment.adjustmentNumber,
    narration,
    currencyCode: adjustment.currencyCode,
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: adjustment.id,
    lines: accrualLines(
      adjustment.expenseAccountId,
      adjustment.balanceSheetAccountId,
      amount,
      adjustment.costCentreId,
      narration,
      true,
    ),
  }

  let result
  try {
    result = await post(request, postingContext(req, tenantId))
  } catch (error) {
    translatePostingError(error, adjustment.adjustmentNumber)
  }

  const updated = await prisma.periodEndAdjustment.update({
    where: { id },
    data: {
      status: 'REVERSED',
      reversalPeriodId: nextPeriod.id,
      reversalVoucherId: result.voucherId,
      reversalPostingEventId: result.postingEventId,
      reversalVoucherNumber: result.voucherNumber,
      reversedAt: new Date(),
      reversedBy: req.context?.userId ?? null,
    },
    include: repo.adjustmentInclude,
  })
  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_REVERSED', {
    adjustmentNumber: updated.adjustmentNumber,
    reversalVoucherNumber: result.voucherNumber,
    reversalPeriod: nextPeriod.name,
    reason: input.reason,
  })
  return serializeAdjustment(updated)
}

/** PREPAID only — posts one amortisation row. Rows must be recognised in sequence. */
export async function recognisePrepaidSchedule(
  req: Request,
  tenantId: string,
  id: string,
  scheduleId: string,
): Promise<PeriodAdjustmentDto> {
  const adjustment = await repo.findByIdOrThrow(tenantId, id)

  if (adjustment.kind !== 'PREPAID') {
    throw unprocessable(`Adjustment ${adjustment.adjustmentNumber} is an accrual, not a prepaid schedule`, CODES.KIND_MISMATCH)
  }
  if (adjustment.status !== 'POSTED' && adjustment.status !== 'PARTIALLY_RECOGNISED') {
    throw unprocessable(
      `Adjustment ${adjustment.adjustmentNumber} is ${adjustment.status}; activate the schedule before recognising periods`,
      CODES.NOT_POSTED,
    )
  }

  const schedule = adjustment.schedules.find((row) => row.id === scheduleId)
  if (!schedule) throw new NotFoundError('Prepaid schedule row not found on this adjustment')
  if (schedule.status === 'POSTED') {
    throw unprocessable(`Schedule row ${schedule.sequence} is already posted`, CODES.SCHEDULE_ALREADY_POSTED)
  }

  const earlierPending = adjustment.schedules.filter((row) => row.sequence < schedule.sequence && row.status === 'PENDING')
  if (earlierPending.length > 0) {
    throw unprocessable(
      `Recognise period ${earlierPending[0]!.period.name} first — prepaid schedules post in sequence`,
      CODES.SCHEDULE_OUT_OF_ORDER,
      { nextSequence: earlierPending[0]!.sequence },
    )
  }
  assertPeriodOpen(schedule.period)
  await assertFinanceActive(tenantId, adjustment.legalEntityId)

  const amount = formatForPersistence(schedule.amount, 4)
  const postingDate = toIsoDate(schedule.period.endDate)
  const narration = `Prepaid amortisation ${adjustment.adjustmentNumber} ${schedule.sequence}/${adjustment.numberOfPeriods ?? adjustment.schedules.length} — ${adjustment.description}`.slice(0, 500)

  const request: PostingRequest = {
    legalEntityId: adjustment.legalEntityId,
    eventKey: `PERIOD_PREPAID_RECOGNISE:${schedule.id}:V1`,
    eventType: 'PERIOD_PREPAID_RECOGNISED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    referenceNumber: adjustment.adjustmentNumber,
    narration,
    currencyCode: adjustment.currencyCode,
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: adjustment.id,
    sourceDocumentLineId: schedule.id,
    lines: [
      {
        lineNumber: 1,
        accountId: adjustment.expenseAccountId,
        debitAmount: amount,
        creditAmount: ZERO,
        costCentreId: adjustment.costCentreId,
        lineNarration: narration,
      },
      {
        lineNumber: 2,
        accountId: adjustment.balanceSheetAccountId,
        debitAmount: ZERO,
        creditAmount: amount,
        lineNarration: narration,
      },
    ],
  }

  let result
  try {
    result = await post(request, postingContext(req, tenantId))
  } catch (error) {
    translatePostingError(error, adjustment.adjustmentNumber)
  }

  const recognised = add(adjustment.recognisedAmount, schedule.amount)
  const remainingPending = adjustment.schedules.filter((row) => row.id !== schedule.id && row.status === 'PENDING').length
  const nextStatus = remainingPending === 0 ? 'FULLY_RECOGNISED' : 'PARTIALLY_RECOGNISED'

  const updated = await prisma.$transaction(async (tx) => {
    await tx.periodEndAdjustmentSchedule.update({
      where: { id: schedule.id },
      data: {
        status: 'POSTED',
        voucherId: result.voucherId,
        postingEventId: result.postingEventId,
        voucherNumber: result.voucherNumber,
        postedAt: new Date(),
        postedBy: req.context?.userId ?? null,
      },
    })
    return tx.periodEndAdjustment.update({
      where: { id },
      data: {
        status: nextStatus,
        recognisedAmount: formatForPersistence(recognised, 4),
      },
      include: repo.adjustmentInclude,
    })
  })

  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_PREPAID_RECOGNISED', {
    adjustmentNumber: updated.adjustmentNumber,
    sequence: schedule.sequence,
    voucherNumber: result.voucherNumber,
    amount,
    remainingAmount: formatForPersistence(subtract(updated.totalAmount, updated.recognisedAmount), 4),
  })
  return serializeAdjustment(updated)
}

export interface PeriodBulkRunResult {
  periodId: string
  processed: number
  skipped: Array<{ id: string; adjustmentNumber: string; reason: string }>
  items: PeriodAdjustmentDto[]
}

/** Close-wizard helper: recognise every due prepaid row for a period. */
export async function recogniseDuePrepaidForPeriod(
  req: Request,
  tenantId: string,
  periodId: string,
): Promise<PeriodBulkRunResult> {
  const rows = await repo.listPendingScheduleRowsForPeriod(tenantId, periodId)
  const items: PeriodAdjustmentDto[] = []
  const skipped: PeriodBulkRunResult['skipped'] = []

  for (const row of rows) {
    try {
      items.push(await recognisePrepaidSchedule(req, tenantId, row.adjustmentId, row.id))
    } catch (error) {
      skipped.push({
        id: row.adjustmentId,
        adjustmentNumber: row.adjustment.adjustmentNumber,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { periodId, processed: items.length, skipped, items }
}

/** Close-wizard helper: reverse every auto-reversing accrual posted in a period. */
export async function reverseDueAccrualsForPeriod(
  req: Request,
  tenantId: string,
  periodId: string,
  reason: string,
): Promise<PeriodBulkRunResult> {
  const rows = await repo.listAccrualsAwaitingReversal(tenantId, periodId)
  const items: PeriodAdjustmentDto[] = []
  const skipped: PeriodBulkRunResult['skipped'] = []

  for (const row of rows) {
    try {
      items.push(await reversePeriodAdjustment(req, tenantId, row.id, { reason }))
    } catch (error) {
      skipped.push({
        id: row.id,
        adjustmentNumber: row.adjustmentNumber,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { periodId, processed: items.length, skipped, items }
}
