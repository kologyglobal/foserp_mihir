import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import * as repo from '../vendor-adjustment.repository.js'
import { findPayableOpenItemBySourceVendorAdjustment } from '../../open-items/payable-open-item.repository.js'
import { createVendorAdjustmentPayableOpenItem, finalizePostedVendorAdjustment } from '../vendor-adjustment.repository.js'
import { reserveVendorAdjustmentNumber } from './vendor-adjustment-number.service.js'
import { validateVendorAdjustmentForPosting } from './vendor-adjustment-posting-validation.service.js'
import { buildVendorAdjustmentPostEventKey } from './vendor-adjustment-posting.types.js'
import type {
  PostVendorAdjustmentContext,
  PostVendorAdjustmentInput,
  PostVendorAdjustmentResult,
} from './vendor-adjustment-posting.types.js'
import {
  mapPostingErrorToVendorAdjustmentError,
  VendorAdjustmentAlreadyPostedError,
  VendorAdjustmentConcurrentPostError,
  VendorAdjustmentPayableGlMismatchError,
  VendorAdjustmentPayableOpenItemCreationFailedError,
  VendorAdjustmentPostingNotAllowedError,
} from './vendor-adjustment-posting.errors.js'
import { VendorAdjustmentNotFoundError } from '../vendor-adjustment.errors.js'
import { compare } from '../../../shared/finance-decimal.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.ap.adjustment.post')) {
    throw new VendorAdjustmentPostingNotAllowedError()
  }
}

async function loadPostedResult(
  tenantId: string,
  vendorAdjustmentId: string,
  posting: PostVendorAdjustmentResult['posting'],
  idempotentReplay: boolean,
): Promise<PostVendorAdjustmentResult> {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, vendorAdjustmentId)
  if (!invoice.vendorAdjustmentNumber || !invoice.accountingVoucherId || !invoice.postingEventId) {
    throw new VendorAdjustmentAlreadyPostedError('Posted vendor invoice is missing accounting links')
  }

  const openItem = await findPayableOpenItemBySourceVendorAdjustment(
    tenantId,
    invoice.legalEntityId,
    vendorAdjustmentId,
  )
  if (!openItem) {
    throw new Error('Payable open item missing after successful post')
  }

  return {
    idempotentReplay,
    vendorAdjustmentId: invoice.id,
    draftReference: invoice.draftReference,
    vendorAdjustmentNumber: invoice.vendorAdjustmentNumber,
    supplierReferenceNumber: invoice.supplierReferenceNumber,
    status: 'POSTED',
    accountingVoucherId: invoice.accountingVoucherId,
    accountingVoucherNumber: posting.voucherNumber,
    postingEventId: invoice.postingEventId,
    payableOpenItemId: openItem.id,
    vendorId: invoice.vendorId,
    vendorCode: invoice.vendorCodeSnapshot,
    vendorName: invoice.vendorNameSnapshot,
    documentDate: invoice.documentDate.toISOString().slice(0, 10),
    supplierReferenceDate: invoice.supplierReferenceDate.toISOString().slice(0, 10),
    postingDate: (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
    currencyCode: invoice.currencyCode,
    adjustmentGrandTotal: formatForPersistence(invoice.adjustmentGrandTotal),
    tdsAmount: formatForPersistence(invoice.tdsAmount),
    vendorPayableAmount: formatForPersistence(invoice.vendorPayableAmount),
    payableOutstandingAmount: formatForPersistence(openItem.outstandingAmount),
    ledgerEntryCount: posting.ledgerEntryCount,
    posting,
  }
}

export async function postVendorAdjustmentFromRequest(
  req: Request,
  tenantId: string,
  vendorAdjustmentId: string,
  body: { expectedUpdatedAt: string },
): Promise<PostVendorAdjustmentResult> {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const audit = auditFromRequest(req)
  return postVendorAdjustment(
    {
      vendorAdjustmentId,
      expectedUpdatedAt: body.expectedUpdatedAt,
    },
    {
      tenantId,
      userId,
      authorization: { permissionChecked: true },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    },
  )
}

