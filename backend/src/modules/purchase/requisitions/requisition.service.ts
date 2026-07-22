import type { Request } from 'express'
import type { Prisma, PurchaseRequisitionSource } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { isPositive, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { mapRequisition } from '../shared/mappers.js'
import {
  PurchaseItemBlockedError,
  PurchaseItemNotPurchasableError,
  PurchaseRequisitionInvalidStateError,
  PurchaseRequisitionLineNotFoundError,
  PurchaseRequisitionNoLinesError,
  PurchaseWarehouseInactiveError,
} from '../shared/requisition.errors.js'
import * as repo from './requisition.repository.js'
import type {
  CancelRequisitionInput,
  CreateRequisitionInput,
  FromProductionShortageInput,
  ListRequisitionsQuery,
  RejectRequisitionInput,
  RequisitionLineInput,
  UpdateRequisitionInput,
  UpdateRequisitionLineInput,
} from './requisition.schemas.js'

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function assertDraft(status: string): void {
  if (status !== 'DRAFT') {
    throw new PurchaseRequisitionInvalidStateError('Only DRAFT requisitions can be edited')
  }
}

async function validatePurchasableItem(tenantId: string, itemId: string): Promise<void> {
  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: { id: true, isPurchasable: true, isBlocked: true, status: true },
  })
  if (!item) throw new NotFoundError('Item not found')
  if (!item.isPurchasable) throw new PurchaseItemNotPurchasableError()
  if (item.isBlocked || item.status !== 'ACTIVE') throw new PurchaseItemBlockedError()
}

async function validateWarehouseOptional(tenantId: string, warehouseId: string | null | undefined): Promise<void> {
  if (!warehouseId) return
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!warehouse) throw new NotFoundError('Warehouse not found')
  if (warehouse.status !== 'ACTIVE') throw new PurchaseWarehouseInactiveError()
}

async function validateProductionOrderOptional(tenantId: string, productionOrderId: string | null | undefined): Promise<void> {
  if (!productionOrderId) return
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, tenantId },
    select: { id: true },
  })
  if (!order) throw new NotFoundError('Production order not found')
}

async function validateSalesOrderOptional(tenantId: string, salesOrderId: string | null | undefined): Promise<void> {
  if (!salesOrderId) return
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!order) throw new NotFoundError('Sales order not found')
}

async function validateLineInput(tenantId: string, line: RequisitionLineInput): Promise<void> {
  await validatePurchasableItem(tenantId, line.itemId)
  await validateWarehouseOptional(tenantId, line.warehouseId)
  await validateProductionOrderOptional(tenantId, line.productionOrderId)
  await validateSalesOrderOptional(tenantId, line.salesOrderId)
  const qty = toDecimal(line.quantity)
  if (!isPositive(qty)) throw new PurchaseRequisitionInvalidStateError('Line quantity must be greater than zero')
}

async function validateHeaderRefs(
  tenantId: string,
  input: {
    warehouseId?: string | null
    productionOrderId?: string | null
    salesOrderId?: string | null
  },
): Promise<void> {
  await validateWarehouseOptional(tenantId, input.warehouseId)
  await validateProductionOrderOptional(tenantId, input.productionOrderId)
  await validateSalesOrderOptional(tenantId, input.salesOrderId)
}

function buildLineCreateData(
  tenantId: string,
  requisitionId: string,
  lineNo: number,
  line: RequisitionLineInput,
): Prisma.PurchaseRequisitionLineCreateManyInput {
  return {
    tenantId,
    requisitionId,
    lineNo,
    itemId: line.itemId,
    warehouseId: line.warehouseId ?? null,
    uomId: line.uomId ?? null,
    quantity: toDecimal(line.quantity),
    requiredDate: parseDateOnly(line.requiredDate),
    productionOrderId: line.productionOrderId ?? null,
    stageId: line.stageId ?? null,
    operationId: line.operationId ?? null,
    bomLineId: line.bomLineId ?? null,
    salesOrderId: line.salesOrderId ?? null,
    salesOrderLineKey: line.salesOrderLineKey ?? null,
    preferredVendorId: line.preferredVendorId ?? null,
    remarks: line.remarks ?? null,
  }
}

