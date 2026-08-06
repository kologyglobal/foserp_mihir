import type { Prisma, PurchaseReturnStatus } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { postPurchaseReturnStockIssue } from '../shared/purchase-inventory-posting.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import {
  buildPurchaseReturnApAdjustmentPreview,
  handoffPurchaseReturnToVendorAdjustmentDraft,
} from './purchase-return-ap-handoff.service.js'
import { logger } from '../../../config/logger.js'
import { PurchaseReturnNotFoundError, PurchaseReturnValidationError } from './purchase-return.errors.js'
import { mapPurchaseReturn, type PurchaseReturnEnrichment, type PurchaseReturnLineEnrichment } from './purchase-return.mapper.js'
import * as repo from './purchase-return.repository.js'
import type { CreatePurchaseReturnInput, ListPurchaseReturnsQuery, PurchaseReturnLineInput, UpdatePurchaseReturnInput } from './purchase-return.validation.js'
import { assertReturnStatus, returnDate, returnMoney, returnQty, validateReturnLines } from './purchase-return.workflow.js'
import { taxSnapshotFromGrnOrPoLine } from '../shared/purchase-tax-snapshot.js'
import { computeRemainingReturnable } from './returnable-quantity.service.js'

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
      ? prisma.purchaseQualityInspection.findMany({
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

async function lineEnrichmentForReturns(
  tenantId: string,
  rows: Array<{ lines: Array<{ id: string; goodsReceiptLineId: string | null; purchaseOrderLineId: string | null }> }>,
): Promise<Map<string, PurchaseReturnLineEnrichment>> {
  const grnLineIds = [
    ...new Set(
      rows.flatMap((r) => r.lines.map((l) => l.goodsReceiptLineId).filter(Boolean)),
    ),
  ] as string[]
  const poLineIds = [
    ...new Set(
      rows.flatMap((r) => r.lines.map((l) => l.purchaseOrderLineId).filter(Boolean)),
    ),
  ] as string[]

  const [grnLines, poLines] = await Promise.all([
    grnLineIds.length
      ? prisma.goodsReceiptLine.findMany({
          where: { tenantId, id: { in: grnLineIds } },
          select: {
            id: true,
            uomId: true,
            uomCodeSnapshot: true,
            acceptedQuantity: true,
            receivedQuantity: true,
            batchNumber: true,
            lotNumber: true,
            serialNumber: true,
          },
        })
      : Promise.resolve([]),
    poLineIds.length
      ? prisma.purchaseOrderLine.findMany({
          where: { tenantId, id: { in: poLineIds } },
          select: { id: true, uomId: true },
        })
      : Promise.resolve([]),
  ])

  const uomIds = [
    ...new Set(
      [...grnLines.map((l) => l.uomId), ...poLines.map((l) => l.uomId)].filter(Boolean),
    ),
  ] as string[]
  const uoms = uomIds.length
    ? await prisma.masterUom.findMany({
        where: { id: { in: uomIds }, tenantId, deletedAt: null },
        select: { id: true, code: true },
      })
    : []
  const uomById = new Map(uoms.map((u) => [u.id, u.code]))

  const grnById = new Map(grnLines.map((l) => [l.id, l]))
  const poUomByLineId = new Map(poLines.map((l) => [l.id, l.uomId]))

  const resolveUom = (uomId: string | null | undefined, snapshot: string | null | undefined) =>
    (snapshot ?? '').trim() || (uomId ? uomById.get(uomId)?.trim() : '') || ''

  const out = new Map<string, PurchaseReturnLineEnrichment>()
  for (const row of rows) {
    for (const line of row.lines) {
      const grnLine = line.goodsReceiptLineId ? grnById.get(line.goodsReceiptLineId) : undefined
      const poUomId = line.purchaseOrderLineId ? poUomByLineId.get(line.purchaseOrderLineId) : null
      const uomId = grnLine?.uomId ?? poUomId ?? null
      out.set(line.id, {
        uom: grnLine
          ? resolveUom(grnLine.uomId, grnLine.uomCodeSnapshot)
          : resolveUom(poUomId, null),
        uomId,
        receivedQuantity: grnLine
          ? returnQty(grnLine.acceptedQuantity) || returnQty(grnLine.receivedQuantity)
          : 0,
        batchNumber: grnLine?.batchNumber ?? null,
        lotNumber: grnLine?.lotNumber ?? null,
        serialNumber: grnLine?.serialNumber ?? null,
      })
    }
  }
  return out
}

async function toReturnDto(tenantId: string, row: ReturnRow) {
  const enrichment = await enrichmentForReturns(tenantId, [row])
  const lineById = await lineEnrichmentForReturns(tenantId, [row])
  const header = enrichment.get(0) ?? {}
  return mapPurchaseReturn(row, { ...header, lineById })
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
  // Purchase QI lives on `PurchaseQualityInspection` / `purchase_quality_inspections`.
  const qi = input.qualityInspectionId
    ? await prisma.purchaseQualityInspection.findFirst({
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
function buildReturnLines(
  inputs: PurchaseReturnLineInput[],
  refs: Awaited<ReturnType<typeof resolveReturnRefs>>,
  remainingByKey?: Map<string, number>,
  opts?: { requireReturnableCap?: boolean },
) {
  validateReturnLines(inputs)
  const requireCap = opts?.requireReturnableCap !== false
  const poLines = new Map((refs.po?.lines ?? []).map((line) => [line.id, line]))
  const grnLines = new Map((refs.grn?.lines ?? []).map((line) => [line.id, line]))
  const qiLines = new Map((refs.qi?.lines ?? []).map((line) => [line.goodsReceiptLineId, line]))
  return inputs.map((input, index) => {
    const poLine = input.purchaseOrderLineId ? poLines.get(input.purchaseOrderLineId) : undefined
    const grnLine = input.goodsReceiptLineId ? grnLines.get(input.goodsReceiptLineId) : undefined
    if (input.purchaseOrderLineId && !poLine) throw new PurchaseReturnValidationError(`Invalid PO line ${index + 1}.`)
    if (input.goodsReceiptLineId && !grnLine) throw new PurchaseReturnValidationError(`Invalid GRN line ${index + 1}.`)
    if (poLine && grnLine && grnLine.purchaseOrderLineId !== poLine.id) {
      throw new PurchaseReturnValidationError(`PO/GRN mismatch on line ${index + 1}.`)
    }
    // Returns must be tied to a received GRN line (never free master items / unreceived PO lines).
    if (!grnLine) {
      throw new PurchaseReturnValidationError(
        `Line ${index + 1}: goods receipt line is required. Only items received on a GRN can be returned.`,
      )
    }
    const quantity = returnQty(input.returnQuantity)
    const key = grnLine.id
    const poKey = grnLine.purchaseOrderLineId ?? poLine?.id ?? null
    let available: number | undefined = remainingByKey?.get(key)
    if (available === undefined && poKey) available = remainingByKey?.get(poKey)
    if (available === undefined) {
      if (requireCap && remainingByKey) {
        // Cap map was computed — missing key means not returnable (or fully returned).
        available = 0
      } else if (refs.qi) {
        available = returnQty(qiLines.get(grnLine.id)?.rejectedQuantity)
      } else {
        available =
          returnQty(grnLine.acceptedQuantity) + returnQty(grnLine.rejectedQuantity) ||
          returnQty(grnLine.receivedQuantity)
      }
    }
    if (quantity > available + 1e-9) {
      throw new PurchaseReturnValidationError(
        `Return quantity exceeds remaining returnable quantity on line ${index + 1} (available ${available}).`,
      )
    }
    if (available <= 0) {
      throw new PurchaseReturnValidationError(
        `Line ${index + 1} has no remaining returnable quantity (item must be received on GRN).`,
      )
    }
    const rate = input.rate ?? returnQty(grnLine.rate ?? poLine?.rate)
    const taxSnap = taxSnapshotFromGrnOrPoLine(grnLine, poLine)
    return {
      lineNumber: index + 1,
      goodsReceiptLineId: grnLine.id,
      purchaseOrderLineId: poLine?.id ?? grnLine.purchaseOrderLineId ?? null,
      itemId: input.itemId ?? grnLine.itemId ?? poLine?.itemId ?? null,
      itemCodeSnapshot: input.itemCode || grnLine.itemCodeSnapshot || poLine?.itemCodeSnapshot || '',
      itemNameSnapshot: input.itemName || grnLine.itemNameSnapshot || poLine?.itemNameSnapshot || '',
      returnQuantity: quantity,
      rate,
      amount: returnMoney(quantity * rate),
      remarks: input.remarks?.trim() || null,
      hsnIdSnapshot: taxSnap?.hsnIdSnapshot ?? null,
      hsnCodeSnapshot: taxSnap?.hsnCodeSnapshot ?? '',
      gstGroupIdSnapshot: taxSnap?.gstGroupIdSnapshot ?? null,
      gstGroupCodeSnapshot: taxSnap?.gstGroupCodeSnapshot ?? '',
      gstRatePctSnapshot: taxSnap?.gstRatePctSnapshot ?? 0,
      cgstRateSnapshot: taxSnap?.cgstRateSnapshot ?? 0,
      sgstRateSnapshot: taxSnap?.sgstRateSnapshot ?? 0,
      igstRateSnapshot: taxSnap?.igstRateSnapshot ?? 0,
      gstSchemeSnapshot: taxSnap?.gstSchemeSnapshot ?? 'cgst_sgst',
    }
  })
}

function remainingMapFromReturnable(
  returnable: Awaited<ReturnType<typeof computeRemainingReturnable>>,
): Map<string, number> {
  const remainingByKey = new Map<string, number>()
  for (const l of returnable.lines) {
    if (l.goodsReceiptLineId) {
      remainingByKey.set(l.goodsReceiptLineId, l.remainingReturnableQuantity)
    }
    if (l.purchaseOrderLineId) {
      // Prefer GRN line key; PO key only as secondary for legacy line payloads.
      if (!remainingByKey.has(l.purchaseOrderLineId)) {
        remainingByKey.set(l.purchaseOrderLineId, l.remainingReturnableQuantity)
      }
    }
  }
  return remainingByKey
}
export async function listPurchaseReturns(tenantId: string, query: ListPurchaseReturnsQuery) {
  const result = await repo.findPurchaseReturns(tenantId, query)
  const enrichment = await enrichmentForReturns(tenantId, result.items)
  const lineById = await lineEnrichmentForReturns(tenantId, result.items)
  return {
    ...result,
    items: result.items.map((row, index) =>
      mapPurchaseReturn(row, { ...(enrichment.get(index) ?? {}), lineById }),
    ),
  }
}
export async function getPurchaseReturn(tenantId: string, id: string) {
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function createPurchaseReturn(tenantId: string, actorId: string, input: CreatePurchaseReturnInput) {
  if (!input.reason?.trim()) throw new PurchaseReturnValidationError('Return reason is required.')
  if (!input.goodsReceiptId && !input.qualityInspectionId) {
    throw new PurchaseReturnValidationError(
      'Select a goods receipt or quality inspection. Purchase returns only use received GRN / QI quantities.',
    )
  }
  const refs = await resolveReturnRefs(tenantId, input)
  let { grn, qi, po, warehouseId } = refs
  if (!grn && !qi) {
    throw new PurchaseReturnValidationError('Goods receipt or quality inspection is required.')
  }
  // QI-only clients must resolve to the linked GRN so lines can bind goodsReceiptLineId.
  if (qi && !grn && qi.goodsReceiptId) {
    const linkedGrn = await prisma.goodsReceipt.findFirst({
      where: {
        id: qi.goodsReceiptId,
        ...tenantActiveFilter(tenantId),
        vendorId: input.vendorId,
      },
      include: { lines: true },
    })
    if (!linkedGrn) {
      throw new PurchaseReturnValidationError('Quality inspection is not linked to a valid goods receipt.')
    }
    grn = linkedGrn
  }
  if (!grn) {
    throw new PurchaseReturnValidationError('A goods receipt is required to return items.')
  }
  if (grn.status === 'CANCELLED') {
    throw new PurchaseReturnValidationError('Cannot create a return for a cancelled goods receipt.')
  }
  const returnable = await computeRemainingReturnable(tenantId, {
    qualityInspectionId: input.qualityInspectionId ?? qi?.id,
    goodsReceiptId: grn.id,
  })
  if (returnable.closedForReturn) {
    throw new PurchaseReturnValidationError('Goods receipt is closed for returns.')
  }
  const remainingByKey = remainingMapFromReturnable(returnable)
  if (![...remainingByKey.values()].some((q) => q > 0)) {
    throw new PurchaseReturnValidationError('No remaining returnable quantity on this GRN/QI.')
  }
  const lines = buildReturnLines(
    input.lines,
    { po, grn, qi, warehouseId },
    remainingByKey,
    { requireReturnableCap: true },
  )
  if (lines.every((l) => l.returnQuantity <= 0)) {
    throw new PurchaseReturnValidationError('No remaining returnable quantity.')
  }
  const returnNumber = await nextCode(tenantId, 'PURCHASE_RETURN')
  const returnType = input.returnType ?? 'CREDIT'
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseReturn.create({ data: {
      tenantId, returnNumber, returnDate: returnDate(input.returnDate) ?? new Date(), vendorId: input.vendorId,
      purchaseOrderId: po?.id ?? input.purchaseOrderId ?? null, goodsReceiptId: grn.id,
      qualityInspectionId: qi?.id ?? input.qualityInspectionId ?? null, warehouseId,
      status: 'DRAFT',
      returnType,
      decisionCode: input.decisionCode?.trim() || qi?.decisionCode || null,
      ncrId: input.ncrId ?? null,
      replacedReturnId: input.replacedReturnId ?? null,
      accountingStatus: 'NONE',
      reason: input.reason.trim(),
      remarks: input.remarks?.trim() || null,
      createdById: actorId, updatedById: actorId, lines: { create: lines.map((line) => ({ ...line, tenantId })) },
    }, include: repo.includePurchaseReturn })
    await repo.addReturnHistory(tenantId, created.id, created.returnNumber, 'RETURN_CREATED', null, 'DRAFT', actorId, undefined, tx)
    return created
  })
  return toReturnDto(tenantId, row)
}
export async function updatePurchaseReturn(tenantId: string, id: string, actorId: string, input: UpdatePurchaseReturnInput) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['DRAFT'], 'updated')
  const vendorId = input.vendorId ?? existing.vendorId
  const goodsReceiptId =
    input.goodsReceiptId !== undefined ? input.goodsReceiptId : existing.goodsReceiptId
  const qualityInspectionId =
    input.qualityInspectionId !== undefined ? input.qualityInspectionId : existing.qualityInspectionId
  if (!goodsReceiptId && !qualityInspectionId) {
    throw new PurchaseReturnValidationError(
      'Select a goods receipt or quality inspection. Purchase returns only use received GRN / QI quantities.',
    )
  }
  const refs = await resolveReturnRefs(tenantId, {
    vendorId,
    purchaseOrderId: input.purchaseOrderId !== undefined ? input.purchaseOrderId : existing.purchaseOrderId,
    goodsReceiptId,
    qualityInspectionId,
    warehouseId: input.warehouseId !== undefined ? input.warehouseId : existing.warehouseId,
    plantId: input.plantId,
  })
  let { grn, qi, po, warehouseId } = refs
  if (qi && !grn && qi.goodsReceiptId) {
    const linkedGrn = await prisma.goodsReceipt.findFirst({
      where: {
        id: qi.goodsReceiptId,
        ...tenantActiveFilter(tenantId),
        vendorId,
      },
      include: { lines: true },
    })
    if (linkedGrn) grn = linkedGrn
  }
  if (!grn) {
    throw new PurchaseReturnValidationError('A goods receipt is required to return items.')
  }
  let lines = undefined as ReturnType<typeof buildReturnLines> | undefined
  if (input.lines) {
    const returnable = await computeRemainingReturnable(tenantId, {
      qualityInspectionId: qualityInspectionId ?? qi?.id,
      goodsReceiptId: grn.id,
      excludeReturnId: id,
    })
    if (returnable.closedForReturn) {
      throw new PurchaseReturnValidationError('Goods receipt is closed for returns.')
    }
    const remainingByKey = remainingMapFromReturnable(returnable)
    lines = buildReturnLines(
      input.lines,
      { po, grn, qi, warehouseId },
      remainingByKey,
      { requireReturnableCap: true },
    )
  }
  await prisma.$transaction(async (tx) => {
    if (lines) await repo.replacePurchaseReturnLines(tenantId, id, lines, tx)
    await repo.updatePurchaseReturn(tenantId, id, {
      vendorId,
      purchaseOrderId: po?.id ?? null,
      goodsReceiptId: grn?.id ?? null,
      qualityInspectionId: qi?.id ?? null,
      warehouseId,
      updatedById: actorId,
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
  const existing = await loadOrThrow(tenantId, id)
  assertReturnStatus(existing.status, ['DRAFT'], 'submitted')
  validateReturnLines(existing.lines)
  const settings = await resolveEffectivePurchaseDefaults(tenantId, existing.plantId)
  const totalQty = existing.lines.reduce((s, l) => s + returnQty(l.returnQuantity), 0)
  const totalValue = existing.lines.reduce(
    (s, l) => s + returnQty(l.returnQuantity) * returnMoney(l.rate),
    0,
  )
  const qtyThreshold = settings.returnApprovalQtyThreshold
  const valueThreshold = settings.returnApprovalValueThreshold
  const overQtyThreshold = qtyThreshold != null && totalQty > Number(qtyThreshold)
  const overValueThreshold = valueThreshold != null && totalValue > Number(valueThreshold)
  const needsManagerApproval =
    settings.requireReturnApproval && (overQtyThreshold || overValueThreshold)
  if (needsManagerApproval) {
    await transitionReturn(tenantId, existing, actorId, 'SUBMITTED', 'RETURN_SUBMITTED', body.remarks, {
      submittedAt: new Date(),
    })
  } else {
    await transitionReturn(tenantId, existing, actorId, 'APPROVED', 'RETURN_APPROVED', body.remarks, {
      submittedAt: new Date(),
    })
  }
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function approvePurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id)
  assertReturnStatus(existing.status, ['SUBMITTED'], 'approved')
  await transitionReturn(tenantId, existing, actorId, 'APPROVED', 'RETURN_APPROVED', body.remarks)
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}

/** SHIPPED = RETURN_IN_TRANSIT (stock BLOCKED from REJECTED). */
export async function shipPurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id)
  assertReturnStatus(existing.status, ['APPROVED'], 'shipped')
  const warehouseId = existing.warehouseId
  if (!warehouseId) throw new PurchaseReturnValidationError('Warehouse is required to ship a purchase return.')
  await prisma.$transaction(async (tx) => {
    await postPurchaseReturnStockIssue({
      tenantId,
      returnId: existing.id,
      returnNumber: existing.returnNumber,
      warehouseId,
      lines: existing.lines,
      actorId,
      phase: 'SHIP',
      tx,
    })
    await repo.updatePurchaseReturn(
      tenantId,
      id,
      {
        status: 'SHIPPED',
        shippedAt: new Date(),
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    await repo.addReturnHistory(
      tenantId,
      id,
      existing.returnNumber,
      'RETURN_SHIPPED',
      existing.status,
      'SHIPPED',
      actorId,
      body.remarks,
      tx,
    )
  })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function completePurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['APPROVED', 'SHIPPED'], 'completed')
  const warehouseId = existing.warehouseId
  if (!warehouseId) throw new PurchaseReturnValidationError('Warehouse is required to complete a purchase return.')
  // Re-validate remaining returnable against concurrent returns
  if (existing.qualityInspectionId || existing.goodsReceiptId) {
    const returnable = await computeRemainingReturnable(tenantId, {
      qualityInspectionId: existing.qualityInspectionId,
      goodsReceiptId: existing.goodsReceiptId,
      excludeReturnId: existing.id,
    })
    for (const line of existing.lines) {
      const key = line.goodsReceiptLineId ?? line.purchaseOrderLineId
      if (!key) continue
      const match = returnable.lines.find(
        (r) => r.goodsReceiptLineId === line.goodsReceiptLineId || r.purchaseOrderLineId === line.purchaseOrderLineId,
      )
      if (match && returnQty(line.returnQuantity) > match.remainingReturnableQuantity + 1e-9) {
        throw new PurchaseReturnValidationError(
          `Line exceeds remaining returnable quantity (available ${match.remainingReturnableQuantity}).`,
        )
      }
    }
  }
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
      phase: 'COMPLETE',
      tx,
    })
    await repo.updatePurchaseReturn(tenantId, id, {
      status: 'COMPLETED',
      completedAt: new Date(),
      updatedById: actorId,
      remarks: body.remarks?.trim() || existing.remarks,
    }, tx)
    await repo.addReturnHistory(tenantId, id, existing.returnNumber, 'RETURN_COMPLETED', existing.status, 'COMPLETED', actorId, body.remarks, tx)
    return movements
  })
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, returnMovements, {
    eventType: 'PURCHASE_RETURN',
    sourceDocumentType: 'PURCHASE_RETURN',
    sourceDocumentId: existing.id,
    narration: `Purchase return ${existing.returnNumber}`,
    userId: actorId,
  })
  // AP handoff: CREDIT (and repairs that reverse AP) create Vendor Debit draft. REPLACEMENT does not post GL here.
  if (existing.returnType === 'CREDIT' || existing.returnType === 'REPAIR' || existing.returnType === 'SCRAP_VENDOR') {
    try {
      const handoff = await handoffPurchaseReturnToVendorAdjustmentDraft(tenantId, id, actorId)
      const accountingStatus = handoff.skipped
        ? 'NONE'
        : handoff.status === 'POSTED'
          ? 'POSTED'
          : 'DRAFT'
      await repo.updatePurchaseReturn(tenantId, id, {
        accountingStatus,
        updatedById: actorId,
      })
    } catch (error) {
      logger.error('Purchase return AP adjustment handoff failed', {
        tenantId,
        purchaseReturnId: id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function getPurchaseReturnApAdjustmentPreview(tenantId: string, id: string) {
  return buildPurchaseReturnApAdjustmentPreview(tenantId, id)
}

export async function createPurchaseReturnApAdjustment(tenantId: string, id: string, actorId: string) {
  const result = await handoffPurchaseReturnToVendorAdjustmentDraft(tenantId, id, actorId)
  if (!result.skipped) {
    await repo.updatePurchaseReturn(tenantId, id, {
      accountingStatus: result.status === 'POSTED' ? 'POSTED' : 'DRAFT',
      updatedById: actorId,
    })
  }
  return result
}

export async function getReturnWizardPrefill(
  tenantId: string,
  query: { qualityInspectionId?: string; goodsReceiptId?: string },
) {
  const returnable = await computeRemainingReturnable(tenantId, query)
  if (!returnable.vendorId) throw new PurchaseReturnValidationError('Cannot prefill — no vendor resolved from QI/GRN.')
  const qi = returnable.qualityInspectionId
    ? await prisma.purchaseQualityInspection.findFirst({
        where: { id: returnable.qualityInspectionId, tenantId, deletedAt: null },
        select: {
          inspectionNumber: true,
          decisionCode: true,
          decisionReason: true,
          remarks: true,
          result: true,
        },
      })
    : null
  return {
    ...returnable,
    suggestedReturnType:
      qi?.decisionCode === 'REPLACEMENT_REQUIRED' ? 'REPLACEMENT' : 'CREDIT',
    reason: qi?.decisionReason || qi?.remarks || 'Rejected on quality inspection',
    qualityInspectionNumber: qi?.inspectionNumber ?? null,
    linesPrefill: returnable.lines
      .filter((l) => l.remainingReturnableQuantity > 0)
      .map((l) => ({
        goodsReceiptLineId: l.goodsReceiptLineId,
        purchaseOrderLineId: l.purchaseOrderLineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        returnQuantity: l.remainingReturnableQuantity,
        rate: l.rate,
        batchNumber: l.batchNumber,
        serialNumber: l.serialNumber,
        remainingReturnableQuantity: l.remainingReturnableQuantity,
      })),
  }
}

/** Link a replacement GRN to a completed REPLACEMENT return. */
export async function linkReplacementGoodsReceipt(
  tenantId: string,
  returnId: string,
  actorId: string,
  goodsReceiptId: string,
) {
  const existing = await loadOrThrow(tenantId, returnId)
  if (existing.returnType !== 'REPLACEMENT') {
    throw new PurchaseReturnValidationError('Only REPLACEMENT returns can link a replacement GRN.')
  }
  if (existing.status !== 'COMPLETED') {
    throw new PurchaseReturnValidationError('Return must be completed before linking replacement receipt.')
  }
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id: goodsReceiptId, tenantId, deletedAt: null, vendorId: existing.vendorId },
  })
  if (!grn) throw new PurchaseReturnValidationError('Replacement goods receipt not found for this vendor.')
  await repo.updatePurchaseReturn(tenantId, returnId, {
    replacementGoodsReceiptId: grn.id,
    updatedById: actorId,
  })
  await repo.addReturnHistory(
    tenantId,
    returnId,
    existing.returnNumber,
    'RETURN_REPLACEMENT_LINKED',
    existing.status,
    existing.status,
    actorId,
    `Replacement GRN ${grn.grnNumber}`,
    prisma,
  )
  return toReturnDto(tenantId, await loadOrThrow(tenantId, returnId))
}

/**
 * Traceability chain for return / QI / GRN document family.
 */
export async function getSupplierQualityTrace(tenantId: string, args: {
  purchaseReturnId?: string
  qualityInspectionId?: string
  goodsReceiptId?: string
}) {
  let ret = args.purchaseReturnId
    ? await repo.findPurchaseReturnById(tenantId, args.purchaseReturnId)
    : null
  const qiId = args.qualityInspectionId ?? ret?.qualityInspectionId
  const grnId = args.goodsReceiptId ?? ret?.goodsReceiptId
  const qi = qiId
    ? await prisma.purchaseQualityInspection.findFirst({ where: { id: qiId, tenantId, deletedAt: null } })
    : null
  const grn = grnId
    ? await prisma.goodsReceipt.findFirst({ where: { id: grnId, tenantId, deletedAt: null } })
    : null
  if (!ret && qi) {
    ret = await prisma.purchaseReturn.findFirst({
      where: { tenantId, deletedAt: null, qualityInspectionId: qi.id },
      orderBy: { createdAt: 'desc' },
      include: { lines: true },
    })
  }
  const po = grn?.purchaseOrderId
    ? await prisma.purchaseOrder.findFirst({
        where: { id: grn.purchaseOrderId, tenantId, deletedAt: null },
        select: { id: true, orderNumber: true, purchaseRequisitionId: true },
      })
    : null
  const adj = ret?.vendorAdjustmentId
    ? await prisma.vendorAdjustment.findFirst({
        where: { id: ret.vendorAdjustmentId, tenantId },
        select: { id: true, draftReference: true, status: true, vendorAdjustmentNumber: true },
      })
    : null
  const replacementGrn = ret?.replacementGoodsReceiptId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: ret.replacementGoodsReceiptId, tenantId, deletedAt: null },
        select: { id: true, grnNumber: true, status: true },
      })
    : null
  const replacementQi = replacementGrn
    ? await prisma.purchaseQualityInspection.findFirst({
        where: { tenantId, deletedAt: null, goodsReceiptId: replacementGrn.id },
        select: { id: true, inspectionNumber: true, status: true },
      })
    : null
  const ncr = ret?.ncrId
    ? await prisma.qualityNcr.findFirst({
        where: { id: ret.ncrId, tenantId },
        select: { id: true, ncrNumber: true, status: true },
      })
    : null

  return {
    chain: [
      po?.purchaseRequisitionId ? { type: 'PR', id: po.purchaseRequisitionId, number: null } : null,
      po ? { type: 'PO', id: po.id, number: po.orderNumber } : null,
      grn ? { type: 'GRN', id: grn.id, number: grn.grnNumber, status: grn.status } : null,
      qi
        ? {
            type: 'PURCHASE_QI',
            id: qi.id,
            number: qi.inspectionNumber,
            status: qi.status,
            decision: qi.decisionCode,
            result: qi.result,
          }
        : null,
      ret
        ? {
            type: 'PURCHASE_RETURN',
            id: ret.id,
            number: ret.returnNumber,
            status: ret.status,
            returnType: ret.returnType,
            accountingStatus: ret.accountingStatus,
          }
        : null,
      adj
        ? {
            type: 'VENDOR_ADJUSTMENT',
            id: adj.id,
            number: adj.vendorAdjustmentNumber || adj.draftReference,
            status: adj.status,
          }
        : null,
      replacementGrn
        ? { type: 'REPLACEMENT_GRN', id: replacementGrn.id, number: replacementGrn.grnNumber, status: replacementGrn.status }
        : null,
      replacementQi
        ? { type: 'REPLACEMENT_QI', id: replacementQi.id, number: replacementQi.inspectionNumber, status: replacementQi.status }
        : null,
      ncr ? { type: 'NCR', id: ncr.id, number: ncr.ncrNumber, status: ncr.status } : null,
    ].filter(Boolean),
  }
}
export async function cancelPurchaseReturn(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertReturnStatus(existing.status, ['DRAFT', 'SUBMITTED', 'APPROVED'], 'cancelled')
  await transitionReturn(tenantId, existing, actorId, 'CANCELLED', 'RETURN_CANCELLED', body.remarks, { cancelledAt: new Date() })
  return toReturnDto(tenantId, await loadOrThrow(tenantId, id))
}
