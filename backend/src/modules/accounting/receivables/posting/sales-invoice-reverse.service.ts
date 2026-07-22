import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../utils/errors.js'
import { validateReversalEligibility } from '../../ledger/ledger.validators.js'
import { buildPostedResult, post } from '../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../../posting/posting.types.js'
import { formatForPersistence, isZero } from '../../shared/finance-decimal.js'
import * as repo from '../sales-invoices/sales-invoice.repository.js'
import { serializeSalesInvoiceDetail } from '../sales-invoices/sales-invoice-read.service.js'
import { SalesInvoiceNotFoundError } from '../sales-invoices/sales-invoice.errors.js'
import {
  SalesInvoiceAllocationsMustBeReversedError,
  SalesInvoiceNotPostedForReversalError,
  SalesInvoiceReversalDebitNotClearError,
  SalesInvoiceReversalEligibilityError,
  SalesInvoiceReversalNotAllowedError,
  mapPostingErrorToSalesInvoiceError,
} from './sales-invoice-posting.errors.js'
import {
  buildSalesInvoiceReverseEventKey,
  type ReverseSalesInvoiceInput,
  type ReverseSalesInvoiceResult,
} from './sales-invoice-posting.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.ar.invoice.reverse')) {
    throw new SalesInvoiceReversalNotAllowedError()
  }
}

function buildReversalPostingRequest(
  originalVoucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  invoiceId: string,
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
    eventKey: buildSalesInvoiceReverseEventKey(invoiceId),
    eventType: 'SALES_INVOICE_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of sales invoice voucher ${originalVoucher.voucherNumber ?? ''}: ${reason}`.slice(0, 500),
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'SALES_INVOICE',
    sourceDocumentId: invoiceId,
    lines: reversalLines,
  }
}

async function loadReversedResult(
  req: Request,
  tenantId: string,
  invoiceId: string,
  posting: ReverseSalesInvoiceResult['posting'],
  reversalVoucherId: string,
  idempotentReplay: boolean,
): Promise<ReverseSalesInvoiceResult> {
  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  const detail = await serializeSalesInvoiceDetail(req, invoice)
  return { invoice: detail, posting, reversalVoucherId, idempotentReplay }
}

export async function reverseSalesInvoiceFromRequest(
  req: Request,
  tenantId: string,
  invoiceId: string,
  reason: string,
): Promise<ReverseSalesInvoiceResult> {
  assertReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  return reverseSalesInvoice(
    { tenantId, invoiceId, reason, userId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
    req,
  )
}

export async function reverseSalesInvoice(
  input: ReverseSalesInvoiceInput,
  req: Request,
): Promise<ReverseSalesInvoiceResult> {
  let invoice
  try {
    invoice = await repo.findSalesInvoiceWithLinesOrThrow(input.tenantId, input.invoiceId)
  } catch {
    throw new SalesInvoiceNotFoundError()
  }

  // Idempotent replay: already reversed.
  if (invoice.status === 'REVERSED') {
    if (!invoice.reversalVoucherId) {
      throw new SalesInvoiceNotPostedForReversalError('Invoice is reversed but missing a reversal voucher')
    }
    const posting = await buildPostedResult(input.tenantId, '', invoice.reversalVoucherId, true)
    return loadReversedResult(req, input.tenantId, input.invoiceId, posting, invoice.reversalVoucherId, true)
  }

  if (invoice.status !== 'POSTED' || !invoice.accountingVoucherId) {
    throw new SalesInvoiceNotPostedForReversalError()
  }

  // Prerequisite: no POSTED receipt or credit-note allocations remain (allocation-first; no cascade).
  const [postedReceiptAllocations, postedCreditNoteAllocations] = await Promise.all([
    prisma.customerReceiptAllocation.count({
      where: { tenantId: input.tenantId, invoiceId: input.invoiceId, status: 'POSTED' },
    }),
    prisma.customerCreditNoteAllocation.count({
      where: { tenantId: input.tenantId, invoiceId: input.invoiceId, status: 'POSTED' },
    }),
  ])
  if (postedReceiptAllocations > 0 || postedCreditNoteAllocations > 0) {
    throw new SalesInvoiceAllocationsMustBeReversedError()
  }

  // Prerequisite: debit open item fully unallocated.
  const debitOpenItem = await prisma.receivableOpenItem.findFirst({
    where: {
      tenantId: input.tenantId,
      salesInvoiceId: input.invoiceId,
      documentType: 'SALES_INVOICE',
      side: 'DEBIT',
    },
  })
  if (!debitOpenItem) {
    throw new SalesInvoiceReversalDebitNotClearError('Invoice debit open item not found')
  }
  if (!isZero(debitOpenItem.allocatedAmount)) {
    throw new SalesInvoiceReversalDebitNotClearError()
  }

  const originalVoucher = await prisma.accountingVoucher.findFirst({
    where: { id: invoice.accountingVoucherId, tenantId: input.tenantId },
  })
  if (!originalVoucher) {
    throw new SalesInvoiceNotPostedForReversalError('Original voucher not found for reversal')
  }
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new SalesInvoiceReversalEligibilityError('Original voucher has already been reversed or is not posted')
  }

  const voucherLines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: originalVoucher.id, tenantId: input.tenantId },
  })

  const postingRequest = buildReversalPostingRequest(originalVoucher, voucherLines, input.invoiceId, input.reason)

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
          throw new SalesInvoiceReversalEligibilityError(
            eligibility.errors.map((e) => e.message).join('; '),
            eligibility.errors.map((e) => ({ field: e.field ?? 'voucher', message: e.message })),
          )
        }

        // Close the fully-unallocated debit open item.
        const closed = await tx.receivableOpenItem.updateMany({
          where: {
            id: debitOpenItem.id,
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
        if (closed.count !== 1) throw new SalesInvoiceReversalDebitNotClearError()

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

        // Flip the invoice document to REVERSED (preserve invoiceNumber).
        const updated = await tx.salesInvoice.updateMany({
          where: { id: input.invoiceId, tenantId: context.tenantId, status: 'POSTED' },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
            reversedBy: context.userId ?? null,
            reversalReason: input.reason,
            reversalVoucherId: voucherId,
            updatedBy: context.userId ?? null,
          },
        })
        if (updated.count !== 1) throw new SalesInvoiceReversalEligibilityError('Invoice changed concurrently')

        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      return loadReversedResult(req, input.tenantId, input.invoiceId, posting, posting.voucherId, true)
    }

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      module: 'finance',
      entity: 'sales_invoice',
      entityId: input.invoiceId,
      action: 'SALES_INVOICE_REVERSED',
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
      input.invoiceId,
      posting,
      reversalVoucherId ?? posting.voucherId,
      false,
    )
  } catch (error) {
    mapPostingErrorToSalesInvoiceError(error)
  }
}

export async function canReverseSalesInvoice(req: Request, status: string): Promise<boolean> {
  if (status !== 'POSTED') return false
  return hasPerm(req, 'finance.ar.invoice.reverse')
}
