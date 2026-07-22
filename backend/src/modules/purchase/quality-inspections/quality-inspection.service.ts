import type { QualityInspectionStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InventoryPostingService } from '../../inventory/shared/stock-posting.service.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { postGrnStockInward } from '../shared/purchase-inventory-posting.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { QualityInspectionNotFoundError, QualityInspectionValidationError, QualityInspectionWorkflowError } from './quality-inspection.errors.js'
import { mapQualityInspection } from './quality-inspection.mapper.js'
import * as repo from './quality-inspection.repository.js'
import type { CreateQualityInspectionInput, ListQualityInspectionsQuery, QualityInspectionLineInput, UpdateQualityInspectionInput } from './quality-inspection.validation.js'
import { assertQiEditable, qiDate, qiQty, validateQiLines } from './quality-inspection.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const row = await repo.findQualityInspectionById(tenantId, id)
  if (!row) throw new QualityInspectionNotFoundError()
  return row
}

async function loadGrn(tenantId: string, id?: string | null) {
  if (!id) return null
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: { lines: true },
  })
  if (!grn) throw new QualityInspectionValidationError('Goods receipt not found.')
  if (!['QC_PENDING', 'SUBMITTED', 'RECEIVING_COMPLETED'].includes(grn.status)) {
    throw new QualityInspectionWorkflowError('Goods receipt is not available for quality inspection.')
  }
  return grn
}

function buildQiLines(inputs: QualityInspectionLineInput[]) {
  validateQiLines(inputs)
  return inputs.map((line, index) => ({
    lineNumber: index + 1, goodsReceiptLineId: line.goodsReceiptLineId ?? null,
    purchaseOrderLineId: line.purchaseOrderLineId ?? null, itemId: line.itemId ?? null,
    itemCodeSnapshot: line.itemCode ?? '', itemNameSnapshot: line.itemName ?? '',
    inspectedQuantity: qiQty(line.inspectedQuantity), acceptedQuantity: qiQty(line.acceptedQuantity),
    rejectedQuantity: qiQty(line.rejectedQuantity), deviationQuantity: qiQty(line.deviationQuantity),
    remarks: line.remarks?.trim() || null,
  }))
}

async function linesFromGrn(tenantId: string, grn: NonNullable<Awaited<ReturnType<typeof loadGrn>>>, requiredCategories: string[]) {
  const itemIds = grn.lines.map((line) => line.itemId).filter(Boolean) as string[]
  const items = requiredCategories.length && itemIds.length
    ? await prisma.masterItem.findMany({ where: { tenantId, id: { in: itemIds }, deletedAt: null }, include: { category: { select: { code: true } } } })
    : []
  const categoryByItem = new Map(items.map((item) => [item.id, item.category?.code]))
  const source = grn.lines.filter((line) =>
    line.qcRequired || !requiredCategories.length || (line.itemId && requiredCategories.includes(categoryByItem.get(line.itemId) ?? '')))
  if (!source.length) throw new QualityInspectionValidationError('No GRN lines require inspection under the configured inspection categories.')
  return source.map((line, index) => ({
    lineNumber: index + 1, goodsReceiptLineId: line.id, purchaseOrderLineId: line.purchaseOrderLineId,
    itemId: line.itemId, itemCodeSnapshot: line.itemCodeSnapshot, itemNameSnapshot: line.itemNameSnapshot,
    inspectedQuantity: qiQty(line.acceptedForQcQuantity) || qiQty(line.receivedQuantity),
    acceptedQuantity: 0, rejectedQuantity: 0, deviationQuantity: 0, remarks: null,
  }))
}

export async function listQualityInspections(tenantId: string, query: ListQualityInspectionsQuery) {
  const result = await repo.findQualityInspections(tenantId, query)
  return { ...result, items: result.items.map(mapQualityInspection) }
}
export async function getQualityInspection(tenantId: string, id: string) { return mapQualityInspection(await loadOrThrow(tenantId, id)) }

