import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { buildPostedResult, post } from '../../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import { formatForPersistence, isZero } from '../../../shared/finance-decimal.js'
import * as repo from '../customer-credit-note.repository.js'
import { serializeCustomerCreditNote } from '../customer-credit-note-read.service.js'
import {
  CustomerCreditNoteAllocationsMustBeReversedError,
  CustomerCreditNoteNotPostedForReversalError,
  CustomerCreditNoteReversalCreditNotClearError,
  CustomerCreditNoteReversalEligibilityError,
  CustomerCreditNoteReversalNotAllowedError,
  mapPostingError,
} from './customer-credit-note-posting.errors.js'
import {
  buildCustomerCreditNoteReverseEventKey,
  type ReverseCustomerCreditNoteInput,
  type ReverseCustomerCreditNoteResult,
} from './customer-credit-note-posting.types.js'

function hasPermission(req: Request, permission: string): boolean {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

function buildReversalPostingRequest(
  originalVoucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  creditNoteId: string,
  reason: string,
): PostingRequest {
  const postingDate = originalVoucher.postingDate.toISOString().slice(0, 10)
  const documentDate = originalVoucher.documentDate.toISOString().slice(0, 10)

  const reversalLines: PostingRequestLine[] = lines
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      partyType: (line.partyType as PostingRequestLine['partyType']) ?? null,
      partyId: line.partyId,
      partyNameSnapshot: line.partyNameSnapshot,
      debitAmount: formatForPersistence(line.creditAmount),
      creditAmount: formatForPersistence(line.debitAmount),
      baseDebitAmount: formatForPersistence(line.baseCreditAmount),
      baseCreditAmount: formatForPersistence(line.baseDebitAmount),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toString(),
      costCentreId: line.costCentreId,
      projectReference: line.projectReference,
      departmentReference: line.departmentReference,
      referenceDocumentType: line.referenceDocumentType,
      referenceDocumentId: line.referenceDocumentId,
      referenceDocumentLineId: line.referenceDocumentLineId,
      lineNarration: `Reversal: ${line.lineNarration ?? ''}`.slice(0, 500),
    }))

  return {
    legalEntityId: originalVoucher.legalEntityId,
    eventKey: buildCustomerCreditNoteReverseEventKey(creditNoteId),
    eventType: 'CUSTOMER_CREDIT_NOTE_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of customer credit note voucher ${originalVoucher.voucherNumber ?? ''}: ${reason}`.slice(0, 500),
    currencyCode: originalVoucher.currencyCode,
    exchangeRate: originalVoucher.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'CUSTOMER_CREDIT_NOTE',
    sourceDocumentId: creditNoteId,
    lines: reversalLines,
  }
}

async function loadReversedResult(
  req: Request,
  tenantId: string,
  creditNoteId: string,
  posting: ReverseCustomerCreditNoteResult['posting'],
  reversalVoucherId: string,
  idempotentReplay: boolean,
): Promise<ReverseCustomerCreditNoteResult> {
  const note = await repo.findWithLinesOrThrow(tenantId, creditNoteId)
  return { creditNote: await serializeCustomerCreditNote(req, note), posting, reversalVoucherId, idempotentReplay }
}