async function createRequisitionInternal(
  req: Request,
  tenantId: string,
  input: {
    source: PurchaseRequisitionSource
    priority: CreateRequisitionInput['priority']
    purpose?: string
    warehouseId?: string
    productionOrderId?: string
    salesOrderId?: string
    projectRef?: string
    requiredByDate?: string
    notes?: string
    idempotencyKey?: string
    lines?: RequisitionLineInput[]
    submit?: boolean
  },
) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existing = await repo.findRequisitionByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing) return mapRequisition(existing)
  }

  await validateHeaderRefs(tenantId, input)
  if (input.lines?.length) {
    for (const line of input.lines) {
      await validateLineInput(tenantId, line)
    }
  }

  const requisition = await prisma.$transaction(async (tx) => {
    const prNumber = await nextCode(tenantId, 'PURCHASE_REQUISITION', tx)
    const row = await tx.purchaseRequisition.create({
      data: {
        tenantId,
        prNumber,
        source: input.source,
        status: 'DRAFT',
        priority: input.priority,
        purpose: input.purpose ?? null,
        requestedByUserId: userId || null,
        requiredByDate: parseDateOnly(input.requiredByDate),
        warehouseId: input.warehouseId ?? null,
        productionOrderId: input.productionOrderId ?? null,
        salesOrderId: input.salesOrderId ?? null,
        projectRef: input.projectRef ?? null,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId || null,
        updatedBy: userId || null,
      },
    })

    if (input.lines?.length) {
      await tx.purchaseRequisitionLine.createMany({
        data: input.lines.map((line, index) => buildLineCreateData(tenantId, row.id, index + 1, line)),
      })
    }

    if (input.submit) {
      const lineCount = input.lines?.length ?? 0
      if (lineCount === 0) throw new PurchaseRequisitionNoLinesError()
      await tx.purchaseRequisition.update({
        where: { id: row.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedBy: userId || null,
          updatedBy: userId || null,
        },
      })
    }

    return tx.purchaseRequisition.findFirstOrThrow({
      where: { id: row.id, tenantId },
      include: repo.requisitionInclude,
    })
  })

  return mapRequisition(requisition)
}

export async function createRequisition(req: Request, tenantId: string, input: CreateRequisitionInput) {
  return createRequisitionInternal(req, tenantId, {
    source: 'MANUAL',
    priority: input.priority,
    purpose: input.purpose,
    warehouseId: input.warehouseId,
    productionOrderId: input.productionOrderId,
    salesOrderId: input.salesOrderId,
    projectRef: input.projectRef,
    requiredByDate: input.requiredByDate,
    notes: input.notes,
    idempotencyKey: input.idempotencyKey,
    lines: input.lines,
  })
}

export async function createFromProductionShortage(req: Request, tenantId: string, input: FromProductionShortageInput) {
  return createRequisitionInternal(req, tenantId, {
    source: 'PRODUCTION_SHORTAGE',
    priority: input.priority,
    purpose: input.purpose,
    warehouseId: input.warehouseId,
    productionOrderId: input.productionOrderId,
    salesOrderId: input.salesOrderId,
    projectRef: input.projectRef,
    requiredByDate: input.requiredByDate,
    idempotencyKey: input.idempotencyKey,
    lines: input.lines.map((line) => ({
      ...line,
      productionOrderId: line.productionOrderId ?? input.productionOrderId,
    })),
    submit: input.submit,
  })
}

export async function getRequisition(tenantId: string, id: string) {
  const row = await repo.findRequisitionByIdOrThrow(tenantId, id)
  return mapRequisition(row)
}

