import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import {
  nextPurchaseDocumentNumber,
  previewPurchaseDocumentNumber,
} from '../shared/purchase-document-number.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import {
  RfqNotFoundError,
  RfqNotEditableError,
  RfqPrNotEligibleError,
  RfqVendorsRequiredError,
} from './rfq.errors.js'
import { mapRfqToDto } from './rfq.mapper.js'
import * as repo from './rfq.repository.js'
import type {
  ConvertPrToRfqInput,
  CreateRfqInput,
  LifecycleRemarksInput,
  ListRfqsQuery,
  SetRfqVendorsInput,
  UpdateRfqInput,
} from './rfq.validation.js'
import {
  assertPrEligibleForRfq,
  assertRfqDraftEditable,
  assertRfqSendable,
  parseDateInput,
} from './rfq.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const rfq = await repo.findRfqById(tenantId, id)
  if (!rfq) throw new RfqNotFoundError()
  return rfq
}

export async function previewNextRfqNumber(tenantId: string) {
  const rfqNumber = await previewPurchaseDocumentNumber(
    tenantId,
    'REQUEST_FOR_QUOTATION',
    'RFQ',
  )
  return { rfqNumber }
}

function normalizeLines(lines: CreateRfqInput['lines']) {
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    purchaseRequisitionLineId: line.purchaseRequisitionLineId ?? null,
    itemId: line.itemId ?? null,
    itemCodeSnapshot: line.itemCodeSnapshot?.trim() || '',
    itemNameSnapshot: line.itemNameSnapshot?.trim() || '',
    description: line.description?.trim() || null,
    requiredQuantity: line.requiredQuantity,
    uomId: line.uomId ?? null,
    targetRate: line.targetRate ?? null,
    requiredDate: parseDateInput(line.requiredDate),
    remarks: line.remarks?.trim() || null,
  }))
}

export async function listRfqs(tenantId: string, query: ListRfqsQuery) {
  const result = await repo.findRfqs(tenantId, query)
  const userNames = await repo.resolveUserNames(
    tenantId,
    result.items.map((r) => r.createdById),
  )
  return {
    items: result.items.map((r) => mapRfqToDto(r, userNames)),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getRfq(tenantId: string, id: string) {
  const rfq = await loadOrThrow(tenantId, id)
  const userNames = await repo.resolveUserNames(tenantId, [rfq.createdById])
  return mapRfqToDto(rfq, userNames)
}

export async function createRfq(tenantId: string, actorId: string, input: CreateRfqInput) {
  if (!input.vendorIds?.length) throw new RfqVendorsRequiredError()
  const { resolveEffectivePurchaseDefaults } = await import('../shared/purchase-defaults.js')
  const { assertRfqVendorCount } = await import('../shared/purchase-setup-enforcement.js')
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  const vendorCountError = assertRfqVendorCount(defaults, input.vendorIds.length)
  if (vendorCountError) throw new RfqVendorsRequiredError(vendorCountError)
  const lines = normalizeLines(input.lines)
  const rfqNumber = await nextPurchaseDocumentNumber(tenantId, 'REQUEST_FOR_QUOTATION', 'RFQ')

  const created = await prisma.$transaction(async (tx) => {
    const rfq = await repo.createRfq(
      {
        tenant: { connect: { id: tenantId } },
        rfqNumber,
        rfqDate: parseDateInput(input.rfqDate) ?? new Date(),
        purchaseRequisition: input.purchaseRequisitionId
          ? { connect: { id: input.purchaseRequisitionId } }
          : undefined,
        title: input.title?.trim() || null,
        responseDueDate: parseDateInput(input.responseDueDate),
        status: 'DRAFT',
        remarks: input.remarks?.trim() || null,
        createdById: actorId,
        updatedById: actorId,
        lines: {
          create: lines.map((l) => ({ tenantId, ...l })),
        },
        vendors: {
          create: input.vendorIds.map((vendorId) => ({
            tenantId,
            vendorId,
            inviteStatus: 'INVITED' as const,
          })),
        },
      },
      tx,
    )
    await repo.createStatusHistory(tenantId, rfq.id, null, 'DRAFT', actorId, null, tx)
    return rfq
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.RFQ_CREATED,
    newValue: { rfqNumber: created.rfqNumber },
  })

  return mapRfqToDto(created)
}

export async function convertPurchaseRequisitionToRfq(
  tenantId: string,
  purchaseRequisitionId: string,
  actorId: string,
  input: ConvertPrToRfqInput = {},
) {
  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id: purchaseRequisitionId, ...tenantActiveFilter(tenantId) },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!pr) throw new RfqNotFoundError('Purchase requisition not found')
  assertPrEligibleForRfq(pr)

  const preferredVendorIds = [
    ...new Set(
      pr.lines.map((l) => l.preferredVendorId).filter((id): id is string => Boolean(id)),
    ),
  ]
  const vendorIds = input.vendorIds?.length ? input.vendorIds : preferredVendorIds
  if (!vendorIds.length) {
    throw new RfqVendorsRequiredError(
      'Select at least one vendor (or set preferred vendors on PR lines) before creating RFQ',
    )
  }

  const validLines = pr.lines.filter((l) => Number(l.requiredQuantity) > 0)
  if (!validLines.length) {
    throw new RfqPrNotEligibleError('Purchase requisition has no valid lines for RFQ')
  }

  return createRfq(tenantId, actorId, {
    rfqDate: new Date().toISOString().slice(0, 10),
    purchaseRequisitionId: pr.id,
    title: input.title?.trim() || `RFQ for ${pr.requisitionNumber}`,
    responseDueDate: input.responseDueDate ?? null,
    remarks: input.remarks ?? pr.remarks,
    vendorIds,
    lines: validLines.map((l) => ({
      purchaseRequisitionLineId: l.id,
      itemId: l.itemId,
      itemCodeSnapshot: l.itemCodeSnapshot,
      itemNameSnapshot: l.itemNameSnapshot,
      description: l.description,
      requiredQuantity: Number(l.requiredQuantity),
      uomId: l.uomId,
      targetRate: Number(l.estimatedRate),
      requiredDate: l.requiredDate ? l.requiredDate.toISOString().slice(0, 10) : null,
      remarks: l.remarks,
    })),
  })
}