export async function reverseCustomerCreditNoteFromRequest(
  req: Request,
  tenantId: string,
  creditNoteId: string,
  reason: string,
): Promise<ReverseCustomerCreditNoteResult> {
  if (!hasPermission(req, 'finance.ar.credit_note.reverse')) {
    throw new CustomerCreditNoteReversalNotAllowedError()
  }
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const meta = auditFromRequest(req)
  return reverseCustomerCreditNote(
    { tenantId, creditNoteId, reason, userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    req,
  )
}

export async function reverseCustomerCreditNote(
  input: ReverseCustomerCreditNoteInput,
  req: Request,
): Promise<ReverseCustomerCreditNoteResult> {
  const note = await repo.findWithLinesOrThrow(input.tenantId, input.creditNoteId)

  if (note.status === 'REVERSED') {
    if (!note.reversalVoucherId) {
      throw new CustomerCreditNoteNotPostedForReversalError('Credit note is reversed but missing a reversal voucher')
    }
    const posting = await buildPostedResult(input.tenantId, '', note.reversalVoucherId, true)
    return loadReversedResult(req, input.tenantId, input.creditNoteId, posting, note.reversalVoucherId, true)
  }

  if (note.status !== 'POSTED' || !note.accountingVoucherId) {
    throw new CustomerCreditNoteNotPostedForReversalError()
  }

  const postedAllocations = await prisma.customerCreditNoteAllocation.count({
    where: { tenantId: input.tenantId, creditNoteId: input.creditNoteId, status: 'POSTED' },
  })
  if (postedAllocations > 0) {
    throw new CustomerCreditNoteAllocationsMustBeReversedError()
  }

  const creditOpenItem = note.creditOpenItemId
    ? await prisma.receivableOpenItem.findFirst({
        where: { id: note.creditOpenItemId, tenantId: input.tenantId },
      })
    : null
  if (!creditOpenItem) {
    throw new CustomerCreditNoteReversalCreditNotClearError('Credit note credit open item not found')
  }
  if (!isZero(creditOpenItem.allocatedAmount)) {
    throw new CustomerCreditNoteReversalCreditNotClearError()
  }

  const originalVoucher = await prisma.accountingVoucher.findFirst({
    where: { id: note.accountingVoucherId, tenantId: input.tenantId },
  })
  if (!originalVoucher) {
    throw new CustomerCreditNoteNotPostedForReversalError('Original voucher not found for reversal')
  }
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new CustomerCreditNoteReversalEligibilityError('Original voucher has already been reversed or is not posted')
  }

  const voucherLines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: originalVoucher.id, tenantId: input.tenantId },
  })

  const postingRequest = buildReversalPostingRequest(originalVoucher, voucherLines, input.creditNoteId, input.reason)

  const context: PostingContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }

  let reversalVoucherId: string | null = null

  try {
    const posting = await post(postingRequest, context, {
      afterAccounting: async ({ tx, context: ctx, voucherId }) => {
        const eligibility = validateReversalEligibility(
          originalVoucher,
          voucherId,
          ctx.tenantId,
          originalVoucher.legalEntityId,
        )
        if (!eligibility.valid) {
          throw new CustomerCreditNoteReversalEligibilityError(
            eligibility.errors.map((e) => e.message).join('; '),
            eligibility.errors.map((e) => ({ field: e.field ?? 'voucher', message: e.message })),
          )
        }

        const closed = await tx.receivableOpenItem.updateMany({
          where: {
            id: creditOpenItem.id,
            tenantId: ctx.tenantId,
            allocatedAmount: 0,
            status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
          },
          data: {
            openAmount: 0,
            baseOpenAmount: 0,
            status: 'SETTLED',
            settledAt: new Date(),
            updatedBy: ctx.userId ?? null,
          },
        })
        if (closed.count !== 1) throw new CustomerCreditNoteReversalCreditNotClearError()

        await tx.accountingVoucher.update({
          where: { id: originalVoucher.id, tenantId: ctx.tenantId },
          data: {
            status: 'REVERSED',
            reversedByVoucherId: voucherId,
            reversedAt: new Date(),
            reversedBy: ctx.userId ?? null,
            reversalReason: input.reason,
          },
        })
        await tx.accountingVoucher.update({
          where: { id: voucherId, tenantId: ctx.tenantId },
          data: { reversalOfVoucherId: originalVoucher.id, reversalReason: input.reason },
        })

        const updated = await tx.customerCreditNote.updateMany({
          where: { id: input.creditNoteId, tenantId: ctx.tenantId, status: 'POSTED' },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
            reversedBy: ctx.userId ?? null,
            reversalReason: input.reason,
            reversalVoucherId: voucherId,
            updatedBy: ctx.userId ?? null,
          },
        })
        if (updated.count !== 1) throw new CustomerCreditNoteReversalEligibilityError('Credit note changed concurrently')

        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      return loadReversedResult(req, input.tenantId, input.creditNoteId, posting, posting.voucherId, true)
    }

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      module: 'finance',
      entity: 'customer_credit_note',
      entityId: input.creditNoteId,
      action: 'CUSTOMER_CREDIT_NOTE_REVERSED',
      newValues: {
        reversalVoucherId: posting.voucherId,
        reversalVoucherNumber: posting.voucherNumber,
        originalVoucherId: originalVoucher.id,
        reason: input.reason,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })

    return loadReversedResult(
      req,
      input.tenantId,
      input.creditNoteId,
      posting,
      reversalVoucherId ?? posting.voucherId,
      false,
    )
  } catch (error) {
    mapPostingError(error)
  }
}

export function canReverseCustomerCreditNote(req: Request, status: string): boolean {
  if (status !== 'POSTED') return false
  return hasPermission(req, 'finance.ar.credit_note.reverse')
}