export async function postVendorAdjustment(
  input: PostVendorAdjustmentInput,
  context: PostVendorAdjustmentContext,
): Promise<PostVendorAdjustmentResult> {
  let existingInvoice
  try {
    existingInvoice = await repo.findVendorAdjustmentWithLinesOrThrow(context.tenantId, input.vendorAdjustmentId)
  } catch {
    throw new VendorAdjustmentNotFoundError()
  }

  if (existingInvoice.status === 'POSTED') {
    if (!existingInvoice.accountingVoucherId || !existingInvoice.postingEventId) {
      throw new VendorAdjustmentAlreadyPostedError()
    }
    const posting = await buildPostedResult(
      context.tenantId,
      existingInvoice.postingEventId,
      existingInvoice.accountingVoucherId,
      true,
    )
    return loadPostedResult(context.tenantId, input.vendorAdjustmentId, posting, true)
  }

  const validated = await validateVendorAdjustmentForPosting(
    context.tenantId,
    input.vendorAdjustmentId,
    input.expectedUpdatedAt,
  )
  const { invoice, postingRequest, context: postingCtx } = validated

  const postingContext: PostingContext = {
    tenantId: context.tenantId,
    userId: context.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }

  let openItemId: string | null = null

  try {
    const posting = await post(postingRequest, postingContext, {
      beforeTransaction: async (event) => {
        await reserveVendorAdjustmentNumber(
          context.tenantId,
          invoice.legalEntityId,
          postingCtx.financialYearId,
          invoice.adjustmentType,
          event,
        )
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId, voucherNumber, validated: postingValidated }) => {
        const event = await tx.postingEvent.findFirstOrThrow({
          where: { id: eventId, tenantId: txContext.tenantId },
        })
        const vendorAdjustmentNumber = event.reservedSourceDocumentNumber
        if (!vendorAdjustmentNumber) {
          throw new VendorAdjustmentConcurrentPostError()
        }

        await tx.accountingVoucher.update({
          where: { id: voucherId },
          data: { referenceNumber: vendorAdjustmentNumber },
        })

        const isDebitNote = invoice.adjustmentType === 'VENDOR_DEBIT_NOTE'
        const vendorPayableLine = postingValidated.resolvedLines.find(
          (line) =>
            line.accountId === postingCtx.vendorPayableAccountId &&
            (isDebitNote ? compare(line.debitAmount, '0') > 0 : compare(line.creditAmount, '0') > 0),
        )
        const payableAmount = formatForPersistence(invoice.vendorPayableAmount)
        const basePayableAmount = formatForPersistence(invoice.baseVendorPayableAmount)
        if (
          !vendorPayableLine ||
          compare(isDebitNote ? vendorPayableLine.debitAmount : vendorPayableLine.creditAmount, payableAmount) !== 0 ||
          compare(isDebitNote ? vendorPayableLine.baseDebitAmount : vendorPayableLine.baseCreditAmount, basePayableAmount) !== 0
        ) {
          throw new VendorAdjustmentPayableGlMismatchError()
        }

        let openItem
        try {
          openItem = await createVendorAdjustmentPayableOpenItem(tx, {
            tenantId: txContext.tenantId,
            legalEntityId: invoice.legalEntityId,
            branchId: invoice.branchId,
            vendorId: invoice.vendorId,
            vendorCodeSnapshot: invoice.vendorCodeSnapshot,
            vendorNameSnapshot: invoice.vendorNameSnapshot,
            documentId: invoice.id,
            documentNumber: vendorAdjustmentNumber,
            documentDate: invoice.documentDate,
            postingDate: invoice.postingDate ?? invoice.documentDate,
            dueDate: invoice.dueDate,
            currencyCode: invoice.currencyCode,
            exchangeRate: invoice.exchangeRate,
            originalAmount: invoice.vendorPayableAmount,
            outstandingAmount: invoice.vendorPayableAmount,
            baseOriginalAmount: invoice.baseVendorPayableAmount,
            baseOutstandingAmount: invoice.baseVendorPayableAmount,
            vendorPayableAccountId: postingCtx.vendorPayableAccountId,
            sourceVendorAdjustmentId: invoice.id,
            side: isDebitNote ? 'DEBIT' : 'CREDIT',
            documentType: isDebitNote ? 'VENDOR_DEBIT_NOTE' : 'VENDOR_CREDIT_ADJUSTMENT',
            accountingVoucherId: voucherId,
            postingEventId: eventId,
            createdBy: txContext.userId ?? null,
          })
        } catch {
          throw new VendorAdjustmentPayableOpenItemCreationFailedError()
        }
        openItemId = openItem.id

        const updated = await finalizePostedVendorAdjustment(tx, {
          tenantId: txContext.tenantId,
          vendorAdjustmentId: invoice.id,
          expectedUpdatedAt: postingCtx.expectedUpdatedAt,
          vendorAdjustmentNumber,
          accountingVoucherId: voucherId,
          postingEventId: eventId,
          postedById: txContext.userId ?? null,
          financialYearId: postingCtx.financialYearId,
        })

        if (updated.count !== 1) {
          throw new VendorAdjustmentConcurrentPostError()
        }

        void voucherNumber
      },
    })

    if (posting.idempotentReplay) {
      return loadPostedResult(context.tenantId, input.vendorAdjustmentId, posting, true)
    }

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_adjustment',
      entityId: input.vendorAdjustmentId,
      action: 'VENDOR_ADJUSTMENT_POSTED',
      newValues: {
        vendorAdjustmentNumber: (await prisma.vendorAdjustment.findFirst({
          where: { id: input.vendorAdjustmentId, tenantId: context.tenantId },
          select: { vendorAdjustmentNumber: true },
        }))?.vendorAdjustmentNumber,
        draftReference: invoice.draftReference,
        supplierReferenceNumber: invoice.supplierReferenceNumber,
        vendorId: invoice.vendorId,
        adjustmentType: invoice.adjustmentType,
        documentDate: invoice.documentDate.toISOString().slice(0, 10),
        postingDate: (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10),
        adjustmentGrandTotal: formatForPersistence(invoice.adjustmentGrandTotal),
        tdsAmount: formatForPersistence(invoice.tdsAmount),
        vendorPayableAmount: formatForPersistence(invoice.vendorPayableAmount),
        voucherNumber: posting.voucherNumber,
        payableOpenItemId: openItemId,
        postingEventId: posting.postingEventId,
        postedBy: context.userId,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return loadPostedResult(context.tenantId, input.vendorAdjustmentId, posting, false)
  } catch (error) {
    const eventKey = buildVendorAdjustmentPostEventKey(input.vendorAdjustmentId)
    const failedEvent = await prisma.postingEvent.findFirst({
      where: {
        tenantId: context.tenantId,
        legalEntityId: invoice.legalEntityId,
        eventKey,
        status: 'FAILED',
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (failedEvent) {
      await createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        module: 'finance',
        entity: 'vendor_adjustment',
        entityId: input.vendorAdjustmentId,
        action: 'VENDOR_ADJUSTMENT_POSTING_FAILED',
        newValues: {
          vendorAdjustmentId: input.vendorAdjustmentId,
          draftReference: invoice.draftReference,
          supplierReferenceNumber: invoice.supplierReferenceNumber,
          failureCode: failedEvent.errorCode,
          attemptNumber: failedEvent.attemptCount,
          postingEventId: failedEvent.id,
          userId: context.userId,
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      }).catch(() => {})
    }
    mapPostingErrorToVendorAdjustmentError(error)
  }
}

export async function canPostVendorAdjustment(req: Request, status: string): Promise<boolean> {
  if (status !== 'READY_TO_POST') return false
  return hasPerm(req, 'finance.ap.adjustment.post')
}

/** Narrow type re-export for repository tx helpers. */
export type VendorAdjustmentPostingTx = Prisma.TransactionClient
