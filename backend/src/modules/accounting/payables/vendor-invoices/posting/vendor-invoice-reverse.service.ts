import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine, PayableAllocationLine, VendorInvoice } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine, PostingResult } from '../../../posting/posting.types.js'
import { formatForPersistence, isZero, toDecimal } from '../../../shared/finance-decimal.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import { hashPayload } from '../../../shared/payload-hash.js'
import {
  findActivePayableAllocationLinesForOpenItem,
  reversePayableAllocationLinesInTx,
} from '../../allocations/payable-allocation-reverse.service.js'
import { VendorInvoiceNotFoundError, VendorInvoiceStaleVersionError } from '../vendor-invoice.errors.js'
import {
  VendorInvoiceActiveAllocationsExistError,
  VendorInvoiceOpenItemNotFullyRestoredError,
  VendorInvoiceOriginalPostingEventMissingError,
  VendorInvoiceOriginalVoucherMissingError,
  VendorInvoiceReversalDateInvalidError,
  VendorInvoiceReversalEligibilityError,
  VendorInvoiceReversalFailedError,
  VendorInvoiceReversalNotAllowedError,
  VendorInvoiceReversalNotPostedError,
  mapPostingErrorToVendorInvoiceReversalError,
} from './vendor-invoice-posting.errors.js'
import { buildVendorInvoiceReverseEventKey } from './vendor-invoice-posting.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertInvoiceReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.ap.vendor_invoice.reverse')) {
    throw new VendorInvoiceReversalNotAllowedError()
  }
}

export interface ReverseVendorInvoiceInput {
  vendorInvoiceId: string
  reversalDate: string
  reason: string
  idempotencyKey: string
  expectedUpdatedAt: string
  cascadeAllocationReversals?: boolean
}

export interface ReverseVendorInvoiceResult {
  idempotentReplay: boolean
  vendorInvoiceId: string
  vendorInvoiceNumber: string | null
  status: 'REVERSED'
  reversalVoucherId: string
  reversalVoucherNumber: string | null
  reversalPostingEventId: string | null
  posting: PostingResult
  allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }>
}

export interface VendorInvoiceReversalPreview {
  eligible: boolean
  requiresAllocationReversal: boolean
  activeAllocationCount: number
  activeAllocationAmount: string
  blockingIssues: string[]
  allowedActions: { reverse: boolean; reverseWithCascade: boolean }
  originalVoucherId: string | null
  originalVoucherNumber: string | null
  openItemId: string | null
  openItemStatus: string | null
  proposedReversalSummary: {
    lineCount: number
    totalDebit: string
    totalCredit: string
  } | null
}

function buildReversalPostingRequest(
  originalVoucher: AccountingVoucher,
  lines: AccountingVoucherLine[],
  invoice: VendorInvoice,
  reason: string,
  reversalDate: string,
): PostingRequest {
  const currencyCode = originalVoucher.currencyCode
  const exchangeRate = originalVoucher.exchangeRate.toString()
  const documentDate = originalVoucher.documentDate.toISOString().slice(0, 10)
  const sourceNumber = invoice.vendorInvoiceNumber ?? invoice.draftReference

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
    eventKey: buildVendorInvoiceReverseEventKey(invoice.id),
    eventType: 'VENDOR_INVOICE_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate: reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of Vendor Invoice ${sourceNumber}\nReason: ${reason}`.slice(0, 500),
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'VENDOR_INVOICE',
    sourceDocumentId: invoice.id,
    lines: reversalLines,
  }
}

