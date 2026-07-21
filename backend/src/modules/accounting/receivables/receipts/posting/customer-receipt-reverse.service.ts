import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import { formatForPersistence, isZero } from '../../../shared/finance-decimal.js'
import * as repo from '../customer-receipt.repository.js'
import { serializeCustomerReceiptDetail } from '../customer-receipt-read.service.js'
import { CustomerReceiptNotFoundError } from '../customer-receipt.errors.js'
import {
  CustomerReceiptAllocationsMustBeReversedError,
  CustomerReceiptNotPostedForReversalError,
  CustomerReceiptReversalCreditNotClearError,
  CustomerReceiptReversalEligibilityError,
  CustomerReceiptReversalNotAllowedError,
  mapPostingErrorToCustomerReceiptError,
} from './customer-receipt-posting.errors.js'
import {
  buildCustomerReceiptReverseEventKey,
  type ReverseCustomerReceiptInput,
  type ReverseCustomerReceiptResult,
} from './customer-receipt-posting.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.ar.receipt.reverse')) {
    throw new CustomerReceiptReversalNotAllowedError()
  }
}

function buildReversalPostingRequest(
  originalVoucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  receiptId: string,
  reason: string,
): PostingRequest {
  const currencyCode = originalVoucher.currencyCode
  const exchangeRate = originalVoucher.exchangeRate.toString()
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
      // Swap debit <-> credit to reverse the original entry.
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
    eventKey: buildCustomerReceiptReverseEventKey(receiptId),
    eventType: 'CUSTOMER_RECEIPT_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of customer receipt voucher ${originalVoucher.voucherNumber ?? ''}: ${reason}`.slice(0, 500),
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'CUSTOMER_RECEIPT',
    sourceDocumentId: receiptId,
    lines: reversalLines,
  }
}

async function loadReversedResult(
  req: Request,
  tenantId: string,
  receiptId: string,
  posting: ReverseCustomerReceiptResult['posting'],
  reversalVoucherId: string,
  idempotentReplay: boolean,
): Promise<ReverseCustomerReceiptResult> {
  const receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  const detail = await serializeCustomerReceiptDetail(req, receipt)
  return { receipt: detail, posting, reversalVoucherId, idempotentReplay }
}

