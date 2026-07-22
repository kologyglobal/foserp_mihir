import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine, PayableAllocationLine, VendorPayment } from '@prisma/client'
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
import { VendorPaymentNotFoundError, VendorPaymentStaleVersionError } from '../vendor-payment.errors.js'
import {
  VendorPaymentActiveAllocationsExistError,
  VendorPaymentOpenItemNotFullyRestoredError,
  VendorPaymentOriginalPostingEventMissingError,
  VendorPaymentOriginalVoucherMissingError,
  VendorPaymentReversalDateInvalidError,
  VendorPaymentReversalEligibilityError,
  VendorPaymentReversalFailedError,
  VendorPaymentReversalNotAllowedError,
  VendorPaymentReversalNotPostedError,
  mapPostingErrorToVendorPaymentReversalError,
} from './vendor-payment-posting.errors.js'
import { buildVendorPaymentReverseEventKey } from './vendor-payment-posting.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPaymentReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.ap.payment.reverse')) {
    throw new VendorPaymentReversalNotAllowedError()
  }
}

export interface ReverseVendorPaymentInput {
  vendorPaymentId: string
  reversalDate: string
  reason: string
  idempotencyKey: string
  expectedUpdatedAt: string
  cascadeAllocationReversals?: boolean
}

export interface ReverseVendorPaymentResult {
  idempotentReplay: boolean
  vendorPaymentId: string
  vendorPaymentNumber: string | null
  status: 'REVERSED'
  reversalVoucherId: string
  reversalVoucherNumber: string | null
  reversalPostingEventId: string | null
  posting: PostingResult
  allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }>
}

export interface VendorPaymentReversalPreview {
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
  payment: VendorPayment,
  reason: string,
  reversalDate: string,
): PostingRequest {
  const currencyCode = originalVoucher.currencyCode
  const exchangeRate = originalVoucher.exchangeRate.toString()
  const documentDate = originalVoucher.documentDate.toISOString().slice(0, 10)
  const sourceNumber = payment.vendorPaymentNumber ?? payment.draftReference

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
    eventKey: buildVendorPaymentReverseEventKey(payment.id),
    eventType: 'VENDOR_PAYMENT_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate: reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of Vendor Payment ${sourceNumber}\nReason: ${reason}`.slice(0, 500),
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'VENDOR_PAYMENT',
    sourceDocumentId: payment.id,
    lines: reversalLines,
  }
}

