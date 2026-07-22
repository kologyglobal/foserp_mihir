import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { recalculateVendorPayment } from './vendor-payment-draft.service.js'
import * as repo from './vendor-payment.repository.js'
import {
  VendorPaymentApprovalRequiredError,
  VendorPaymentInvalidStatusError,
  VendorPaymentStaleVersionError,
} from './vendor-payment.errors.js'
import type { ApproveVendorPaymentInput, RejectVendorPaymentInput } from './vendor-payment.schemas.js'
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

export async function approveVendorPayment(req: Request, tenantId: string, id: string, input: ApproveVendorPaymentInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (payment.status !== 'PENDING_APPROVAL' || !payment.approvalRequestId) {
    throw new VendorPaymentInvalidStatusError('Vendor payment is not pending approval')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  // Brief revalidation — refresh snapshots only; does not block approval on new warnings.
  const result = await recalculateVendorPayment(tenantId, payment, userId)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: payment.approvalRequestId!, tenantId, documentType: 'VENDOR_PAYMENT', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new VendorPaymentApprovalRequiredError()
    await tx.vendorPayment.update({
      where: { id, tenantId },
      data: {
        status: 'READY_TO_POST',
        approvedAt: new Date(),
        approvedBy: userId,
        readyToPostAt: new Date(),
        readyToPostBy: userId,
        updatedBy: userId,
      },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_APPROVED')
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function rejectVendorPayment(req: Request, tenantId: string, id: string, input: RejectVendorPaymentInput) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (payment.status !== 'PENDING_APPROVAL' || !payment.approvalRequestId) {
    throw new VendorPaymentInvalidStatusError('Vendor payment is not pending approval')
  }
  assertExpectedUpdatedAt(payment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: payment.approvalRequestId! },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'REJECTED',
        workflowSnapshotJson: { reason: input.reason },
      },
    })
    await tx.vendorPayment.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_REJECTED', { reason: input.reason })
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function getVendorPaymentApproval(_req: Request, tenantId: string, id: string) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (!payment.approvalRequestId) {
    return { approvalRequest: null, steps: [] }
  }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({
    where: { id: payment.approvalRequestId, tenantId },
  })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({
        where: { approvalRequestId: approvalRequest.id, tenantId },
        orderBy: [{ level: 'asc' }, { sequence: 'asc' }],
      })
    : []
  return { approvalRequest, steps }
}
