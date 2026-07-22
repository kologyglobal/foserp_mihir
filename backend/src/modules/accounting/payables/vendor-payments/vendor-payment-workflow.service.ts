import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { resolvePaymentUniquenessKey } from './vendor-payment-reference-normalization.js'
import { recalculateVendorPayment } from './vendor-payment-draft.service.js'
import * as repo from './vendor-payment.repository.js'
import {
  VendorPaymentDuplicateUniquenessKeyError,
  VendorPaymentInvalidStatusError,
  VendorPaymentNotReadyError,
  VendorPaymentStaleVersionError,
} from './vendor-payment.errors.js'
import type {
  CancelVendorPaymentInput,
  MarkVendorPaymentReadyInput,
  ReviseVendorPaymentInput,
  SubmitVendorPaymentInput,
} from './vendor-payment.schemas.js'
import type { VendorPaymentWithLines } from './vendor-payment.types.js'
import { serializeVendorPayment } from './vendor-payment-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_payment',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function assertExpectedUpdatedAt(payment: VendorPaymentWithLines, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (payment.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorPaymentStaleVersionError()
}

/**
 * Phase 4B3 — claim `paymentUniquenessKey`; the DB `@unique` column enforces the conflict.
 * Returns null (no claim) for methods that carry no external reference (e.g. CASH).
 */
export async function claimUniquenessKey(
  tx: Prisma.TransactionClient,
  payment: VendorPaymentWithLines,
): Promise<string | null> {
  const key = resolvePaymentUniquenessKey({
    tenantId: payment.tenantId,
    legalEntityId: payment.legalEntityId,
    payment,
  })
  if (!key) return null
  try {
    await tx.vendorPayment.update({ where: { id: payment.id }, data: { paymentUniquenessKey: key } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorPaymentDuplicateUniquenessKeyError()
    }
    throw err
  }
  return key
}

export async function releaseUniquenessKey(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  await tx.vendorPayment.update({ where: { id: paymentId }, data: { paymentUniquenessKey: null } })
}

async function assertReadyForWorkflow(tenantId: string, payment: VendorPaymentWithLines, userId?: string | null) {
  const result = await recalculateVendorPayment(tenantId, payment, userId)
  if (!result.validation.isValid) {
    throw new VendorPaymentNotReadyError(
      result.validation.errors[0]?.message ?? 'Vendor payment failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'payment', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, payment.id, result, userId)
  return result
}

export async function submitVendorPayment(req: Request, tenantId: string, id: string, input: SubmitVendorPaymentInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (payment.status !== 'DRAFT' || !payment.approvalRequired) {
    throw new VendorPaymentInvalidStatusError('Only approval-required draft vendor payments can be submitted')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, payment, userId)

  const cycleNumber = (await prisma.financeApprovalRequest.count({
    where: { tenantId, legalEntityId: payment.legalEntityId, documentType: 'VENDOR_PAYMENT', documentId: id },
  })) + 1

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, payment)
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: payment.legalEntityId,
        documentType: 'VENDOR_PAYMENT',
        documentId: id,
        documentNumberSnapshot: payment.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: payment.baseCashOutflowAmount,
        currencyCode: payment.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.vendorPayment.update({
      where: { id, tenantId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: approval.id,
        submittedAt: new Date(),
        submittedBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_SUBMITTED')
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function markVendorPaymentReady(req: Request, tenantId: string, id: string, input: MarkVendorPaymentReadyInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (payment.status !== 'DRAFT' || payment.approvalRequired) {
    throw new VendorPaymentInvalidStatusError('Only non-approval draft vendor payments can be marked ready to post')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, payment, userId)

  await prisma.$transaction(async (tx) => {
    await claimUniquenessKey(tx, payment)
    await tx.vendorPayment.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', readyToPostAt: new Date(), readyToPostBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_READY_TO_POST')
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function reviseVendorPayment(req: Request, tenantId: string, id: string, input: ReviseVendorPaymentInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(payment.status)) {
    throw new VendorPaymentInvalidStatusError('Only rejected or ready-to-post vendor payments can be revised')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.vendorPayment.update({
    where: { id, tenantId },
    data: {
      status: 'DRAFT',
      readyToPostAt: null,
      readyToPostBy: null,
      rejectedAt: null,
      rejectedBy: null,
      approvalRequestId: null,
      updatedBy: userId,
    },
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_REVISED', { reason: input.reason })
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function cancelVendorPayment(req: Request, tenantId: string, id: string, input: CancelVendorPaymentInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(payment.status)) {
    throw new VendorPaymentInvalidStatusError('Vendor payment cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (payment.status === 'PENDING_APPROVAL' && payment.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: payment.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await releaseUniquenessKey(tx, id)
    await tx.vendorPayment.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_CANCELLED', { reason: input.reason })
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}
