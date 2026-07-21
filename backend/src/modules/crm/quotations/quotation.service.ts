import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import {
  assertCompanyInTenant,
  assertContactInTenant,
  assertOpportunityInTenant,
  assertUserInTenant,
} from '../crm.tenant-refs.js'
import * as repo from './quotation.repository.js'
import { DEFAULT_GST_PCT, APPROVAL_AMOUNT_THRESHOLD, DISCOUNT_APPROVAL_THRESHOLD } from './quotation.constants.js'
import { mapQuotationToDto } from './quotation.mapper.js'
import type {
  ApprovalRemarksInput,
  CreateQuotationInput,
  ListQuotationsQuery,
  RevisionReasonInput,
  UpdateQuotationDocumentInput,
  UpdateQuotationInput,
} from './quotation.validation.js'
import {
  appendApprovalHistory,
  assertDocumentApprovable,
  assertDocumentCustomerApprovable,
  assertDocumentEditable,
  assertDocumentRejectable,
  assertDocumentSendable,
  assertDocumentSubmittable,
  assertQuotationDeletable,
} from './quotation.workflow.js'

async function mapQuotationWithNames(
  tenantId: string,
  quotation: NonNullable<Awaited<ReturnType<typeof repo.findQuotationById>>>,
) {
  const nameMap = await resolveUserNames(
    [quotation.createdBy, quotation.updatedBy, quotation.salesOwnerId],
    tenantId,
    prisma,
  )
  return mapQuotationToDto(quotation, {
    createdByName: quotation.createdBy ? nameMap.get(quotation.createdBy) : undefined,
    modifiedByName: quotation.updatedBy ? nameMap.get(quotation.updatedBy) : undefined,
    salesOwnerName: quotation.salesOwnerId ? nameMap.get(quotation.salesOwnerId) : undefined,
  })
}

async function getUserName(tenantId: string, userId: string): Promise<string> {
  const nameMap = await resolveUserNames([userId], tenantId, prisma)
  return nameMap.get(userId) ?? 'User'
}

export async function listQuotations(tenantId: string, query: ListQuotationsQuery) {
  const result = await repo.findQuotations(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((q) => [q.createdBy, q.updatedBy, q.salesOwnerId]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((q) =>
      mapQuotationToDto(q, {
        createdByName: q.createdBy ? nameMap.get(q.createdBy) : undefined,
        modifiedByName: q.updatedBy ? nameMap.get(q.updatedBy) : undefined,
        salesOwnerName: q.salesOwnerId ? nameMap.get(q.salesOwnerId) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getQuotation(tenantId: string, id: string) {
  const quotation = await repo.findQuotationById(tenantId, id)
  if (!quotation) throw new NotFoundError('Quotation not found')
  return mapQuotationWithNames(tenantId, quotation)
}

export async function createQuotation(tenantId: string, userId: string, input: CreateQuotationInput) {
  await assertCompanyInTenant(tenantId, input.customerId)
  if (input.contactId) await assertContactInTenant(tenantId, input.contactId)
  if (input.opportunityId) {
    await assertOpportunityInTenant(tenantId, input.opportunityId)
    const existing = await repo.countQuotationsForOpportunity(tenantId, input.opportunityId)
    if (existing > 0) {
      throw new ValidationError('Quotation already exists for this opportunity — create a revision instead')
    }
  }
  if (input.salesOwnerId) await assertUserInTenant(tenantId, input.salesOwnerId)

  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const quotationCode = input.quotationNo ?? (await nextCode(tenantId, 'QUOTATION'))
  const userName = await getUserName(tenantId, userId)
  const quotation = await repo.createQuotation(tenantId, userId, userName, { ...input, quotationCode })
  return mapQuotationToDto(quotation)
}

export async function updateQuotation(tenantId: string, id: string, userId: string, input: UpdateQuotationInput) {
  const existing = await repo.findQuotationById(tenantId, id)
  if (!existing) throw new NotFoundError('Quotation not found')
  if (existing.locked) throw new InvalidStateError('Quotation is locked')

  if (input.customerId) await assertCompanyInTenant(tenantId, input.customerId)
  if (input.contactId) await assertContactInTenant(tenantId, input.contactId)
  if (input.salesOwnerId) await assertUserInTenant(tenantId, input.salesOwnerId)

  const quotation = await repo.updateQuotation(tenantId, id, userId, input)
  return mapQuotationWithNames(tenantId, quotation)
}

export async function updateQuotationDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  input: UpdateQuotationDocumentInput,
) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  assertDocumentEditable(doc)

  const quotation = await repo.updateQuotationDocument(tenantId, quotationId, docId, userId, input)
  return mapQuotationWithNames(tenantId, quotation)
}

export async function createQuotationRevision(
  tenantId: string,
  quotationId: string,
  userId: string,
  input: RevisionReasonInput,
) {
  const existing = await repo.findQuotationById(tenantId, quotationId)
  if (!existing) throw new NotFoundError('Quotation not found')
  const userName = await getUserName(tenantId, userId)
  const quotation = await repo.createQuotationRevision(tenantId, quotationId, userId, userName, input.reason)
  return mapQuotationWithNames(tenantId, quotation)
}

export async function submitDocumentForApproval(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  input: ApprovalRemarksInput,
) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  assertDocumentSubmittable(doc)

  const userName = await getUserName(tenantId, userId)
  const priceLines = Array.isArray(doc.priceLines) ? (doc.priceLines as Array<{ discountPct?: number }>) : []
  const maxDiscount = priceLines.reduce((m, l) => Math.max(m, l.discountPct ?? 0), 0)
  const totalAmount = Number(doc.totalAmount)

  if (totalAmount <= APPROVAL_AMOUNT_THRESHOLD && maxDiscount <= DISCOUNT_APPROVAL_THRESHOLD) {
    const quotation = await repo.autoApproveDocument(
      tenantId,
      quotationId,
      docId,
      userId,
      userName,
      input.remarks ?? 'Auto-approved within limit',
    )
    return mapQuotationWithNames(tenantId, quotation)
  }

  const history = appendApprovalHistory(doc, 'submitted', userId, userName, input.remarks ?? 'Submitted for approval')
  const quotation = await repo.submitDocumentForApproval(
    tenantId,
    quotationId,
    docId,
    userId,
    history as unknown as import('@prisma/client').Prisma.InputJsonValue,
  )
  return mapQuotationWithNames(tenantId, quotation)
}

export async function approveDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  input: ApprovalRemarksInput,
) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  assertDocumentApprovable(doc)

  const userName = await getUserName(tenantId, userId)
  const history = appendApprovalHistory(doc, 'approved', userId, userName, input.remarks ?? 'Approved')
  const quotation = await repo.approveDocument(tenantId, quotationId, docId, userId, history as unknown as import('@prisma/client').Prisma.InputJsonValue)
  return mapQuotationWithNames(tenantId, quotation)
}

export async function rejectDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  input: ApprovalRemarksInput,
) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  assertDocumentRejectable(doc)

  const userName = await getUserName(tenantId, userId)
  const history = appendApprovalHistory(doc, 'rejected', userId, userName, input.remarks ?? 'Rejected')
  const quotation = await repo.rejectDocument(tenantId, quotationId, docId, userId, input.remarks, history as unknown as import('@prisma/client').Prisma.InputJsonValue)
  return mapQuotationWithNames(tenantId, quotation)
}