export async function reverseCustomerReceiptFromRequest(
  req: Request,
  tenantId: string,
  receiptId: string,
  reason: string,
): Promise<ReverseCustomerReceiptResult> {
  assertReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  return reverseCustomerReceipt(
    { tenantId, receiptId, reason, userId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
    req,
  )
}

export async function reverseCustomerReceipt(
  input: ReverseCustomerReceiptInput,
  req: Request,
): Promise<ReverseCustomerReceiptResult> {
  let receipt
  try {
    receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(input.tenantId, input.receiptId)
  } catch {
    throw new CustomerReceiptNotFoundError()
  }

  // Idempotent replay: already reversed.
  if (receipt.status === 'REVERSED') {
    if (!receipt.reversalVoucherId) {
      throw new CustomerReceiptNotPostedForReversalError('Receipt is reversed but missing a reversal voucher')
    }
    const posting = await buildPostedResult(input.tenantId, '', receipt.reversalVoucherId, true)
    return loadReversedResult(req, input.tenantId, input.receiptId, posting, receipt.reversalVoucherId, true)
  }

  if (receipt.status !== 'POSTED' || !receipt.accountingVoucherId) {
    throw new CustomerReceiptNotPostedForReversalError()
  }

  // Prerequisite: no POSTED allocation lines remain.
  const postedAllocations = await prisma.customerReceiptAllocation.count({
    where: { tenantId: input.tenantId, receiptId: input.receiptId, status: 'POSTED' },
  })
  if (postedAllocations > 0) {
    throw new CustomerReceiptAllocationsMustBeReversedError()
  }

  // Prerequisite: credit open item fully unallocated.
  const creditOpenItem = receipt.creditOpenItemId
    ? await prisma.receivableOpenItem.findFirst({
        where: { id: receipt.creditOpenItemId, tenantId: input.tenantId },
      })
    : null
  if (!creditOpenItem) {
    throw new CustomerReceiptReversalCreditNotClearError('Receipt credit open item not found')
  }
  if (!isZero(creditOpenItem.allocatedAmount)) {
    throw new CustomerReceiptReversalCreditNotClearError()
  }

  const originalVoucher = await prisma.accountingVoucher.findFirst({
    where: { id: receipt.accountingVoucherId, tenantId: input.tenantId },
  })
  if (!originalVoucher) {
    throw new CustomerReceiptNotPostedForReversalError('Original voucher not found for reversal')
  }
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new CustomerReceiptReversalEligibilityError('Original voucher has already been reversed or is not posted')
  }

  const voucherLines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: originalVoucher.id, tenantId: input.tenantId },
  })

  const postingRequest = buildReversalPostingRequest(originalVoucher, voucherLines, input.receiptId, input.reason)

  const postingContext: PostingContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }

  let reversalVoucherId: string | null = null

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, context, voucherId }) => {
        const eligibility = validateReversalEligibility(
          originalVoucher,
          voucherId,
          context.tenantId,
          originalVoucher.legalEntityId,
        )
        if (!eligibility.valid) {
          throw new CustomerReceiptReversalEligibilityError(
            eligibility.errors.map((e) => e.message).join('; '),
            eligibility.errors.map((e) => ({ field: e.field ?? 'voucher', message: e.message })),
          )
        }

        // Close the fully-unallocated credit open item.
        const closed = await tx.receivableOpenItem.updateMany({
          where: {
            id: creditOpenItem.id,
            tenantId: context.tenantId,
            allocatedAmount: 0,
            status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
          },
          data: {
            openAmount: 0,
            baseOpenAmount: 0,
            status: 'SETTLED',
            settledAt: new Date(),
            updatedBy: context.userId ?? null,
          },
        })
        if (closed.count !== 1) throw new CustomerReceiptReversalCreditNotClearError()

        // Link original voucher -> reversing voucher.
        await tx.accountingVoucher.update({
          where: { id: originalVoucher.id, tenantId: context.tenantId },
          data: {
            status: 'REVERSED',
            reversedByVoucherId: voucherId,
            reversedAt: new Date(),
            reversedBy: context.userId ?? null,
            reversalReason: input.reason,
          },
        })
        // Link reversing voucher -> original voucher.
        await tx.accountingVoucher.update({
          where: { id: voucherId, tenantId: context.tenantId },
          data: { reversalOfVoucherId: originalVoucher.id, reversalReason: input.reason },
        })

        // Flip the receipt document to REVERSED.
        const updated = await tx.customerReceipt.updateMany({
          where: { id: input.receiptId, tenantId: context.tenantId, status: 'POSTED' },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
            reversedBy: context.userId ?? null,
            reversalReason: input.reason,
            reversalVoucherId: voucherId,
            updatedBy: context.userId ?? null,
          },
        })
        if (updated.count !== 1) throw new CustomerReceiptReversalEligibilityError('Receipt changed concurrently')

        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      return loadReversedResult(req, input.tenantId, input.receiptId, posting, posting.voucherId, true)
    }

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      module: 'finance',
      entity: 'customer_receipt',
      entityId: input.receiptId,
      action: 'CUSTOMER_RECEIPT_REVERSED',
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
      input.receiptId,
      posting,
      reversalVoucherId ?? posting.voucherId,
      false,
    )
  } catch (error) {
    mapPostingErrorToCustomerReceiptError(error)
  }
}

export async function canReverseCustomerReceipt(req: Request, status: string): Promise<boolean> {
  if (status !== 'POSTED') return false
  return hasPerm(req, 'finance.ar.receipt.reverse')
}