export async function createQualityInspection(tenantId: string, actorId: string, input: CreateQualityInspectionInput) {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  const grn = await loadGrn(tenantId, input.goodsReceiptId)
  if (input.purchaseOrderId && grn && input.purchaseOrderId !== grn.purchaseOrderId) throw new QualityInspectionValidationError('Purchase order does not match the goods receipt.')
  const lines = input.lines ? buildQiLines(input.lines) : await linesFromGrn(tenantId, grn!, defaults.inspectionRequiredCategories)
  if (grn) {
    const grnLineIds = new Set(grn.lines.map((line) => line.id))
    if (lines.some((line) => line.goodsReceiptLineId && !grnLineIds.has(line.goodsReceiptLineId))) throw new QualityInspectionValidationError('Inspection line does not belong to the selected goods receipt.')
  }
  const inspectionNumber = await nextCode(tenantId, 'PURCHASE_QUALITY_INSPECTION')
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.purchaseQualityInspection.create({ data: {
      tenantId, inspectionNumber, inspectionDate: qiDate(input.inspectionDate) ?? new Date(),
      goodsReceiptId: grn?.id ?? input.goodsReceiptId ?? null,
      purchaseOrderId: grn?.purchaseOrderId ?? input.purchaseOrderId ?? null,
      vendorId: grn?.vendorId ?? input.vendorId ?? null,
      warehouseId: grn?.warehouseId ?? input.warehouseId ?? defaults.defaultWarehouseId,
      status: 'DRAFT', remarks: input.remarks?.trim() || null,
      deviationRemarks: input.deviationRemarks?.trim() || null,
      inspectedById: input.inspectedById?.trim() || actorId,
      inspectedByName: input.inspectedByName?.trim() || null,
      createdById: actorId, updatedById: actorId,
      lines: { create: lines.map((line) => ({ ...line, tenantId })) },
    }, include: repo.includeQualityInspection })
    await repo.addQiHistory(tenantId, row.id, row.inspectionNumber, 'QI_CREATED', null, 'DRAFT', actorId, undefined, tx)
    if (grn) await tx.goodsReceipt.updateMany({ where: { id: grn.id, tenantId, deletedAt: null }, data: { status: 'QC_PENDING', updatedById: actorId } })
    return row
  })
  return mapQualityInspection(created)
}

export async function updateQualityInspection(tenantId: string, id: string, actorId: string, input: UpdateQualityInspectionInput) {
  const existing = await loadOrThrow(tenantId, id); assertQiEditable(existing.status)
  const lines = input.lines ? buildQiLines(input.lines) : undefined
  if (lines && existing.goodsReceiptId) {
    const grn = await loadGrn(tenantId, existing.goodsReceiptId)
    const ids = new Set(grn!.lines.map((line) => line.id))
    if (lines.some((line) => line.goodsReceiptLineId && !ids.has(line.goodsReceiptLineId))) throw new QualityInspectionValidationError('Inspection line does not belong to its goods receipt.')
  }
  await prisma.$transaction(async (tx) => {
    if (lines) await repo.replaceQualityInspectionLines(tenantId, id, lines, tx)
    await repo.updateQualityInspection(tenantId, id, {
      status: existing.status === 'DRAFT' ? 'IN_PROGRESS' : existing.status, updatedById: actorId,
      ...(input.inspectionDate !== undefined ? { inspectionDate: qiDate(input.inspectionDate) ?? existing.inspectionDate } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
      ...(input.inspectedById !== undefined ? { inspectedById: input.inspectedById } : {}),
      ...(input.inspectedByName !== undefined ? { inspectedByName: input.inspectedByName } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() || null } : {}),
      ...(input.deviationRemarks !== undefined ? { deviationRemarks: input.deviationRemarks?.trim() || null } : {}),
    }, tx)
    await repo.addQiHistory(tenantId, id, existing.inspectionNumber, 'QI_UPDATED', existing.status, existing.status === 'DRAFT' ? 'IN_PROGRESS' : existing.status, actorId, undefined, tx)
  })
  return mapQualityInspection(await loadOrThrow(tenantId, id))
}