export async function markDocumentSent(tenantId: string, quotationId: string, docId: string, userId: string) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  assertDocumentSendable(doc)
  const userName = await getUserName(tenantId, userId)
  const history = appendApprovalHistory(doc, 'sent', userId, userName, 'Sent to customer')
  const quotation = await repo.markDocumentSent(
    tenantId,
    quotationId,
    docId,
    userId,
    history as unknown as import('@prisma/client').Prisma.InputJsonValue,
  )
  return mapQuotationWithNames(tenantId, quotation)
}

export async function recordCustomerApproval(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  input: ApprovalRemarksInput & { decision?: 'approved' | 'rejected' },
) {
  const doc = await repo.findQuotationDocumentById(tenantId, quotationId, docId)
  if (!doc) throw new NotFoundError('Quotation document not found')
  const header = await repo.findQuotationById(tenantId, quotationId)
  if (!header) throw new NotFoundError('Quotation not found')
  assertDocumentCustomerApprovable(doc, header)

  const decision = input.decision ?? 'approved'
  const userName = await getUserName(tenantId, userId)
  const history = appendApprovalHistory(
    doc,
    decision === 'approved' ? 'customer_approved' : 'customer_rejected',
    userId,
    userName,
    input.remarks ?? (decision === 'approved' ? 'Customer approved' : 'Customer rejected'),
  )
  const quotation = await repo.recordCustomerApproval(
    tenantId,
    quotationId,
    docId,
    userId,
    decision,
    input.remarks,
    history as unknown as import('@prisma/client').Prisma.InputJsonValue,
  )
  return mapQuotationWithNames(tenantId, quotation)
}

export async function deleteQuotation(tenantId: string, id: string, userId: string) {
  const existing = await repo.findQuotationById(tenantId, id)
  if (!existing) throw new NotFoundError('Quotation not found')
  assertQuotationDeletable(existing)
  await repo.softDeleteQuotation(tenantId, id, userId)
}

export async function convertQuotationToSalesOrder(
  tenantId: string,
  quotationId: string,
  userId: string,
  input: import('../sales-orders/sales-order.validation.js').ConvertQuotationToSalesOrderInput,
) {
  const { convertQuotationToSalesOrder: convert } = await import('./quotation.convert.js')
  const { mapSalesOrderToDto } = await import('../sales-orders/sales-order.types.js')
  const result = await convert(tenantId, quotationId, userId, input)
  const quotation = await mapQuotationWithNames(tenantId, result.quotation)
  const salesOrder = mapSalesOrderToDto(result.salesOrder)
  return { salesOrderId: salesOrder.id, salesOrderNo: salesOrder.salesOrderNo, salesOrder, quotation }
}

export { DEFAULT_GST_PCT }