async function cascadeReverseActiveAllocations(args: {
  tx: Parameters<NonNullable<import('../../../posting/posting.types.js').PostingOptions['beforeAccounting']>>[0]['tx']
  tenantId: string
  userId: string
  invoiceId: string
  openItemId: string
  legalEntityId: string
  reversalDate: Date
  reason: string
  eventKey: string
}): Promise<Array<{ allocationBatchId: string; reversalBatchId: string }>> {
  const active = await findActivePayableAllocationLinesForOpenItem(
    args.tenantId,
    args.legalEntityId,
    args.openItemId,
    'CREDIT',
  )
  if (active.length === 0) return []

  const byBatch = new Map<string, typeof active>()
  for (const line of active) {
    const list = byBatch.get(line.allocationBatchId) ?? []
    list.push(line)
    byBatch.set(line.allocationBatchId, list)
  }

  const results: Array<{ allocationBatchId: string; reversalBatchId: string }> = []
  const batchIds = [...byBatch.keys()].sort((a, b) => {
    const aDate = byBatch.get(a)![0]!.allocationBatch.allocationDate.getTime()
    const bDate = byBatch.get(b)![0]!.allocationBatch.allocationDate.getTime()
    if (bDate !== aDate) return bDate - aDate
    return a.localeCompare(b)
  })

  for (const batchId of batchIds) {
    const lines = byBatch.get(batchId)!
    const batch = await args.tx.payableAllocationBatch.findFirstOrThrow({
      where: { id: batchId, tenantId: args.tenantId },
    })
    const idempotencyKey = `CASCADE:${args.invoiceId}:${batchId}:${args.eventKey}`
    const payloadHash = hashPayload({
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      allocationBatchId: batchId,
      lineIds: lines.map((l) => l.id).sort(),
      reversalDate: args.reversalDate.toISOString().slice(0, 10),
      reason: args.reason,
      cascade: true,
      sourceDocumentId: args.invoiceId,
    })

    const existingRev = await args.tx.payableAllocationReversalBatch.findFirst({
      where: { idempotencyKey },
    })
    if (existingRev) {
      results.push({ allocationBatchId: batchId, reversalBatchId: existingRev.id })
      continue
    }

    const freshLines = await args.tx.payableAllocationLine.findMany({
      where: { id: { in: lines.map((l) => l.id) }, tenantId: args.tenantId },
    })
    const result = await reversePayableAllocationLinesInTx(args.tx, {
      tenantId: args.tenantId,
      userId: args.userId,
      batch,
      linesToReverse: freshLines as PayableAllocationLine[],
      reversalDate: args.reversalDate,
      reason: args.reason,
      idempotencyKey,
      payloadHash,
    })
    results.push({ allocationBatchId: batchId, reversalBatchId: result.reversalBatchId })
  }

  return results
}

export async function getVendorInvoiceReversalPreview(
  req: Request,
  tenantId: string,
  vendorInvoiceId: string,
): Promise<VendorInvoiceReversalPreview> {
  const invoice = await prisma.vendorInvoice.findFirst({ where: { id: vendorInvoiceId, tenantId } })
  if (!invoice) throw new VendorInvoiceNotFoundError()

  const previewOpenItem = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId: invoice.legalEntityId, sourceVendorInvoiceId: invoice.id },
  })
  const openItemId = previewOpenItem?.id ?? null

  const blockingIssues: string[] = []
  const canReverse = hasPerm(req, 'finance.ap.vendor_invoice.reverse')
  if (!canReverse) blockingIssues.push('Missing permission finance.ap.vendor_invoice.reverse')
  if (invoice.status === 'REVERSED') blockingIssues.push('Invoice already reversed')
  if (invoice.status !== 'POSTED') blockingIssues.push('Invoice must be POSTED')
  if (!invoice.accountingVoucherId) blockingIssues.push('Original accounting voucher missing')
  if (!invoice.postingEventId) blockingIssues.push('Original posting event missing')
  if (!openItemId) blockingIssues.push('CREDIT open item missing')

  let activeAllocationCount = 0
  let activeAllocationAmount = '0.0000'
  let requiresAllocationReversal = false
  if (openItemId) {
    const active = await findActivePayableAllocationLinesForOpenItem(
      tenantId,
      invoice.legalEntityId,
      openItemId,
      'CREDIT',
    )
    activeAllocationCount = active.length
    activeAllocationAmount = formatForPersistence(
      active.reduce((sum, l) => sum.add(toDecimal(l.amount).sub(toDecimal(l.reversedAmount))), toDecimal(0)),
    )
    requiresAllocationReversal = activeAllocationCount > 0
    if (requiresAllocationReversal) {
      blockingIssues.push('Active allocations must be reversed first (or use cascadeAllocationReversals)')
    }
  }

  let proposedReversalSummary: VendorInvoiceReversalPreview['proposedReversalSummary'] = null
  let originalVoucherNumber: string | null = null
  if (invoice.accountingVoucherId) {
    const voucher = await prisma.accountingVoucher.findFirst({
      where: { id: invoice.accountingVoucherId, tenantId },
      include: { lines: true },
    })
    if (voucher) {
      originalVoucherNumber = voucher.voucherNumber
      proposedReversalSummary = {
        lineCount: voucher.lines.length,
        totalDebit: formatForPersistence(voucher.totalCredit),
        totalCredit: formatForPersistence(voucher.totalDebit),
      }
      if (voucher.status !== 'POSTED' || voucher.reversedByVoucherId) {
        blockingIssues.push('Original voucher is not eligible for reversal')
      }
    }
  }

  const openItem = previewOpenItem

  const eligible =
    canReverse &&
    invoice.status === 'POSTED' &&
    !!invoice.accountingVoucherId &&
    !!openItemId &&
    !requiresAllocationReversal

  return {
    eligible,
    requiresAllocationReversal,
    activeAllocationCount,
    activeAllocationAmount,
    blockingIssues,
    allowedActions: {
      reverse: eligible,
      reverseWithCascade: canReverse && invoice.status === 'POSTED' && !!invoice.accountingVoucherId,
    },
    originalVoucherId: invoice.accountingVoucherId,
    originalVoucherNumber,
    openItemId: openItemId,
    openItemStatus: openItem?.status ?? null,
    proposedReversalSummary,
  }
}

