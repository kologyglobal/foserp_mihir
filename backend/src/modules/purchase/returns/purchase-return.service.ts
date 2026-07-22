import type { Prisma, PurchaseReturnStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { postPurchaseReturnStockIssue } from '../shared/purchase-inventory-posting.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { PurchaseReturnNotFoundError, PurchaseReturnValidationError } from './purchase-return.errors.js'
import { mapPurchaseReturn, type PurchaseReturnEnrichment } from './purchase-return.mapper.js'
import * as repo from './purchase-return.repository.js'
import type { CreatePurchaseReturnInput, ListPurchaseReturnsQuery, PurchaseReturnLineInput, UpdatePurchaseReturnInput } from './purchase-return.validation.js'
import { assertReturnStatus, returnDate, returnMoney, returnQty, validateReturnLines } from './purchase-return.workflow.js'

type ReturnRow = NonNullable<Awaited<ReturnType<typeof repo.findPurchaseReturnById>>>

async function enrichmentForReturns(
  tenantId: string,
  rows: Array<{ purchaseOrderId: string | null; goodsReceiptId: string | null; qualityInspectionId: string | null }>,
): Promise<Map<number, PurchaseReturnEnrichment>> {
  const grnIds = [...new Set(rows.map((r) => r.goodsReceiptId).filter(Boolean))] as string[]
  const qiIds = [...new Set(rows.map((r) => r.qualityInspectionId).filter(Boolean))] as string[]
  const [grns, qis] = await Promise.all([
    grnIds.length
      ? prisma.goodsReceipt.findMany({
          where: { tenantId, id: { in: grnIds }, deletedAt: null },
          select: { id: true, grnNumber: true, purchaseOrderId: true },
        })
      : Promise.resolve([]),
    qiIds.length
      ? prisma.qualityInspection.findMany({
          where: { tenantId, id: { in: qiIds }, deletedAt: null },
          select: { id: true, inspectionNumber: true },
        })
      : Promise.resolve([]),
  ])
  const grnById = new Map(grns.map((g) => [g.id, g]))
  const qiById = new Map(qis.map((q) => [q.id, q]))
  const poIds = [
    ...new Set(
      rows
        .map((r) => r.purchaseOrderId ?? (r.goodsReceiptId ? grnById.get(r.goodsReceiptId)?.purchaseOrderId : null))
        .filter(Boolean),
    ),
  ] as string[]
  const pos = poIds.length
    ? await prisma.purchaseOrder.findMany({
        where: { tenantId, id: { in: poIds }, deletedAt: null },
        select: { id: true, orderNumber: true },
      })
    : []
  const poById = new Map(pos.map((p) => [p.id, p]))
  const out = new Map<number, PurchaseReturnEnrichment>()
  rows.forEach((row, index) => {
    const grn = row.goodsReceiptId ? grnById.get(row.goodsReceiptId) : undefined
    const poId = row.purchaseOrderId ?? grn?.purchaseOrderId ?? null
    out.set(index, {
      purchaseOrderNumber: poId ? poById.get(poId)?.orderNumber ?? null : null,
      goodsReceiptNumber: grn?.grnNumber ?? null,
      qualityInspectionNumber: row.qualityInspectionId
        ? qiById.get(row.qualityInspectionId)?.inspectionNumber ?? null
        : null,
    })
  })
  return out
}

async function toReturnDto(tenantId: string, row: ReturnRow) {
  const enrichment = await enrichmentForReturns(tenantId, [row])
  return mapPurchaseReturn(row, enrichment.get(0))
}

async function loadOrThrow(tenantId: string, id: string) {
  const row = await repo.findPurchaseReturnById(tenantId, id)
  if (!row) throw new PurchaseReturnNotFoundError()
  return row
}
async function resolveReturnRefs(tenantId: string, input: Pick<CreatePurchaseReturnInput, 'vendorId' | 'purchaseOrderId' | 'goodsReceiptId' | 'qualityInspectionId' | 'warehouseId' | 'plantId'>) {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  const vendor = await prisma.masterVendor.findFirst({ where: { id: input.vendorId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' } })
  if (!vendor) throw new PurchaseReturnValidationError('Vendor not found or inactive.')
  const po = input.purchaseOrderId ? await prisma.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, ...tenantActiveFilter(tenantId), vendorId: input.vendorId }, include: { lines: true } }) : null
  const grn = input.goodsReceiptId ? await prisma.goodsReceipt.findFirst({ where: { id: input.goodsReceiptId, ...tenantActiveFilter(tenantId), vendorId: input.vendorId }, include: { lines: true } }) : null
  // Purchase QI lives on `QualityInspection` / `quality_inspections` (not a separate PurchaseQualityInspection model).
  const qi = input.qualityInspectionId
    ? await prisma.qualityInspection.findFirst({
        where: {
          id: input.qualityInspectionId,
          ...tenantActiveFilter(tenantId),
          vendorId: input.vendorId,
        },
        include: { lines: true },
      })
    : null
  if (input.purchaseOrderId && !po) throw new PurchaseReturnValidationError('Invalid purchase order.')
  if (input.goodsReceiptId && !grn) throw new PurchaseReturnValidationError('Invalid goods receipt.')
  if (input.qualityInspectionId && !qi) {
    throw new PurchaseReturnValidationError(
      'Invalid quality inspection (not found for this vendor, or inactive).',
    )
  }
  // Inherit PO from GRN when the client only sent goodsReceiptId.
  let resolvedPo = po
  if (!resolvedPo && grn?.purchaseOrderId) {
    resolvedPo = await prisma.purchaseOrder.findFirst({
      where: { id: grn.purchaseOrderId, ...tenantActiveFilter(tenantId), vendorId: input.vendorId },
      include: { lines: true },
    })
  }
  if (resolvedPo && grn && grn.purchaseOrderId !== resolvedPo.id) {
    throw new PurchaseReturnValidationError('Goods receipt does not match purchase order.')
  }
  if (grn && qi && qi.goodsReceiptId !== grn.id) throw new PurchaseReturnValidationError('Quality inspection does not match goods receipt.')
  let warehouseId = input.warehouseId ?? grn?.warehouseId ?? defaults.defaultWarehouseId
  if (defaults.defaultVendorReturnLocationId) {
    const location = await prisma.masterLocation.findFirst({ where: { id: defaults.defaultVendorReturnLocationId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' } })
    if (!location) throw new PurchaseReturnValidationError('Configured vendor-return location is invalid or inactive.')
    if (warehouseId && location.warehouseId !== warehouseId) throw new PurchaseReturnValidationError('Vendor-return location is not in the selected warehouse.')
    warehouseId = warehouseId ?? location.warehouseId
  }
  if (warehouseId) {
    const warehouse = await prisma.masterWarehouse.findFirst({ where: { id: warehouseId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' } })
    if (!warehouse) throw new PurchaseReturnValidationError('Warehouse not found or inactive.')
  }
  return { po: resolvedPo, grn, qi, warehouseId }
}
function buildReturnLines(inputs: PurchaseReturnLineInput[], refs: Awaited<ReturnType<typeof resolveReturnRefs>>) {
  validateReturnLines(inputs)
  const poLines = new Map((refs.po?.lines ?? []).map((line) => [line.id, line]))
  const grnLines = new Map((refs.grn?.lines ?? []).map((line) => [line.id, line]))
  const qiLines = new Map((refs.qi?.lines ?? []).map((line) => [line.goodsReceiptLineId, line]))
  return inputs.map((input, index) => {
    const poLine = input.purchaseOrderLineId ? poLines.get(input.purchaseOrderLineId) : undefined
    const grnLine = input.goodsReceiptLineId ? grnLines.get(input.goodsReceiptLineId) : undefined
    if (input.purchaseOrderLineId && !poLine) throw new PurchaseReturnValidationError(`Invalid PO line ${index + 1}.`)
    if (input.goodsReceiptLineId && !grnLine) throw new PurchaseReturnValidationError(`Invalid GRN line ${index + 1}.`)
    if (poLine && grnLine && grnLine.purchaseOrderLineId !== poLine.id) throw new PurchaseReturnValidationError(`PO/GRN mismatch on line ${index + 1}.`)
    const quantity = returnQty(input.returnQuantity)
    const available = refs.qi
      ? returnQty(qiLines.get(grnLine?.id ?? null)?.rejectedQuantity)
      : grnLine
        ? returnQty(grnLine.acceptedQuantity) + returnQty(grnLine.rejectedQuantity)
        : poLine
          ? returnQty(poLine.receivedQuantity) - returnQty(poLine.returnedQuantity)
          : quantity
    if (quantity > available + 1e-9) {
      throw new PurchaseReturnValidationError(
        refs.qi
          ? `Return quantity exceeds rejected quantity on quality inspection for line ${index + 1} (available ${available}).`
          : `Return quantity exceeds available received/rejected quantity on line ${index + 1} (available ${available}).`,
      )
    }
    const rate = input.rate ?? returnQty(grnLine?.rate ?? poLine?.rate)
    return {
      lineNumber: index + 1, goodsReceiptLineId: grnLine?.id ?? null, purchaseOrderLineId: poLine?.id ?? grnLine?.purchaseOrderLineId ?? null,
      itemId: input.itemId ?? grnLine?.itemId ?? poLine?.itemId ?? null,
      itemCodeSnapshot: input.itemCode || grnLine?.itemCodeSnapshot || poLine?.itemCodeSnapshot || '',
      itemNameSnapshot: input.itemName || grnLine?.itemNameSnapshot || poLine?.itemNameSnapshot || '',
      returnQuantity: quantity, rate, amount: returnMoney(quantity * rate), remarks: input.remarks?.trim() || null,
    }
  })
}
export async function listPurchaseReturns(tenantId: string, query: ListPurchaseReturnsQuery) {
  const result = await repo.findPurchaseReturns(tenantId, query)
  const enrichment = await enrichmentForReturns(tenantId, result.items)
  return {
    ...result,
    items: result.items.map((row, index) => mapPurchaseReturn(row, enrichment.get(index))),
  }
}
export async function getPurchaseReturn(tenantId: string, id: string) {
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function createPurchaseReturn(tenantId: string, actorId: string, input: CreatePurchaseReturnInput) {
  const refs = await resolveReturnRefs(tenantId, input)
  const lines = buildReturnLines(input.lines, refs)
  const returnNumber = await nextCode(tenantId, 'PURCHASE_RETURN')
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseReturn.create({ data: {
      tenantId, returnNumber, returnDate: returnDate(input.returnDate) ?? new Date(), vendorId: input.vendorId,
      purchaseOrderId: refs.po?.id ?? input.purchaseOrderId ?? null, goodsReceiptId: refs.grn?.id ?? input.goodsReceiptId ?? null,
      qualityInspectionId: refs.qi?.id ?? input.qualityInspectionId ?? null, warehouseId: refs.warehouseId,
      status: 'DRAFT', reason: input.reason?.trim() || null, remarks: input.remarks?.trim() || null,
      createdById: actorId, updatedById: actorId, lines: { create: lines.map((line) => ({ ...line, tenantId })) },
    }, include: repo.includePurchaseReturn })
    await repo.addReturnHistory(tenantId, created.id, created.returnNumber, 'RETURN_CREATED', null, 'DRAFT', actorId, undefined, tx)
    return created
  })
  return toReturnDto(tenantId, row)
}
export async function updatePurchaseReturn(tenantId: string, id: string, actorId: string, input: UpdatePurchaseReturnInput) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['DRAFT'], 'updated')
  const refs = await resolveReturnRefs(tenantId, {
    vendorId: input.vendorId ?? existing.vendorId,
    purchaseOrderId: input.purchaseOrderId !== undefined ? input.purchaseOrderId : existing.purchaseOrderId,
    goodsReceiptId: input.goodsReceiptId !== undefined ? input.goodsReceiptId : existing.goodsReceiptId,
    qualityInspectionId: input.qualityInspectionId !== undefined ? input.qualityInspectionId : existing.qualityInspectionId,
    warehouseId: input.warehouseId !== undefined ? input.warehouseId : existing.warehouseId,
    plantId: input.plantId,
  })
  const lines = input.lines ? buildReturnLines(input.lines, refs) : undefined
  await prisma.$transaction(async (tx) => {
    if (lines) await repo.replacePurchaseReturnLines(tenantId, id, lines, tx)
    await repo.updatePurchaseReturn(tenantId, id, {
      vendorId: input.vendorId ?? existing.vendorId, purchaseOrderId: refs.po?.id ?? null, goodsReceiptId: refs.grn?.id ?? null,
      qualityInspectionId: refs.qi?.id ?? null, warehouseId: refs.warehouseId, updatedById: actorId,
      ...(input.returnDate !== undefined ? { returnDate: returnDate(input.returnDate) ?? existing.returnDate } : {}),
      ...(input.reason !== undefined ? { reason: input.reason?.trim() || null } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() || null } : {}),
    }, tx)
    await repo.addReturnHistory(tenantId, id, existing.returnNumber, 'RETURN_UPDATED', existing.status, existing.status, actorId, undefined, tx)
  })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
async function transitionReturn(tenantId: string, existing: Awaited<ReturnType<typeof loadOrThrow>>, actorId: string, status: PurchaseReturnStatus, action: string, remarks?: string, extra: Prisma.PurchaseReturnUncheckedUpdateInput = {}) {
  await prisma.$transaction(async (tx) => {
    await repo.updatePurchaseReturn(tenantId, existing.id, { status, updatedById: actorId, remarks: remarks?.trim() || existing.remarks, ...extra }, tx)
    await repo.addReturnHistory(tenantId, existing.id, existing.returnNumber, action, existing.status, status, actorId, remarks, tx)
  })
}
export async function submitPurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['DRAFT'], 'submitted'); validateReturnLines(existing.lines)
  await transitionReturn(tenantId, existing, actorId, 'SUBMITTED', 'RETURN_SUBMITTED', body.remarks, { submittedAt: new Date() })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function completePurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['SUBMITTED', 'APPROVED', 'SHIPPED'], 'completed')
  const warehouseId = existing.warehouseId
  if (!warehouseId) throw new PurchaseReturnValidationError('Warehouse is required to complete a purchase return.')
  const returnMovements = await prisma.$transaction(async (tx) => {
    for (const line of existing.lines.filter((item) => item.purchaseOrderLineId)) await tx.purchaseOrderLine.updateMany({
      where: { id: line.purchaseOrderLineId!, tenantId }, data: { returnedQuantity: { increment: returnQty(line.returnQuantity) } },
    })
    const movements = await postPurchaseReturnStockIssue({
      tenantId,
      returnId: existing.id,
      returnNumber: existing.returnNumber,
      warehouseId,
      lines: existing.lines,
      actorId,
      tx,
    })
    await repo.updatePurchaseReturn(tenantId, id, { status: 'COMPLETED', completedAt: new Date(), updatedById: actorId, remarks: body.remarks?.trim() || existing.remarks }, tx)
    await repo.addReturnHistory(tenantId, id, existing.returnNumber, 'RETURN_COMPLETED', existing.status, 'COMPLETED', actorId, body.remarks, tx)
    return movements
  })
  // Return issues post with generic ISS reference — pass the explicit event type.
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, returnMovements, {
    eventType: 'PURCHASE_RETURN',
    sourceDocumentType: 'PURCHASE_RETURN',
    sourceDocumentId: existing.id,
    narration: `Purchase return ${existing.returnNumber}`,
    userId: actorId,
  })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function cancelPurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['DRAFT', 'SUBMITTED', 'APPROVED'], 'cancelled')
  await transitionReturn(tenantId, existing, actorId, 'CANCELLED', 'RETURN_CANCELLED', body.remarks, { cancelledAt: new Date() })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
