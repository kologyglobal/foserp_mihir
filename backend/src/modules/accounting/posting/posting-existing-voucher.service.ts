import type { AccountingVoucher, AccountingVoucherLine, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { formatForPersistence, toDecimal } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { hashPayload } from '../shared/payload-hash.js'
import * as postingEventRepo from '../ledger/posting-event.repository.js'
import { beginIdempotentPosting, buildReplayResult } from './posting-idempotency.service.js'
import { reserveVoucherNumber } from './posting-number.service.js'
import { PostingError } from './posting.errors.js'
import { validatePostingRequest } from './posting-validation.service.js'
import { __testOnly_failBeforeGl, buildPostedResult } from './posting.service.js'
import type { PostingContext, PostingRequest, PostingResult, ValidatedPostingData } from './posting.types.js'
import {
  JOURNAL_SOURCE_DOCUMENT_TYPE,
  JOURNAL_SOURCE_MODULE,
} from '../journals/journal.types.js'

const MAX_TX_RETRIES = 3
const TX_TIMEOUT_MS = 15_000

export { __testOnly_failBeforeGl }

export function buildManualJournalPostEventKey(voucherId: string): string {
  return `MANUAL_JOURNAL_POST:${voucherId}:V1`
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function assertExistingVoucherEligibility(voucher: AccountingVoucher & { lines: AccountingVoucherLine[] }): void {
  if (voucher.voucherType !== 'JOURNAL') {
    throw new PostingError('VALIDATION_FAILED', 'Only journal vouchers can be posted via manual journal workflow')
  }
  if (voucher.status !== 'APPROVED') {
    throw new PostingError('VALIDATION_FAILED', `Voucher status ${voucher.status} is not eligible for posting`)
  }
  if (voucher.voucherNumber) {
    throw new PostingError('VALIDATION_FAILED', 'Voucher number is already assigned')
  }
  if (voucher.reversalOfVoucherId || voucher.reversedByVoucherId) {
    throw new PostingError('VALIDATION_FAILED', 'Reversal-linked vouchers cannot be posted')
  }
  if (voucher.lines.length < 2) {
    throw new PostingError('INSUFFICIENT_LINES', 'At least two journal lines are required for posting')
  }
}

export function buildPostingRequestFromApprovedVoucher(
  voucher: AccountingVoucher & { lines: AccountingVoucherLine[] },
): PostingRequest {
  const sortedLines = [...voucher.lines].sort((a, b) => a.lineNumber - b.lineNumber)

  return {
    legalEntityId: voucher.legalEntityId,
    eventKey: buildManualJournalPostEventKey(voucher.id),
    eventType: 'MANUAL_JOURNAL_POST',
    eventVersion: 1,
    postingPurpose: 'MANUAL_JOURNAL',
    voucherType: 'JOURNAL',
    documentDate: toIsoDate(voucher.documentDate),
    postingDate: toIsoDate(voucher.postingDate),
    branchId: voucher.branchId,
    referenceNumber: voucher.referenceNumber,
    externalReference: voucher.externalReference,
    narration: voucher.narration,
    currencyCode: voucher.currencyCode,
    exchangeRate: voucher.exchangeRate.toFixed(8),
    sourceModule: JOURNAL_SOURCE_MODULE,
    sourceDocumentType: JOURNAL_SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: voucher.id,
    lines: sortedLines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      partyType: line.partyType as PostingRequest['lines'][number]['partyType'],
      partyId: line.partyId,
      partyNameSnapshot: line.partyNameSnapshot,
      debitAmount: formatForPersistence(line.debitAmount, 4),
      creditAmount: formatForPersistence(line.creditAmount, 4),
      baseDebitAmount: formatForPersistence(line.baseDebitAmount, 4),
      baseCreditAmount: formatForPersistence(line.baseCreditAmount, 4),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toFixed(8),
      costCentreId: line.costCentreId,
      projectReference: line.projectReference,
      departmentReference: line.departmentReference,
      referenceDocumentType: line.referenceDocumentType,
      referenceDocumentId: line.referenceDocumentId,
      referenceDocumentLineId: line.referenceDocumentLineId,
      dueDate: line.dueDate ? toIsoDate(line.dueDate) : null,
      lineNarration: line.lineNarration,
    })),
  }
}

export interface PostExistingApprovedVoucherContext {
  tenantId: string
  userId: string
  requestId?: string | null
  authorization: { permissionChecked: true; approvalWorkflowSatisfied: true }
  ipAddress?: string | null
  userAgent?: string | null
}