export async function listRequisitions(tenantId: string, query: ListRequisitionsQuery) {
  const result = await repo.listRequisitions(tenantId, query)
  return {
    items: result.rows.map(mapRequisition),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function listByProductionOrder(tenantId: string, productionOrderId: string) {
  await validateProductionOrderOptional(tenantId, productionOrderId)
  const rows = await repo.listRequisitionsByProductionOrder(tenantId, productionOrderId)
  return rows.map(mapRequisition)
}

export async function updateRequisition(req: Request, tenantId: string, id: string, input: UpdateRequisitionInput) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findRequisitionByIdOrThrow(tenantId, id)
  assertDraft(existing.status)

  await validateHeaderRefs(tenantId, {
    warehouseId: input.warehouseId === undefined ? existing.warehouseId : input.warehouseId,
    productionOrderId: input.productionOrderId === undefined ? existing.productionOrderId : input.productionOrderId,
    salesOrderId: input.salesOrderId === undefined ? existing.salesOrderId : input.salesOrderId,
  })

  const updated = await prisma.purchaseRequisition.update({
    where: { id: existing.id },
    data: {
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
      ...(input.productionOrderId !== undefined ? { productionOrderId: input.productionOrderId } : {}),
      ...(input.salesOrderId !== undefined ? { salesOrderId: input.salesOrderId } : {}),
      ...(input.projectRef !== undefined ? { projectRef: input.projectRef } : {}),
      ...(input.requiredByDate !== undefined ? { requiredByDate: parseDateOnly(input.requiredByDate) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedBy: userId || null,
    },
    include: repo.requisitionInclude,
  })

  return mapRequisition(updated)
}

export async function addLine(req: Request, tenantId: string, requisitionId: string, input: RequisitionLineInput) {
  const userId = req.context?.userId ?? ''
  const requisition = await repo.findRequisitionByIdOrThrow(tenantId, requisitionId)
  assertDraft(requisition.status)
  await validateLineInput(tenantId, input)

  await prisma.$transaction(async (tx) => {
    const lineNo = await repo.getNextLineNo(tx, requisitionId)
    await tx.purchaseRequisitionLine.create({
      data: buildLineCreateData(tenantId, requisitionId, lineNo, input),
    })
  })

  await prisma.purchaseRequisition.update({
    where: { id: requisitionId },
    data: { updatedBy: userId || null },
  })

  return mapRequisition(await repo.findRequisitionByIdOrThrow(tenantId, requisitionId))
}

export async function updateLine(req: Request, tenantId: string, lineId: string, input: UpdateRequisitionLineInput) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findLineById(tenantId, lineId)
  if (!existing) throw new PurchaseRequisitionLineNotFoundError()
  assertDraft(existing.requisition.status)

  const merged: RequisitionLineInput = {
    itemId: input.itemId ?? existing.itemId,
    quantity: input.quantity ?? Number(existing.quantity),
    warehouseId: input.warehouseId ?? existing.warehouseId ?? undefined,
    uomId: input.uomId ?? existing.uomId ?? undefined,
    requiredDate: input.requiredDate ?? (existing.requiredDate ? existing.requiredDate.toISOString().slice(0, 10) : undefined),
    productionOrderId: input.productionOrderId ?? existing.productionOrderId ?? undefined,
    stageId: input.stageId ?? existing.stageId ?? undefined,
    operationId: input.operationId ?? existing.operationId ?? undefined,
    bomLineId: input.bomLineId ?? existing.bomLineId ?? undefined,
    salesOrderId: input.salesOrderId ?? existing.salesOrderId ?? undefined,
    salesOrderLineKey: input.salesOrderLineKey ?? existing.salesOrderLineKey ?? undefined,
    preferredVendorId: input.preferredVendorId ?? existing.preferredVendorId ?? undefined,
    remarks: input.remarks ?? existing.remarks ?? undefined,
  }

  await validateLineInput(tenantId, merged)

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequisitionLine.update({
      where: { id: lineId },
      data: {
        ...(input.itemId !== undefined ? { itemId: input.itemId } : {}),
        ...(input.quantity !== undefined ? { quantity: toDecimal(input.quantity) } : {}),
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.uomId !== undefined ? { uomId: input.uomId } : {}),
        ...(input.requiredDate !== undefined ? { requiredDate: parseDateOnly(input.requiredDate) } : {}),
        ...(input.productionOrderId !== undefined ? { productionOrderId: input.productionOrderId } : {}),
        ...(input.stageId !== undefined ? { stageId: input.stageId } : {}),
        ...(input.operationId !== undefined ? { operationId: input.operationId } : {}),
        ...(input.bomLineId !== undefined ? { bomLineId: input.bomLineId } : {}),
        ...(input.salesOrderId !== undefined ? { salesOrderId: input.salesOrderId } : {}),
        ...(input.salesOrderLineKey !== undefined ? { salesOrderLineKey: input.salesOrderLineKey } : {}),
        ...(input.preferredVendorId !== undefined ? { preferredVendorId: input.preferredVendorId } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      },
    })
    await tx.purchaseRequisition.update({
      where: { id: existing.requisitionId },
      data: { updatedBy: userId || null },
    })
  })

  return mapRequisition(await repo.findRequisitionByIdOrThrow(tenantId, existing.requisitionId))
}

