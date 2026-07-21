import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { previewNextNumber } from '../../finance-number-series/finance-number-series.repository.js'
import { CustomerCreditNoteApprovalRequiredError, CustomerCreditNoteInvalidStatusError } from './customer-credit-note.errors.js'
import * as repo from './customer-credit-note.repository.js'
import { serializeCustomerCreditNote } from './customer-credit-note-read.service.js'

export async function approveCustomerCreditNote(req: Request, tenantId: string, id: string, comments?: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (note.status !== 'PENDING_APPROVAL' || !note.approvalRequestId) {
    throw new CustomerCreditNoteInvalidStatusError('Credit note is not pending approval')
  }
  await previewNextNumber(tenantId, note.legalEntityId, 'CUSTOMER_CREDIT_NOTE')
  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: note.approvalRequestId!, tenantId, documentType: 'CREDIT_NOTE', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED', completedAt: new Date(), completedBy: req.context?.userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: comments ? { comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new CustomerCreditNoteApprovalRequiredError()
    await tx.customerCreditNote.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', updatedBy: req.context?.userId },
    })
  })
  return serializeCustomerCreditNote(req, await repo.findWithLinesOrThrow(tenantId, id))
}

export async function rejectCustomerCreditNote(req: Request, tenantId: string, id: string, comments?: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (note.status !== 'PENDING_APPROVAL' || !note.approvalRequestId) {
    throw new CustomerCreditNoteInvalidStatusError('Credit note is not pending approval')
  }
  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: note.approvalRequestId!, tenantId },
      data: {
        status: 'REJECTED', completedAt: new Date(), completedBy: req.context?.userId,
        documentStatusSnapshot: 'REJECTED', workflowSnapshotJson: comments ? { comments } : undefined,
      },
    })
    await tx.customerCreditNote.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', updatedBy: req.context?.userId },
    })
  })
  return serializeCustomerCreditNote(req, await repo.findWithLinesOrThrow(tenantId, id))
}
