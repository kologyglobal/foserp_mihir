import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { recalculateVendorInvoice } from './vendor-invoice-draft.service.js'
import * as repo from './vendor-invoice.repository.js'
import { VendorInvoiceApprovalRequiredError, VendorInvoiceInvalidStatusError, VendorInvoiceStaleVersionError } from './vendor-invoice.errors.js'
import type { ApproveVendorInvoiceInput, RejectVendorInvoiceInput } from './vendor-invoice.schemas.js'
import type { VendorInvoiceWithLines } from './vendor-invoice.types.js'
import { serializeVendorInvoice } from './vendor-invoice-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_invoice',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function assertExpectedUpdatedAt(invoice: VendorInvoiceWithLines, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorInvoiceStaleVersionError()
}

export async function approveVendorInvoice(req: Request, tenantId: string, id: string, input: ApproveVendorInvoiceInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'PENDING_APPROVAL' || !invoice.approvalRequestId) {
    throw new VendorInvoiceInvalidStatusError('Vendor invoice is not pending approval')
  }
  assertExpectedUpdatedAt(invoice, input.expectedUpdatedAt)
  const userId = req.context?.userId

  // Brief revalidation — refresh snapshots only; does not block approval on new warnings.
  const result = await recalculateVendorInvoice(tenantId, invoice, userId)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: invoice.approvalRequestId!, tenantId, documentType: 'VENDOR_INVOICE', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new VendorInvoiceApprovalRequiredError()
    await tx.vendorInvoice.update({
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

  await audit(req, tenantId, id, 'VENDOR_INVOICE_APPROVED')
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}

export async function rejectVendorInvoice(req: Request, tenantId: string, id: string, input: RejectVendorInvoiceInput) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  if (invoice.status !== 'PENDING_APPROVAL' || !invoice.approvalRequestId) {
    throw new VendorInvoiceInvalidStatusError('Vendor invoice is not pending approval')
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
    await tx.vendorInvoice.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedBy: userId, updatedBy: userId },
    })
  })

  await audit(req, tenantId, id, 'VENDOR_INVOICE_REJECTED', { reason: input.reason })
  return serializeVendorInvoice(req, await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id))
}

export async function getVendorInvoiceApproval(_req: Request, tenantId: string, id: string) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
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