function toPostingContext(context: PostExistingApprovedVoucherContext): PostingContext {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    authorization: { permissionChecked: context.authorization.permissionChecked },
    workflow: { workflowSatisfied: context.authorization.approvalWorkflowSatisfied },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return code === 'P2034' || code === 'P2028'
}

async function executeExistingVoucherPostingTransaction(
  context: PostingContext,
  eventId: string,
  voucherId: string,
  validated: ValidatedPostingData,
  voucherNumber: string,
): Promise<{ voucherId: string }> {
  const { request } = validated
  const payloadHash = hashPayload(request)
  const postedAt = new Date()

  return prisma.$transaction(
    async (tx) => {
      const event = await tx.postingEvent.findFirst({ where: { id: eventId, tenantId: context.tenantId } })
      if (!event) {
        throw new PostingError('POSTING_TRANSACTION_FAILED', 'Posting event not found in transaction')
      }
      if (event.status === 'POSTED' && event.voucherId) {
        return { voucherId: event.voucherId }
      }
      if (event.status !== 'PROCESSING') {
        await tx.postingEvent.update({
          where: { id: eventId, tenantId: context.tenantId },
          data: { status: 'PROCESSING' },
        })
      }

      const voucher = await tx.accountingVoucher.findFirst({
        where: { id: voucherId, tenantId: context.tenantId },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })
      if (!voucher) {
        throw new PostingError('POSTING_TRANSACTION_FAILED', 'Approved journal voucher not found')
      }
      if (voucher.status !== 'APPROVED') {
        if (voucher.status === 'POSTED' && voucher.voucherNumber === voucherNumber) {
          return { voucherId: voucher.id }
        }
        throw new PostingError('POSTING_CONCURRENT_ACTION', `Journal status changed to ${voucher.status} during posting`)
      }
      if (voucher.voucherNumber) {
        if (voucher.voucherNumber === voucherNumber) {
          return { voucherId: voucher.id }
        }
        throw new PostingError('POSTING_CONCURRENT_ACTION', 'Journal voucher number was assigned concurrently')
      }

      if (__testOnly_failBeforeGl) {
        throw new PostingError('POSTING_TRANSACTION_FAILED', 'Simulated failure before GL insert')
      }

      const glRows: Prisma.GeneralLedgerEntryCreateManyInput[] = voucher.lines.map((line) => ({
        tenantId: context.tenantId,
        legalEntityId: voucher.legalEntityId,
        branchId: voucher.branchId,
        financialYearId: validated.financialYearId,
        accountingPeriodId: validated.accountingPeriodId,
        voucherId: voucher.id,
        voucherLineId: line.id,
        voucherType: request.voucherType,
        voucherNumber,
        lineNumber: line.lineNumber,
        postingDate: parseDateOnly(request.postingDate),
        documentDate: parseDateOnly(request.documentDate),
        accountId: line.accountId,
        partyType: line.partyType,
        partyId: line.partyId,
        partyNameSnapshot: line.partyNameSnapshot,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        baseDebitAmount: line.baseDebitAmount,
        baseCreditAmount: line.baseCreditAmount,
        currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate,
        costCentreId: line.costCentreId,
        projectReference: line.projectReference,
        departmentReference: line.departmentReference,
        sourceModule: request.sourceModule ?? null,
        sourceDocumentType: request.sourceDocumentType ?? null,
        sourceDocumentId: request.sourceDocumentId ?? null,
        sourceDocumentLineId: request.sourceDocumentLineId ?? null,
        postedBy: context.userId ?? null,
        postedAt,
      }))

      await tx.generalLedgerEntry.createMany({ data: glRows })

      const updateResult = await tx.accountingVoucher.updateMany({
        where: {
          id: voucherId,
          tenantId: context.tenantId,
          status: 'APPROVED',
          voucherNumber: null,
        },
        data: {
          voucherNumber,
          status: 'POSTED',
          postedAt,
          postedBy: context.userId ?? null,
          financialYearId: validated.financialYearId,
          accountingPeriodId: validated.accountingPeriodId,
          totalDebit: toDecimal(validated.totalDebit),
          totalCredit: toDecimal(validated.totalCredit),
          baseTotalDebit: toDecimal(validated.baseTotalDebit),
          baseTotalCredit: toDecimal(validated.baseTotalCredit),
          updatedBy: context.userId ?? null,
        },
      })

      if (updateResult.count === 0) {
        const current = await tx.accountingVoucher.findFirst({
          where: { id: voucherId, tenantId: context.tenantId },
        })
        if (current?.status === 'POSTED' && current.voucherNumber === voucherNumber) {
          return { voucherId: current.id }
        }
        throw new PostingError(
          'POSTING_CONCURRENT_ACTION',
          `Journal could not be posted — status is ${current?.status ?? 'unknown'}`,
        )
      }

      await tx.postingEvent.update({
        where: { id: eventId, tenantId: context.tenantId },
        data: {
          status: 'POSTED',
          voucherId: voucher.id,
          processedAt: postedAt,
          payloadHash,
          errorCode: null,
          errorMessage: null,
        },
      })

      return { voucherId: voucher.id }
    },
    { timeout: TX_TIMEOUT_MS },
  )
}