export async function updateRfq(
  tenantId: string,
  id: string,
  actorId: string,
  input: UpdateRfqInput,
) {
  const current = await loadOrThrow(tenantId, id)
  assertRfqDraftEditable(current.status)

  const updated = await prisma.$transaction(async (tx) => {
    const data: Prisma.RequestForQuotationUpdateInput = {
      title: input.title === undefined ? undefined : input.title?.trim() || null,
      responseDueDate:
        input.responseDueDate === undefined
          ? undefined
          : parseDateInput(input.responseDueDate),
      remarks: input.remarks === undefined ? undefined : input.remarks?.trim() || null,
      updatedById: actorId,
    }
    await tx.requestForQuotation.update({ where: { id }, data })
    if (input.lines) {
      await repo.replaceRfqLines(tenantId, id, normalizeLines(input.lines), tx)
    }
    if (input.vendorIds) {
      if (!input.vendorIds.length) throw new RfqVendorsRequiredError()
      await repo.replaceRfqVendors(tenantId, id, input.vendorIds, tx)
    }
    const next = await repo.findRfqByIdTx(tenantId, id, tx)
    if (!next) throw new RfqNotFoundError()
    return next
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.RFQ_UPDATED,
  })

  return mapRfqToDto(updated)
}

export async function setRfqVendors(
  tenantId: string,
  id: string,
  actorId: string,
  input: SetRfqVendorsInput,
) {
  const current = await loadOrThrow(tenantId, id)
  assertRfqDraftEditable(current.status)
  if (!input.vendorIds.length) throw new RfqVendorsRequiredError()

  const updated = await prisma.$transaction(async (tx) => {
    await repo.replaceRfqVendors(tenantId, id, input.vendorIds, tx)
    await tx.requestForQuotation.update({
      where: { id },
      data: { updatedById: actorId },
    })
    const next = await repo.findRfqByIdTx(tenantId, id, tx)
    if (!next) throw new RfqNotFoundError()
    return next
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.RFQ_VENDOR_ADDED,
    newValue: { vendorCount: input.vendorIds.length, vendorIds: input.vendorIds },
  })

  return mapRfqToDto(updated)
}

export async function sendRfq(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const current = await loadOrThrow(tenantId, id)
  assertRfqSendable(current.status, current.vendors.length)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.requestForQuotation.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        updatedById: actorId,
        remarks: input.remarks?.trim() || current.remarks,
      },
    })
    await tx.rfqVendor.updateMany({
      where: { tenantId, requestForQuotationId: id },
      data: { inviteStatus: 'SENT' },
    })
    await repo.createStatusHistory(
      tenantId,
      id,
      current.status,
      'SENT',
      actorId,
      input.remarks?.trim() || null,
      tx,
    )
    const next = await repo.findRfqByIdTx(tenantId, id, tx)
    if (!next) throw new RfqNotFoundError()
    return next
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.RFQ_SENT,
  })

  return mapRfqToDto(updated)
}

export async function cancelRfq(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const current = await loadOrThrow(tenantId, id)
  if (['CONVERTED_TO_PO', 'CANCELLED', 'CLOSED'].includes(current.status)) {
    throw new RfqNotEditableError('RFQ cannot be cancelled in the current status')
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.requestForQuotation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        closedAt: new Date(),
        updatedById: actorId,
        remarks: input.remarks?.trim() || current.remarks,
      },
    })
    await repo.createStatusHistory(
      tenantId,
      id,
      current.status,
      'CANCELLED',
      actorId,
      input.remarks?.trim() || null,
      tx,
    )
    const next = await repo.findRfqByIdTx(tenantId, id, tx)
    if (!next) throw new RfqNotFoundError()
    return next
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.RFQ_CANCELLED,
  })

  return mapRfqToDto(updated)
}

// Re-export for convert eligibility check used by PR path
export { assertPrEligibleForRfq }
