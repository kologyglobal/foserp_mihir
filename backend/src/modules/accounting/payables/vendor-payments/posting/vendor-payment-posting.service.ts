import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { compare, formatForPersistence } from '../../../shared/finance-decimal.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import * as repo from '../vendor-payment.repository.js'
import { findPayableOpenItemBySourceVendorPayment } from '../../open-items/payable-open-item.repository.js'
import { createVendorPaymentPayableOpenItem, finalizePostedVendorPayment } from '../vendor-payment.repository.js'
import { reserveVendorPaymentNumber } from './vendor-payment-number.service.js'
import { validateVendorPaymentForPosting } from './vendor-payment-posting-validation.service.js'
import { buildVendorPaymentPostEventKey } from './vendor-payment-posting.types.js'
import type {
  PostVendorPaymentContext,
  PostVendorPaymentInput,
  PostVendorPaymentResult,
} from './vendor-payment-posting.types.js'
import {
  mapPostingErrorToVendorPaymentError,
  VendorPaymentAlreadyPostedError,
  VendorPaymentConcurrentPostError,
  VendorPaymentPayableGlMismatchError,
  VendorPaymentPayableOpenItemCreationFailedError,
  VendorPaymentPostingNotAllowedError,
} from './vendor-payment-posting.errors.js'
import { VendorPaymentNotFoundError } from '../vendor-payment.errors.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.ap.payment.post')) {
    throw new VendorPaymentPostingNotAllowedError()
  }
}

async function loadPostedResult(
  tenantId: string,
  vendorPaymentId: string,
  posting: PostVendorPaymentResult['posting'],
  idempotentReplay: boolean,
): Promise<PostVendorPaymentResult> {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, vendorPaymentId)
  if (!payment.vendorPaymentNumber || !payment.accountingVoucherId || !payment.postingEventId) {
    throw new VendorPaymentAlreadyPostedError('Posted vendor payment is missing accounting links')
  }

  const openItem = await findPayableOpenItemBySourceVendorPayment(
    tenantId,
    payment.legalEntityId,
    vendorPaymentId,
  )
  if (!openItem) {
    throw new Error('Payable open item missing after successful post')
  }

  return {
    idempotentReplay,
    vendorPaymentId: payment.id,
    draftReference: payment.draftReference,
    vendorPaymentNumber: payment.vendorPaymentNumber,
    status: 'POSTED',
    accountingVoucherId: payment.accountingVoucherId,
    accountingVoucherNumber: posting.voucherNumber,
    postingEventId: payment.postingEventId,
    payableOpenItemId: openItem.id,
    payableOpenItemSide: 'DEBIT',
    payableOpenItemDocumentType: openItem.documentType as 'VENDOR_PAYMENT' | 'VENDOR_ADVANCE',
    vendorId: payment.vendorId,
    vendorCode: payment.vendorCodeSnapshot,
    vendorName: payment.vendorNameSnapshot,
    paymentPurpose: payment.paymentPurpose,
    paymentMethod: payment.paymentMethod,
    documentDate: payment.documentDate.toISOString().slice(0, 10),
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    postingDate: (payment.proposedPostingDate ?? payment.paymentDate).toISOString().slice(0, 10),
    currencyCode: payment.currencyCode,
    paymentAmount: formatForPersistence(payment.paymentAmount),
    tdsAmount: formatForPersistence(payment.tdsAmount),
    settlementAdjustmentAmount: formatForPersistence(payment.settlementAdjustmentAmount),
    vendorSettlementAmount: formatForPersistence(payment.vendorSettlementAmount),
    cashOutflowAmount: formatForPersistence(payment.cashOutflowAmount),
    payableOutstandingAmount: formatForPersistence(openItem.outstandingAmount),
    ledgerEntryCount: posting.ledgerEntryCount,
    posting,
  }
}