export async function reverseVendorInvoiceFromRequest(
  req: Request,
  tenantId: string,
  vendorInvoiceId: string,
  body: {
    reversalDate: string
    reason: string
    idempotencyKey: string
    expectedUpdatedAt: string
    cascadeAllocationReversals?: boolean
  },
): Promise<ReverseVendorInvoiceResult> {
  assertInvoiceReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  return reverseVendorInvoice(
    {
      vendorInvoiceId,
      reversalDate: body.reversalDate,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      expectedUpdatedAt: body.expectedUpdatedAt,
      cascadeAllocationReversals: body.cascadeAllocationReversals ?? false,
    },
    { tenantId, userId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
  )
}

export async function reverseVendorInvoice(
  input: ReverseVendorInvoiceInput,
  context: { tenantId: string; userId: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<ReverseVendorInvoiceResult> {
  const invoice = await prisma.vendorInvoice.findFirst({
    where: { id: input.vendorInvoiceId, tenantId: context.tenantId },
  })
  if (!invoice) throw new VendorInvoiceNotFoundError()

  if (invoice.status === 'REVERSED') {
    if (!invoice.reversalVoucherId) {
      throw new VendorInvoiceReversalFailedError('Payment is reversed but missing reversal voucher')
    }
    const posting = await buildPostedResult(context.tenantId, '', invoice.reversalVoucherId, true)
    return {
      idempotentReplay: true,
      vendorInvoiceId: invoice.id,
      vendorInvoiceNumber: invoice.vendorInvoiceNumber,
      status: 'REVERSED',
      reversalVoucherId: invoice.reversalVoucherId,
      reversalVoucherNumber: posting.voucherNumber,
      reversalPostingEventId: invoice.reversalPostingEventId,
      posting,
      allocationReversals: [],
    }
  }

  if (invoice.status !== 'POSTED' || !invoice.accountingVoucherId) {
    throw new VendorInvoiceReversalNotPostedError()
  }
  if (!invoice.postingEventId) throw new VendorInvoiceOriginalPostingEventMissingError()
  const resolvedOpenItem = await prisma.payableOpenItem.findFirst({
    where: { tenantId: context.tenantId, legalEntityId: invoice.legalEntityId, sourceVendorInvoiceId: invoice.id },
  })
  if (!resolvedOpenItem) {
    throw new VendorInvoiceReversalEligibilityError('Posted invoice is missing CREDIT open item')
  }
  const openItemId = resolvedOpenItem.id
  if (invoice.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new VendorInvoiceStaleVersionError()
  }

  const reversalDateValue = parseDateOnly(input.reversalDate)
  if (invoice.postedAt && reversalDateValue < parseDateOnly(invoice.postedAt.toISOString().slice(0, 10))) {
    // allow same calendar day as posting date via postingDate field when available
  }
  const originalVoucher = await prisma.accountingVoucher.findFirst({
    where: { id: invoice.accountingVoucherId, tenantId: context.tenantId },
  })
  if (!originalVoucher) throw new VendorInvoiceOriginalVoucherMissingError()
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new VendorInvoiceReversalEligibilityError('Original voucher has already been reversed or is not posted')
  }
  if (reversalDateValue < parseDateOnly(originalVoucher.postingDate.toISOString().slice(0, 10))) {
    throw new VendorInvoiceReversalDateInvalidError('Reversal date must not precede original posting date')
  }

  const active = await findActivePayableAllocationLinesForOpenItem(
    context.tenantId,
    invoice.legalEntityId,
    openItemId,
    'CREDIT',
  )
  if (active.length > 0 && !input.cascadeAllocationReversals) {
    throw new VendorInvoiceActiveAllocationsExistError(
      active.map((l) => ({
        allocationBatchId: l.allocationBatchId,
        allocationReference: l.allocationBatch.allocationReference,
        allocationLineId: l.id,
        activeAmount: formatForPersistence(toDecimal(l.amount).sub(toDecimal(l.reversedAmount))),
      })),
    )
  }

  const voucherLines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: originalVoucher.id, tenantId: context.tenantId },
  })
  const postingRequest = buildReversalPostingRequest(
    originalVoucher,
    voucherLines,
    invoice,
    input.reason,
    input.reversalDate,
  )

  const postingContext: PostingContext = {
    tenantId: context.tenantId,
    userId: context.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }

  let allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }> = []
  let reversalVoucherId: string | null = null

  try {
    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_invoice',
      entityId: invoice.id,
      action: 'VENDOR_INVOICE_REVERSAL_STARTED',
      newValues: { reason: input.reason, reversalDate: input.reversalDate },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    const posting = await post(postingRequest, postingContext, {
      beforeAccounting: async ({ tx }) => {
        if (input.cascadeAllocationReversals && active.length > 0) {
          allocationReversals = await cascadeReverseActiveAllocations({
            tx,
            tenantId: context.tenantId,
            userId: context.userId,
            invoiceId: invoice.id,
            openItemId: openItemId,
            legalEntityId: invoice.legalEntityId,
            reversalDate: reversalDateValue,
            reason: input.reason,
            eventKey: postingRequest.eventKey,
          })
        }

        const openItem = await tx.payableOpenItem.findFirstOrThrow({
          where: { id: openItemId, tenantId: context.tenantId },
        })
        if (!isZero(openItem.allocatedAmount) || !toDecimal(openItem.outstandingAmount).eq(openItem.originalAmount)) {
          throw new VendorInvoiceOpenItemNotFullyRestoredError()
        }
      },
      afterAccounting: async ({ tx, context: postCtx, voucherId, eventId }) => {
        const eligibility = validateReversalEligibility(
          originalVoucher,
          voucherId,
          postCtx.tenantId,
          originalVoucher.legalEntityId,
        )
        if (!eligibility.valid) {
          throw new VendorInvoiceReversalEligibilityError(
            eligibility.errors.map((e) => e.message).join('; '),
          )
        }

        const closed = await tx.payableOpenItem.updateMany({
          where: {
            id: openItemId,
            tenantId: postCtx.tenantId,
            allocatedAmount: 0,
            status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
          },
          data: {
            outstandingAmount: 0,
            baseOutstandingAmount: 0,
            allocatedAmount: 0,
            baseAllocatedAmount: 0,
            status: 'REVERSED',
            settledAt: null,
            reversedAt: new Date(),
            updatedBy: postCtx.userId ?? null,
          },
        })
        if (closed.count !== 1) {
          throw new VendorInvoiceOpenItemNotFullyRestoredError('Failed to mark payment open item REVERSED')
        }

        await tx.accountingVoucher.update({
          where: { id: originalVoucher.id, tenantId: postCtx.tenantId },
          data: {
            status: 'REVERSED',
            reversedByVoucherId: voucherId,
            reversedAt: new Date(),
            reversedBy: postCtx.userId ?? null,
            reversalReason: input.reason,
          },
        })
        await tx.accountingVoucher.update({
          where: { id: voucherId, tenantId: postCtx.tenantId },
          data: { reversalOfVoucherId: originalVoucher.id, reversalReason: input.reason },
        })

        const updated = await tx.vendorInvoice.updateMany({
          where: { id: invoice.id, tenantId: postCtx.tenantId, status: 'POSTED' },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
            reversedBy: postCtx.userId ?? null,
            reversalReason: input.reason,
            reversalDate: reversalDateValue,
            reversalVoucherId: voucherId,
            reversalPostingEventId: eventId,
            updatedBy: postCtx.userId ?? null,
          },
        })
        if (updated.count !== 1) {
          throw new VendorInvoiceReversalEligibilityError('Payment changed concurrently during reversal')
        }
        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await prisma.vendorInvoice.findFirstOrThrow({
        where: { id: invoice.id, tenantId: context.tenantId },
      })
      return {
        idempotentReplay: true,
        vendorInvoiceId: invoice.id,
        vendorInvoiceNumber: refreshed.vendorInvoiceNumber,
        status: 'REVERSED',
        reversalVoucherId: refreshed.reversalVoucherId ?? posting.voucherId,
        reversalVoucherNumber: posting.voucherNumber,
        reversalPostingEventId: refreshed.reversalPostingEventId,
        posting,
        allocationReversals,
      }
    }

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_invoice',
      entityId: invoice.id,
      action: 'VENDOR_INVOICE_REVERSED',
      newValues: {
        reversalVoucherId: posting.voucherId,
        reversalVoucherNumber: posting.voucherNumber,
        originalVoucherId: originalVoucher.id,
        reason: input.reason,
        allocationReversals,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return {
      idempotentReplay: false,
      vendorInvoiceId: invoice.id,
      vendorInvoiceNumber: invoice.vendorInvoiceNumber,
      status: 'REVERSED',
      reversalVoucherId: reversalVoucherId ?? posting.voucherId,
      reversalVoucherNumber: posting.voucherNumber,
      reversalPostingEventId: posting.postingEventId ?? null,
      posting,
      allocationReversals,
    }
  } catch (error) {
    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_invoice',
      entityId: invoice.id,
      action: 'VENDOR_INVOICE_REVERSAL_FAILED',
      newValues: { reason: input.reason, message: error instanceof Error ? error.message : 'unknown' },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    }).catch(() => {})
    mapPostingErrorToVendorInvoiceReversalError(error)
  }
}
