import type { Prisma } from '@prisma/client'
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
import type { PostingContext, PostingRequest, PostingResult, ValidatedPostingData } from './posting.types.js'

const MAX_TX_RETRIES = 3
const TX_TIMEOUT_MS = 15_000

/** Test hook — when true, executePostingTransaction throws after voucher/lines create, before GL insert. */
export let __testOnly_failBeforeGl = false

export function setTestOnlyFailBeforeGl(value: boolean): void {
  __testOnly_failBeforeGl = value
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return code === 'P2034' || code === 'P2028'
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function buildPostedResult(
  tenantId: string,
  postingEventId: string,
  voucherId: string,
  idempotentReplay: boolean,
): Promise<PostingResult> {
  const voucher = await prisma.accountingVoucher.findFirst({
    where: { id: voucherId, tenantId },
    include: { _count: { select: { generalLedgerEntries: true } } },
  })
  if (!voucher || !voucher.voucherNumber) {
    throw new PostingError('POSTING_TRANSACTION_FAILED', 'Posted voucher could not be loaded')
  }
  return {
    success: true,
    idempotentReplay,
    postingEventId,
    voucherId: voucher.id,
    voucherNumber: voucher.voucherNumber,
    voucherStatus: 'POSTED',
    postingDate: toIsoDate(voucher.postingDate),
    totalDebit: formatForPersistence(voucher.totalDebit, 4),
    totalCredit: formatForPersistence(voucher.totalCredit, 4),
    ledgerEntryCount: voucher._count.generalLedgerEntries,
    status: 'POSTED',
  }
}

export async function post(request: PostingRequest, context: PostingContext): Promise<PostingResult> {
  if (!context.authorization.permissionChecked) {
    throw new PostingError('AUTHORIZATION_NOT_VERIFIED', 'Posting authorization was not verified by caller')
  }
  if (!context.workflow.workflowSatisfied) {
    throw new PostingError('WORKFLOW_NOT_SATISFIED', 'Posting workflow prerequisites were not satisfied by caller')
  }

  const idempotency = await beginIdempotentPosting(context.tenantId, request, context.userId)
  if (idempotency.idempotentReplay) {
    const replay = buildReplayResult(idempotency.event)
    return buildPostedResult(context.tenantId, replay.postingEventId, replay.voucherId, true)
  }

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

    const txResult = await runPostingTransactionWithRetry(context, event.id, validated, reservation.voucherNumber)

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
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return buildPostedResult(context.tenantId, event.id, txResult.voucherId, false)
  } catch (error) {
    const code = error instanceof PostingError ? error.code ?? 'POSTING_TRANSACTION_FAILED' : 'POSTING_TRANSACTION_FAILED'
    const message = error instanceof Error ? error.message : 'Posting failed'
    if (event?.id) {
      await postingEventRepo.markFailed(context.tenantId, event.id, code, message.slice(0, 500)).catch(() => {})
    }
    throw error
  }
}

async function runPostingTransactionWithRetry(
  context: PostingContext,
  eventId: string,
  validated: ValidatedPostingData,
  voucherNumber: string,
): Promise<{ voucherId: string }> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
    try {
      return await executePostingTransaction(context, eventId, validated, voucherNumber)
    } catch (error) {
      lastError = error
      if (!isRetryableTransactionError(error) || attempt >= MAX_TX_RETRIES - 1) {
        throw error
      }
    }
  }
  throw lastError
}

export async function executePostingTransaction(
  context: PostingContext,
  eventId: string,
  validated: ValidatedPostingData,
  voucherNumber: string,
): Promise<{ voucherId: string }> {
  const { request } = validated
  const payloadHash = hashPayload(request)

  return prisma.$transaction(
    async (tx) => {
      const voucher = await tx.accountingVoucher.create({
        data: {
          tenantId: context.tenantId,
          legalEntityId: request.legalEntityId,
          branchId: request.branchId ?? null,
          financialYearId: validated.financialYearId,
          accountingPeriodId: validated.accountingPeriodId,
          voucherType: request.voucherType,
          voucherNumber,
          status: 'POSTED',
          documentDate: parseDateOnly(request.documentDate),
          postingDate: parseDateOnly(request.postingDate),
          referenceNumber: request.referenceNumber ?? null,
          externalReference: request.externalReference ?? null,
          narration: request.narration ?? null,
          currencyCode: validated.voucherCurrency,
          exchangeRate: toDecimal(validated.voucherExchangeRate),
          totalDebit: toDecimal(validated.totalDebit),
          totalCredit: toDecimal(validated.totalCredit),
          baseTotalDebit: toDecimal(validated.baseTotalDebit),
          baseTotalCredit: toDecimal(validated.baseTotalCredit),
          sourceModule: request.sourceModule ?? null,
          sourceDocumentType: request.sourceDocumentType ?? null,
          sourceDocumentId: request.sourceDocumentId ?? null,
          sourceDocumentLineId: request.sourceDocumentLineId ?? null,
          postedAt: new Date(),
          postedBy: context.userId ?? null,
          createdBy: context.userId ?? null,
          updatedBy: context.userId ?? null,
        },
      })

      const lineRecords = await Promise.all(
        validated.resolvedLines.map((line) =>
          tx.accountingVoucherLine.create({
            data: {
              tenantId: context.tenantId,
              legalEntityId: request.legalEntityId,
              voucherId: voucher.id,
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              partyType: line.partyType ?? null,
              partyId: line.partyId ?? null,
              partyNameSnapshot: line.partyNameSnapshot ?? null,
              debitAmount: toDecimal(line.debitAmount),
              creditAmount: toDecimal(line.creditAmount),
              baseDebitAmount: toDecimal(line.baseDebitAmount),
              baseCreditAmount: toDecimal(line.baseCreditAmount),
              currencyCode: line.currencyCode,
              exchangeRate: toDecimal(line.exchangeRate),
              costCentreId: line.costCentreId ?? null,
              projectReference: line.projectReference ?? null,
              departmentReference: line.departmentReference ?? null,
              referenceDocumentType: line.referenceDocumentType ?? null,
              referenceDocumentId: line.referenceDocumentId ?? null,
              referenceDocumentLineId: line.referenceDocumentLineId ?? null,
              dueDate: line.dueDate ? parseDateOnly(line.dueDate) : null,
              lineNarration: line.lineNarration ?? null,
            },
          }),
        ),
      )

      if (__testOnly_failBeforeGl) {
        throw new PostingError('POSTING_TRANSACTION_FAILED', 'Simulated failure before GL insert')
      }

      const glRows: Prisma.GeneralLedgerEntryCreateManyInput[] = lineRecords.map((line) => ({
        tenantId: context.tenantId,
        legalEntityId: request.legalEntityId,
        branchId: request.branchId ?? null,
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
        postedAt: new Date(),
      }))

      await tx.generalLedgerEntry.createMany({ data: glRows })

      await tx.postingEvent.update({
        where: { id: eventId, tenantId: context.tenantId },
        data: {
          status: 'POSTED',
          voucherId: voucher.id,
          processedAt: new Date(),
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