export async function postVendorPaymentFromRequest(
  req: Request,
  tenantId: string,
  vendorPaymentId: string,
  body: { expectedUpdatedAt: string },
): Promise<PostVendorPaymentResult> {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const audit = auditFromRequest(req)
  return postVendorPayment(
    {
      vendorPaymentId,
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

export async function postVendorPayment(
  input: PostVendorPaymentInput,
  context: PostVendorPaymentContext,
): Promise<PostVendorPaymentResult> {
  let existingPayment
  try {
    existingPayment = await repo.findVendorPaymentWithLinesOrThrow(context.tenantId, input.vendorPaymentId)
  } catch {
    throw new VendorPaymentNotFoundError()
  }

  if (existingPayment.status === 'POSTED') {
    if (!existingPayment.accountingVoucherId || !existingPayment.postingEventId) {
      throw new VendorPaymentAlreadyPostedError()
    }
    const posting = await buildPostedResult(
      context.tenantId,
      existingPayment.postingEventId,
      existingPayment.accountingVoucherId,
      true,
    )
    return loadPostedResult(context.tenantId, input.vendorPaymentId, posting, true)
  }

  const validated = await validateVendorPaymentForPosting(
    context.tenantId,
    input.vendorPaymentId,
    input.expectedUpdatedAt,
  )
  const { payment, postingRequest, context: postingCtx } = validated

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
        await reserveVendorPaymentNumber(
          context.tenantId,
          payment.legalEntityId,
          postingCtx.financialYearId,
          event,
        )
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId, voucherNumber, validated: postingValidated }) => {
        const event = await tx.postingEvent.findFirstOrThrow({
          where: { id: eventId, tenantId: txContext.tenantId },
        })
        const vendorPaymentNumber = event.reservedSourceDocumentNumber
        if (!vendorPaymentNumber) {
          throw new VendorPaymentConcurrentPostError()
        }

        await tx.accountingVoucher.update({
          where: { id: voucherId },
          data: { referenceNumber: vendorPaymentNumber },
        })

        // GL invariant — vendor payable DEBIT total = vendorSettlementAmount.
        const vendorPayableDebit = postingValidated.resolvedLines.find(
          (line) =>
            line.accountId === postingCtx.vendorPayableAccountId &&
            compare(line.debitAmount, '0') > 0,
        )
        if (
          !vendorPayableDebit ||
          compare(vendorPayableDebit.debitAmount, payment.vendorSettlementAmount) !== 0 ||
          compare(vendorPayableDebit.baseDebitAmount, payment.baseVendorSettlementAmount) !== 0
        ) {
          throw new VendorPaymentPayableGlMismatchError()
        }

        let openItem
        try {
          openItem = await createVendorPaymentPayableOpenItem(tx, {
            tenantId: txContext.tenantId,
            legalEntityId: payment.legalEntityId,
            branchId: payment.branchId,
            vendorId: payment.vendorId,
            vendorCodeSnapshot: payment.vendorCodeSnapshot,
            vendorNameSnapshot: payment.vendorNameSnapshot,
            paymentPurpose: payment.paymentPurpose,
            documentId: payment.id,
            documentNumber: vendorPaymentNumber,
            documentDate: payment.documentDate,
            postingDate: payment.proposedPostingDate ?? payment.paymentDate,
            dueDate: payment.dueReferenceDate,
            currencyCode: payment.currencyCode,
            exchangeRate: payment.exchangeRate,
            originalAmount: payment.vendorSettlementAmount,
            baseOriginalAmount: payment.baseVendorSettlementAmount,
            vendorPayableAccountId: postingCtx.vendorPayableAccountId,
            sourceVendorPaymentId: payment.id,
            accountingVoucherId: voucherId,
            postingEventId: eventId,
            createdBy: txContext.userId ?? null,
          })
        } catch {
          throw new VendorPaymentPayableOpenItemCreationFailedError()
        }
        openItemId = openItem.id

        const updated = await finalizePostedVendorPayment(tx, {
          tenantId: txContext.tenantId,
          vendorPaymentId: payment.id,
          expectedUpdatedAt: postingCtx.expectedUpdatedAt,
          vendorPaymentNumber,
          accountingVoucherId: voucherId,
          postingEventId: eventId,
          payableOpenItemId: openItem.id,
          postedById: txContext.userId ?? null,
          financialYearId: postingCtx.financialYearId,
        })

        if (updated.count !== 1) {
          throw new VendorPaymentConcurrentPostError()
        }

        void voucherNumber
      },
    })

    if (posting.idempotentReplay) {
      return loadPostedResult(context.tenantId, input.vendorPaymentId, posting, true)
    }

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'vendor_payment',
      entityId: input.vendorPaymentId,
      action: 'VENDOR_PAYMENT_POSTED',
      newValues: {
        vendorPaymentNumber: (await prisma.vendorPayment.findFirst({
          where: { id: input.vendorPaymentId, tenantId: context.tenantId },
          select: { vendorPaymentNumber: true },
        }))?.vendorPaymentNumber,
        draftReference: payment.draftReference,
        vendorId: payment.vendorId,
        paymentPurpose: payment.paymentPurpose,
        paymentMethod: payment.paymentMethod,
        documentDate: payment.documentDate.toISOString().slice(0, 10),
        postingDate: (payment.proposedPostingDate ?? payment.paymentDate).toISOString().slice(0, 10),
        paymentAmount: formatForPersistence(payment.paymentAmount),
        tdsAmount: formatForPersistence(payment.tdsAmount),
        vendorSettlementAmount: formatForPersistence(payment.vendorSettlementAmount),
        cashOutflowAmount: formatForPersistence(payment.cashOutflowAmount),
        voucherNumber: posting.voucherNumber,
        payableOpenItemId: openItemId,
        postingEventId: posting.postingEventId,
        postedBy: context.userId,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return loadPostedResult(context.tenantId, input.vendorPaymentId, posting, false)
  } catch (error) {
    const eventKey = buildVendorPaymentPostEventKey(input.vendorPaymentId)
    const failedEvent = await prisma.postingEvent.findFirst({
      where: {
        tenantId: context.tenantId,
        legalEntityId: payment.legalEntityId,
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
        entity: 'vendor_payment',
        entityId: input.vendorPaymentId,
        action: 'VENDOR_PAYMENT_POSTING_FAILED',
        newValues: {
          vendorPaymentId: input.vendorPaymentId,
          draftReference: payment.draftReference,
          failureCode: failedEvent.errorCode,
          attemptNumber: failedEvent.attemptCount,
          postingEventId: failedEvent.id,
          userId: context.userId,
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      }).catch(() => {})
    }
    mapPostingErrorToVendorPaymentError(error)
  }
}

export async function canPostVendorPayment(req: Request, status: string): Promise<boolean> {
  if (status !== 'READY_TO_POST') return false
  return hasPerm(req, 'finance.ap.payment.post')
}

/** Narrow type re-export for repository tx helpers. */
export type VendorPaymentPostingTx = Prisma.TransactionClient