async function cascadeReverseActiveAllocations(args: {
  tx: Parameters<NonNullable<import('../../../posting/posting.types.js').PostingOptions['beforeAccounting']>>[0]['tx']
  tenantId: string
  userId: string
  paymentId: string
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
    'DEBIT',
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
    const idempotencyKey = `CASCADE:${args.paymentId}:${batchId}:${args.eventKey}`
    const payloadHash = hashPayload({
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      allocationBatchId: batchId,
      lineIds: lines.map((l) => l.id).sort(),
      reversalDate: args.reversalDate.toISOString().slice(0, 10),
      reason: args.reason,
      cascade: true,
      sourceDocumentId: args.paymentId,
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

export async function getVendorPaymentReversalPreview(
  req: Request,
  tenantId: string,
  vendorPaymentId: string,
): Promise<VendorPaymentReversalPreview> {
  const payment = await prisma.vendorPayment.findFirst({ where: { id: vendorPaymentId, tenantId } })
  if (!payment) throw new VendorPaymentNotFoundError()

  const blockingIssues: string[] = []
  const canReverse = hasPerm(req, 'finance.ap.payment.reverse')
  if (!canReverse) blockingIssues.push('Missing permission finance.ap.payment.reverse')
  if (payment.status === 'REVERSED') blockingIssues.push('Payment already reversed')
  if (payment.status !== 'POSTED') blockingIssues.push('Payment must be POSTED')
  if (!payment.accountingVoucherId) blockingIssues.push('Original accounting voucher missing')
  if (!payment.postingEventId) blockingIssues.push('Original posting event missing')
  if (!payment.payableOpenItemId) blockingIssues.push('DEBIT open item missing')

  let activeAllocationCount = 0
  let activeAllocationAmount = '0.0000'
  let requiresAllocationReversal = false
  if (payment.payableOpenItemId) {
    const active = await findActivePayableAllocationLinesForOpenItem(
      tenantId,
      payment.legalEntityId,
      payment.payableOpenItemId,
      'DEBIT',
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

  let proposedReversalSummary: VendorPaymentReversalPreview['proposedReversalSummary'] = null
  let originalVoucherNumber: string | null = null
  if (payment.accountingVoucherId) {
    const voucher = await prisma.accountingVoucher.findFirst({
      where: { id: payment.accountingVoucherId, tenantId },
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

  const openItem = payment.payableOpenItemId
    ? await prisma.payableOpenItem.findFirst({ where: { id: payment.payableOpenItemId, tenantId } })
    : null

  const eligible =
    canReverse &&
    payment.status === 'POSTED' &&
    !!payment.accountingVoucherId &&
    !!payment.payableOpenItemId &&
    !requiresAllocationReversal

  return {
    eligible,
    requiresAllocationReversal,
    activeAllocationCount,
    activeAllocationAmount,
    blockingIssues,
    allowedActions: {
      reverse: eligible,
      reverseWithCascade: canReverse && payment.status === 'POSTED' && !!payment.accountingVoucherId,
    },
    originalVoucherId: payment.accountingVoucherId,
    originalVoucherNumber,
    openItemId: payment.payableOpenItemId,
    openItemStatus: openItem?.status ?? null,
    proposedReversalSummary,
  }
}

export async function reverseVendorPaymentFromRequest(
  req: Request,
  tenantId: string,
  vendorPaymentId: string,
  body: {
    reversalDate: string
    reason: string
    idempotencyKey: string
    expectedUpdatedAt: string
    cascadeAllocationReversals?: boolean
  },
): Promise<ReverseVendorPaymentResult> {
  assertPaymentReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  return reverseVendorPayment(
    {
      vendorPaymentId,
      reversalDate: body.reversalDate,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      expectedUpdatedAt: body.expectedUpdatedAt,
      cascadeAllocationReversals: body.cascadeAllocationReversals ?? false,
    },
    { tenantId, userId, ipAddress: audit.ipAddress, userAgent: audit.userAgent },
  )
}

export async function reverseVendorPayment(
  input: ReverseVendorPaymentInput,
  context: { tenantId: string; userId: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<ReverseVendorPaymentResult> {
  const payment = await prisma.vendorPayment.findFirst({
    where: { id: input.vendorPaymentId, tenantId: context.tenantId },
  })
  if (!payment) throw new VendorPaymentNotFoundError()

  if (payment.status === 'REVERSED') {
    if (!payment.reversalVoucherId) {
      throw new VendorPaymentReversalFailedError('Payment is reversed but missing reversal voucher')
    }
    const posting = await buildPostedResult(context.tenantId, '', payment.reversalVoucherId, true)
    return {
      idempotentReplay: true,
      vendorPaymentId: payment.id,
      vendorPaymentNumber: payment.vendorPaymentNumber,
      status: 'REVERSED',
      reversalVoucherId: payment.reversalVoucherId,
      reversalVoucherNumber: posting.voucherNumber,
      reversalPostingEventId: payment.reversalPostingEventId,
      posting,
      allocationReversals: [],
    }
  }

  if (payment.status !== 'POSTED' || !payment.accountingVoucherId) {
    throw new VendorPaymentReversalNotPostedError()
  }
  if (!payment.postingEventId) throw new VendorPaymentOriginalPostingEventMissingError()
  if (!payment.payableOpenItemId) {
    throw new VendorPaymentReversalEligibilityError('Posted payment is missing DEBIT open item')
  }
  if (payment.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new VendorPaymentStaleVersionError()
  }

  const reversalDateValue = parseDateOnly(input.reversalDate)
  if (payment.postedAt && reversalDateValue < parseDateOnly(payment.postedAt.toISOString().slice(0, 10))) {
    // allow same calendar day as posting date via postingDate field when available
  }
  const originalVoucher = await prisma.accountingVoucher.findFirst({
    where: { id: payment.accountingVoucherId, tenantId: context.tenantId },
  })
  if (!originalVoucher) throw new VendorPaymentOriginalVoucherMissingError()
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new VendorPaymentReversalEligibilityError('Original voucher has already been reversed or is not posted')
  }
  if (reversalDateValue < parseDateOnly(originalVoucher.postingDate.toISOString().slice(0, 10))) {
    throw new VendorPaymentReversalDateInvalidError('Reversal date must not precede original posting date')
  }

  const active = await findActivePayableAllocationLinesForOpenItem(
    context.tenantId,
    payment.legalEntityId,
    payment.payableOpenItemId,
    'DEBIT',
  )
  if (active.length > 0 && !input.cascadeAllocationReversals) {
    throw new VendorPaymentActiveAllocationsExistError(
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
    payment,
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
      entity: 'vendor_payment',
      entityId: payment.id,
      action: 'VENDOR_PAYMENT_REVERSAL_STARTED',
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
            paymentId: payment.id,
            openItemId: payment.payableOpenItemId!,
            legalEntityId: payment.legalEntityId,
            reversalDate: reversalDateValue,
            reason: input.reason,
            eventKey: postingRequest.eventKey,
          })
        }

        const openItem = await tx.payableOpenItem.findFirstOrThrow({
          where: { id: payment.payableOpenItemId!, tenantId: context.tenantId },
        })
        if (!isZero(openItem.allocatedAmount) || !toDecimal(openItem.outstandingAmount).eq(openItem.originalAmount)) {
          throw new VendorPaymentOpenItemNotFullyRestoredError()
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
          throw new VendorPaymentReversalEligibilityError(
            eligibility.errors.map((e) => e.message).join('; '),
          )
        }

        const closed = await tx.payableOpenItem.updateMany({
          where: {
            id: payment.payableOpenItemId!,
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
          throw new VendorPaymentOpenItemNotFullyRestoredError('Failed to mark payment open item REVERSED')
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

        const updated = await tx.vendorPayment.updateMany({
          where: { id: payment.id, tenantId: postCtx.tenantId, status: 'POSTED' },
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
          throw new VendorPaymentReversalEligibilityError('Payment changed concurrently during reversal')
        }
        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await prisma.vendorPayment.findFirstOrThrow({
        where: { id: payment.id, tenantId: context.tenantId },
      })
      return {
        idempotentReplay: true,
        vendorPaymentId: payment.id,
        vendorPaymentNumber: refreshed.vendorPaymentNumber,
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
      entity: 'vendor_payment',
      entityId: payment.id,
      action: 'VENDOR_PAYMENT_REVERSED',
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
      vendorPaymentId: payment.id,
      vendorPaymentNumber: payment.vendorPaymentNumber,
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
      entity: 'vendor_payment',
      entityId: payment.id,
      action: 'VENDOR_PAYMENT_REVERSAL_FAILED',
      newValues: { reason: input.reason, message: error instanceof Error ? error.message : 'unknown' },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    }).catch(() => {})
    mapPostingErrorToVendorPaymentReversalError(error)
  }
}
