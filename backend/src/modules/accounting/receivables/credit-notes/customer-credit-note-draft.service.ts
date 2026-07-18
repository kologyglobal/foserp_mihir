import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { createAuditLog, auditFromRequest } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { previewNextNumber } from '../../finance-number-series/finance-number-series.repository.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import type { CreateCustomerCreditNoteInput, UpdateCustomerCreditNoteInput } from './customer-credit-note.schemas.js'
import * as repo from './customer-credit-note.repository.js'
import { calculateAndValidateCreditNote } from './customer-credit-note-validation.service.js'
import { CustomerCreditNoteInvalidStatusError, CustomerCreditNoteValidationError } from './customer-credit-note.errors.js'
import { serializeCustomerCreditNote } from './customer-credit-note-read.service.js'

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId, userId: meta.userId, module: 'finance', entity: 'customer_credit_note',
    entityId: id, action, newValues, ipAddress: meta.ipAddress, userAgent: meta.userAgent,
  })
}

async function resolveReason(tenantId: string, reasonId?: string | null) {
  if (!reasonId) return null
  const reason = await prisma.creditNoteReason.findFirst({ where: { id: reasonId, tenantId, isActive: true } })
  if (!reason) throw new CustomerCreditNoteValidationError('Credit note reason is invalid or inactive')
  return reason
}

async function validateOwnership(tenantId: string, legalEntityId: string, branchId?: string | null) {
  const result = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (!result.valid) throw new CustomerCreditNoteValidationError(result.errors[0]?.message ?? 'Invalid branch')
}

export async function createCustomerCreditNoteDraft(req: Request, tenantId: string, input: CreateCustomerCreditNoteInput) {
  await validateOwnership(tenantId, input.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)
  const { financialYear } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.postingDate)
  const { calculation, source } = await calculateAndValidateCreditNote(tenantId, input.legalEntityId, input)
  const reason = await resolveReason(tenantId, input.reasonId)
  const note = await repo.createDraft(tenantId, input, calculation, party, source ? {
    invoiceNumber: source.invoiceNumber, supplyType: source.supplyType, taxTreatment: source.taxTreatment,
  } : null, reason, financialYear.id, req.context?.userId)
  await audit(req, tenantId, note.id, 'CUSTOMER_CREDIT_NOTE_DRAFT_CREATED', { draftReference: note.draftReference })
  return serializeCustomerCreditNote(req, note)
}

export async function updateCustomerCreditNoteDraft(req: Request, tenantId: string, id: string, input: UpdateCustomerCreditNoteInput) {
  const existing = await repo.findWithLinesOrThrow(tenantId, id)
  await validateOwnership(tenantId, existing.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)
  const { financialYear } = await resolvePeriodByDate(tenantId, existing.legalEntityId, input.postingDate)
  const { calculation, source } = await calculateAndValidateCreditNote(tenantId, existing.legalEntityId, input, id)
  const reason = await resolveReason(tenantId, input.reasonId)
  const note = await repo.replaceDraft(tenantId, id, input, calculation, party, source ? {
    invoiceNumber: source.invoiceNumber, supplyType: source.supplyType, taxTreatment: source.taxTreatment,
  } : null, reason, financialYear.id, req.context?.userId)
  await audit(req, tenantId, id, 'CUSTOMER_CREDIT_NOTE_DRAFT_UPDATED')
  return serializeCustomerCreditNote(req, note)
}

export async function validateCustomerCreditNoteRecord(req: Request, tenantId: string, id: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  const context = note.calculationContext as unknown as CreateCustomerCreditNoteInput
  const result = await calculateAndValidateCreditNote(tenantId, note.legalEntityId, context, id)
  await audit(req, tenantId, id, 'CUSTOMER_CREDIT_NOTE_VALIDATED', { valid: true })
  return { valid: true, errors: [], warnings: [], calculation: result.calculation }
}

export async function markCustomerCreditNoteReady(req: Request, tenantId: string, id: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (note.status !== 'DRAFT') throw new CustomerCreditNoteInvalidStatusError('Only draft credit notes can be marked ready')
  if (note.approvalRequired) throw new CustomerCreditNoteInvalidStatusError('Submit approval-required credit notes for approval')
  await validateCustomerCreditNoteRecord(req, tenantId, id)
  await previewNextNumber(tenantId, note.legalEntityId, 'CUSTOMER_CREDIT_NOTE').catch(() => {
    throw new CustomerCreditNoteValidationError('CUSTOMER_CREDIT_NOTE number series is not configured')
  })
  const updated = await prisma.customerCreditNote.update({ where: { id, tenantId }, data: { status: 'READY_TO_POST', updatedBy: req.context?.userId } })
  await audit(req, tenantId, id, 'CUSTOMER_CREDIT_NOTE_READY')
  return serializeCustomerCreditNote(req, { ...updated, lines: note.lines })
}

export async function submitCustomerCreditNote(req: Request, tenantId: string, id: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (note.status !== 'DRAFT' || !note.approvalRequired) throw new CustomerCreditNoteInvalidStatusError('Only approval-required draft credit notes can be submitted')
  await validateCustomerCreditNoteRecord(req, tenantId, id)
  const request = await prisma.$transaction(async (tx) => {
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId, legalEntityId: note.legalEntityId, documentType: 'CREDIT_NOTE', documentId: note.id,
        documentNumberSnapshot: note.draftReference, documentStatusSnapshot: 'PENDING_APPROVAL',
        status: 'PENDING', amountBasis: note.baseGrandTotal, currencyCode: note.currencyCode,
        currentLevel: 1, totalLevels: 1, requestedBy: req.context?.userId,
      },
    })
    await tx.customerCreditNote.update({
      where: { id, tenantId },
      data: { status: 'PENDING_APPROVAL', approvalRequestId: approval.id, updatedBy: req.context?.userId },
    })
    return approval
  })
  await audit(req, tenantId, id, 'CUSTOMER_CREDIT_NOTE_SUBMITTED', { approvalRequestId: request.id })
  return serializeCustomerCreditNote(req, await repo.findWithLinesOrThrow(tenantId, id))
}

export async function cancelCustomerCreditNote(req: Request, tenantId: string, id: string, cancellationReason: string) {
  const note = await repo.findWithLinesOrThrow(tenantId, id)
  if (!['DRAFT', 'READY_TO_POST', 'REJECTED'].includes(note.status)) throw new CustomerCreditNoteInvalidStatusError('Credit note cannot be cancelled in its current status')
  await prisma.customerCreditNote.update({
    where: { id, tenantId },
    data: { status: 'CANCELLED', cancellationReason, cancelledAt: new Date(), cancelledBy: req.context?.userId, updatedBy: req.context?.userId },
  })
  await audit(req, tenantId, id, 'CUSTOMER_CREDIT_NOTE_CANCELLED', { cancellationReason })
  return serializeCustomerCreditNote(req, await repo.findWithLinesOrThrow(tenantId, id))
}