export async function deleteLine(req: Request, tenantId: string, lineId: string) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findLineById(tenantId, lineId)
  if (!existing) throw new PurchaseRequisitionLineNotFoundError()
  assertDraft(existing.requisition.status)

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequisitionLine.delete({ where: { id: lineId } })
    await tx.purchaseRequisition.update({
      where: { id: existing.requisitionId },
      data: { updatedBy: userId || null },
    })
  })

  return mapRequisition(await repo.findRequisitionByIdOrThrow(tenantId, existing.requisitionId))
}

export async function submitRequisition(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findRequisitionByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw new PurchaseRequisitionInvalidStateError('Only DRAFT requisitions can be submitted')
  }

  const lineCount = existing.lines?.length ?? 0
  if (lineCount === 0) throw new PurchaseRequisitionNoLinesError()

  const updated = await prisma.purchaseRequisition.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedBy: userId || null,
      updatedBy: userId || null,
    },
    include: repo.requisitionInclude,
  })

  return mapRequisition(updated)
}

export async function approveRequisition(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findRequisitionByIdOrThrow(tenantId, id)
  if (existing.status !== 'SUBMITTED') {
    throw new PurchaseRequisitionInvalidStateError('Only SUBMITTED requisitions can be approved')
  }

  const updated = await prisma.purchaseRequisition.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId || null,
      updatedBy: userId || null,
    },
    include: repo.requisitionInclude,
  })

  return mapRequisition(updated)
}

export async function rejectRequisition(req: Request, tenantId: string, id: string, input: RejectRequisitionInput) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findRequisitionByIdOrThrow(tenantId, id)
  if (existing.status !== 'SUBMITTED') {
    throw new PurchaseRequisitionInvalidStateError('Only SUBMITTED requisitions can be rejected')
  }

  const updated = await prisma.purchaseRequisition.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedBy: userId || null,
      rejectionReason: input.reason,
      updatedBy: userId || null,
    },
    include: repo.requisitionInclude,
  })

  return mapRequisition(updated)
}

export async function cancelRequisition(req: Request, tenantId: string, id: string, input: CancelRequisitionInput) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.findRequisitionByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(existing.status)) {
    throw new PurchaseRequisitionInvalidStateError('Requisition cannot be cancelled in its current status')
  }

  const updated = await prisma.purchaseRequisition.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId || null,
      cancellationReason: input.reason ?? null,
      updatedBy: userId || null,
    },
    include: repo.requisitionInclude,
  })

  return mapRequisition(updated)
}