async function runExistingVoucherTransactionWithRetry(
  context: PostingContext,
  eventId: string,
  voucherId: string,
  validated: ValidatedPostingData,
  voucherNumber: string,
): Promise<{ voucherId: string }> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
    try {
      return await executeExistingVoucherPostingTransaction(context, eventId, voucherId, validated, voucherNumber)
    } catch (error) {
      lastError = error
      if (!isRetryableTransactionError(error) || attempt >= MAX_TX_RETRIES - 1) {
        throw error
      }
    }
  }
  throw lastError
}

export async function postExistingApprovedVoucher(
  input: { voucherId: string },
  context: PostExistingApprovedVoucherContext,
): Promise<PostingResult & { idempotentReplay: boolean }> {
  if (!context.authorization.permissionChecked || !context.authorization.approvalWorkflowSatisfied) {
    throw new PostingError('AUTHORIZATION_NOT_VERIFIED', 'Posting authorization was not verified by caller')
  }

  const voucher = await prisma.accountingVoucher.findFirst({
    where: { id: input.voucherId, tenantId: context.tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!voucher) {
    throw new PostingError('VALIDATION_FAILED', 'Journal voucher not found')
  }

  // Allow already-posted vouchers through for idempotent replay only.
  if (!(voucher.status === 'POSTED' && voucher.voucherNumber)) {
    assertExistingVoucherEligibility(voucher)
  }

  const request = buildPostingRequestFromApprovedVoucher(voucher)
  const postingContext = toPostingContext(context)

  const idempotency = await beginIdempotentPosting(context.tenantId, request, context.userId)
  if (idempotency.idempotentReplay) {
    const replay = buildReplayResult(idempotency.event)
    const result = await buildPostedResult(context.tenantId, replay.postingEventId, replay.voucherId, true)
    return { ...result, idempotentReplay: true }
  }

  // Non-replay path must still be an eligible approved journal.
  assertExistingVoucherEligibility(voucher)

  let event = idempotency.event

  try {
    const validated = await validatePostingRequest(context.tenantId, request)
    await postingEventRepo.markValidated(context.tenantId, event.id)

    const reservation = await reserveVoucherNumber(
      context.tenantId,
      request.legalEntityId,
      validated.financialYearId,
      request.voucherType,
      event,
    )

    event = await postingEventRepo.findByIdOrThrow(context.tenantId, event.id)
    await postingEventRepo.markProcessing(context.tenantId, event.id)

    const txResult = await runExistingVoucherTransactionWithRetry(
      postingContext,
      event.id,
      voucher.id,
      validated,
      reservation.voucherNumber,
    )

    event = await postingEventRepo.findByIdOrThrow(context.tenantId, event.id)

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId ?? null,
      module: 'finance',
      entity: 'accounting_voucher',
      entityId: txResult.voucherId,
      action: 'POST',
      newValues: {
        postingEventId: event.id,
        voucherNumber: reservation.voucherNumber,
        eventKey: request.eventKey,
        voucherType: request.voucherType,
        postingDate: request.postingDate,
        totalDebit: validated.totalDebit,
        totalCredit: validated.totalCredit,
        sourceModule: request.sourceModule,
        sourceDocumentType: request.sourceDocumentType,
        sourceDocumentId: request.sourceDocumentId,
        legalEntityId: request.legalEntityId,
        branchId: request.branchId,
        existingVoucherPost: true,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    const result = await buildPostedResult(context.tenantId, event.id, txResult.voucherId, false)
    return { ...result, idempotentReplay: false }
  } catch (error) {
    const code = error instanceof PostingError ? error.code ?? 'POSTING_TRANSACTION_FAILED' : 'POSTING_TRANSACTION_FAILED'
    const message = error instanceof Error ? error.message : 'Posting failed'
    if (event?.id) {
      await postingEventRepo.markFailed(context.tenantId, event.id, code, message.slice(0, 500)).catch(() => {})
    }
    throw error
  }
}