export async function completeQualityInspection(
  tenantId: string, id: string, actorId: string,
  body: { outcome?: 'AUTO' | 'ACCEPT' | 'REJECT'; remarks?: string; deviationRemarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(existing.status)) throw new QualityInspectionWorkflowError(`Quality inspection cannot be completed from ${existing.status}.`)
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  let lines = existing.lines.map((line) => ({
    ...line, inspectedQuantity: qiQty(line.inspectedQuantity), acceptedQuantity: qiQty(line.acceptedQuantity),
    rejectedQuantity: qiQty(line.rejectedQuantity), deviationQuantity: qiQty(line.deviationQuantity),
  }))
  if (body.outcome === 'ACCEPT') lines = lines.map((line) => ({ ...line, acceptedQuantity: line.inspectedQuantity, rejectedQuantity: 0, deviationQuantity: 0 }))
  if (body.outcome === 'REJECT') lines = lines.map((line) => ({ ...line, acceptedQuantity: 0, rejectedQuantity: line.inspectedQuantity, deviationQuantity: 0 }))
  validateQiLines(lines)
  const rejected = lines.reduce((sum, line) => sum + line.rejectedQuantity, 0)
  const deviations = lines.reduce((sum, line) => sum + line.deviationQuantity, 0)
  if (deviations && !body.deviationRemarks?.trim() && !existing.deviationRemarks?.trim()) throw new QualityInspectionValidationError('Deviation remarks are required.')
  if (deviations && !defaults.allowAcceptanceUnderDeviation) {
    const role = defaults.deviationApproverRole ? ` Approval by ${defaults.deviationApproverRole} is required.` : ''
    await transitionQi(tenantId, existing, actorId, 'DEVIATION_PENDING', 'QI_DEVIATION_PENDING', `${body.remarks ?? ''}${role}`.trim())
    return mapQualityInspection(await loadOrThrow(tenantId, id))
  }
  if (rejected && defaults.allowRejectedStockInQuarantine && !defaults.defaultRejectedLocationId && !defaults.defaultQualityHoldLocationId) {
    throw new QualityInspectionValidationError('Configure a rejected or quality-hold location before quarantining rejected stock.')
  }
  const accepted = lines.reduce((sum, line) => sum + line.acceptedQuantity + (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0), 0)
  const status: QualityInspectionStatus = rejected && accepted ? 'PARTIALLY_ACCEPTED' : rejected ? 'REJECTED' : 'ACCEPTED'
  const grn = existing.goodsReceiptId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: existing.goodsReceiptId, tenantId, deletedAt: null },
        include: { lines: true },
      })
    : null
  const grnLineById = new Map(grn?.lines.map((line) => [line.id, line]) ?? [])
  const qiInwardMovements = await prisma.$transaction(async (tx) => {
    const inwardMovements: Awaited<ReturnType<typeof postGrnStockInward>> = []
    if (grn) {
      // Compatibility for QC-pending GRNs created before status buckets shipped.
      inwardMovements.push(...await postGrnStockInward({
        tenantId,
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        warehouseId: grn.warehouseId,
        lines: grn.lines,
        useAcceptedQuantity: true,
        actorId,
        tx,
      }))
      for (const line of lines) {
        if (!line.goodsReceiptLineId || !line.itemId) continue
        const source = grnLineById.get(line.goodsReceiptLineId)
        if (!source) continue
        const acceptedQty =
          line.acceptedQuantity +
          (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0)
        if (acceptedQty > 0) {
          await InventoryPostingService.transferStatus({
            tenantId,
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            fromStockStatus: 'QC_HOLD',
            stockStatus: 'UNRESTRICTED',
            quantity: acceptedQty,
            referenceType: 'QUALITY_RELEASE',
            referenceNo: existing.inspectionNumber,
            remarks: `QI accepted from ${grn.grnNumber}`,
            idempotencyKey: `qi-release:${id}:${line.id}`,
            batchNumber: source.batchNumber ?? undefined,
            serialNumber: source.serialNumber ?? undefined,
            createdBy: actorId,
          }, tx)
        }
        if (line.rejectedQuantity > 0) {
          await InventoryPostingService.transferStatus({
            tenantId,
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            fromStockStatus: 'QC_HOLD',
            stockStatus: 'REJECTED',
            quantity: line.rejectedQuantity,
            referenceType: 'QUALITY_REJECT',
            referenceNo: existing.inspectionNumber,
            remarks: `QI rejected from ${grn.grnNumber}`,
            idempotencyKey: `qi-reject:${id}:${line.id}`,
            batchNumber: source.batchNumber ?? undefined,
            serialNumber: source.serialNumber ?? undefined,
            createdBy: actorId,
          }, tx)
        }
      }
    }
    await repo.replaceQualityInspectionLines(tenantId, id, lines.map((line) => ({
      lineNumber: line.lineNumber, goodsReceiptLineId: line.goodsReceiptLineId, purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId, itemCodeSnapshot: line.itemCodeSnapshot, itemNameSnapshot: line.itemNameSnapshot,
      inspectedQuantity: line.inspectedQuantity, acceptedQuantity: line.acceptedQuantity,
      rejectedQuantity: line.rejectedQuantity, deviationQuantity: line.deviationQuantity, remarks: line.remarks,
    })), tx)
    await repo.updateQualityInspection(tenantId, id, {
      status, completedAt: new Date(), updatedById: actorId,
      remarks: body.remarks?.trim() || existing.remarks,
      deviationRemarks: body.deviationRemarks?.trim() || existing.deviationRemarks,
    }, tx)
    for (const line of lines.filter((item) => item.goodsReceiptLineId)) {
      await tx.goodsReceiptLine.updateMany({ where: { id: line.goodsReceiptLineId!, tenantId }, data: {
        acceptedQuantity: line.acceptedQuantity + (defaults.allowAcceptanceUnderDeviation ? line.deviationQuantity : 0),
        rejectedQuantity: line.rejectedQuantity,
      } })
    }
    if (existing.goodsReceiptId) await tx.goodsReceipt.updateMany({ where: { id: existing.goodsReceiptId, tenantId, deletedAt: null }, data: {
      status: 'INVENTORY_POSTED',
      updatedById: actorId,
    } })
    await repo.addQiHistory(tenantId, id, existing.inspectionNumber, 'QI_COMPLETED', existing.status, status, actorId, body.remarks, tx)
    return inwardMovements
  })
  if (grn) {
    await tryRecordInventoryAccountingEventsForMovements(null, tenantId, qiInwardMovements, {
      sourceDocumentType: 'GOODS_RECEIPT',
      sourceDocumentId: grn.id,
      narration: `GRN inward ${grn.grnNumber} (via QI ${existing.inspectionNumber})`,
      userId: actorId,
    })
  }
  return mapQualityInspection(await loadOrThrow(tenantId, id))
}

async function transitionQi(tenantId: string, existing: Awaited<ReturnType<typeof loadOrThrow>>, actorId: string, status: QualityInspectionStatus, action: string, remarks?: string) {
  await prisma.$transaction(async (tx) => {
    await repo.updateQualityInspection(tenantId, existing.id, { status, updatedById: actorId, remarks: remarks?.trim() || existing.remarks }, tx)
    await repo.addQiHistory(tenantId, existing.id, existing.inspectionNumber, action, existing.status, status, actorId, remarks, tx)
  })
}
export async function cancelQualityInspection(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertQiEditable(existing.status)
  await transitionQi(tenantId, existing, actorId, 'CANCELLED', 'QI_CANCELLED', body.remarks)
  return mapQualityInspection(await loadOrThrow(tenantId, id))
}
