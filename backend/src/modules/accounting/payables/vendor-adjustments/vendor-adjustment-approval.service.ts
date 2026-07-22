import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { recalculateVendorAdjustment } from './vendor-adjustment-draft.service.js'
import * as repo from './vendor-adjustment.repository.js'
import { VendorAdjustmentApprovalRequiredError, VendorAdjustmentInvalidStatusError, VendorAdjustmentStaleVersionError } from './vendor-adjustment.errors.js'
import type { ApproveVendorAdjustmentInput, RejectVendorAdjustmentInput } from './vendor-adjustment.schemas.js'
import type { VendorAdjustmentWithLines } from './vendor-adjustment.types.js'
import { serializeVendorAdjustment } from './vendor-adjustment-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_adjustment',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function assertExpectedUpdatedAt(invoice: VendorAdjustmentWithLines, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorAdjustmentStaleVersionError()
}

export async function approveVendorAdjustment(req: Request, tenantId: string, id: string, input: ApproveVendorAdjustmentInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'PENDING_APPROVAL' || !invoice.approvalRequestId) {
    throw new VendorAdjustmentInvalidStatusError('Vendor invoice is not pending approval')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  // Brief revalidation — refresh snapshots only; does not block approval on new warnings.
  const result = await recalculateVendorAdjustment(tenantId, invoice, userId)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: invoice.approvalRequestId!, tenantId, documentType: 'VENDOR_ADJUSTMENT', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new VendorAdjustmentApprovalRequiredError()
    await tx.vendorAdjustment.update({
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

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_APPROVED')
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function rejectVendorAdjustment(req: Request, tenantId: string, id: string, input: RejectVendorAdjustmentInput) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'PENDING_APPROVAL' || !invoice.approvalRequestId) {
    throw new VendorAdjustmentInvalidStatusError('Vendor invoice is not pending approval')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: invoice.approvalRequestId! },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'REJECTED',
        workflowSnapshotJson: { reason: input.reason },
      },
    })
    await tx.vendorAdjustment.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_ADJUSTMENT_REJECTED', { reason: input.reason })
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function getVendorAdjustmentApproval(_req: Request, tenantId: string, id: string) {
  const invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (!invoice.approvalRequestId) {
    return { approvalRequest: null, steps: [] }
  }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({
    where: { id: invoice.approvalRequestId, tenantId },
  })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({
        where: { approvalRequestId: approvalRequest.id, tenantId },
        orderBy: [{ level: 'asc' }, { sequence: 'asc' }],
      })
    : []
  return { approvalRequest, steps }
}
