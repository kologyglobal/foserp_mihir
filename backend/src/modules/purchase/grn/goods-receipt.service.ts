import type { GoodsReceiptStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import {
  nextPurchaseDocumentNumber,
  previewPurchaseDocumentNumber,
} from '../shared/purchase-document-number.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  deriveReceiptStatus,
  PO_RECEIVABLE_STATUSES,
} from '../orders/purchase-order.workflow.js'
import {
  GoodsReceiptNotFoundError,
  GoodsReceiptValidationError,
  GoodsReceiptWorkflowError,
} from './goods-receipt.errors.js'
import { mapGoodsReceiptToDto, mapReceivableLineDto } from './goods-receipt.mapper.js'
import * as repo from './goods-receipt.repository.js'
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptLineInput,
  ListGoodsReceiptsQuery,
  UpdateGoodsReceiptInput,
} from './goods-receipt.validation.js'
import {
  assertCancellable,
  assertEditable,
  assertReversible,
  assertSubmittable,
  money,
  parseDateInput,
  qty,
} from './goods-receipt.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const grn = await repo.findGoodsReceiptById(tenantId, id)
  if (!grn || grn.deletedAt) throw new GoodsReceiptNotFoundError()
  return grn
}

async function loadReceivablePo(tenantId: string, purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, ...tenantActiveFilter(tenantId) },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      vendor: { select: { id: true, code: true, name: true, gstin: true, status: true } },
    },
  })
  if (!po || po.deletedAt) {
    throw new GoodsReceiptWorkflowError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_NOT_FOUND),
      PURCHASE_ERROR_CODE.PO_NOT_FOUND,
    )
  }
  if (!PO_RECEIVABLE_STATUSES.includes(po.status)) {
    throw new GoodsReceiptWorkflowError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_PO_NOT_RECEIVABLE),
      PURCHASE_ERROR_CODE.GRN_PO_NOT_RECEIVABLE,
    )
  }
  return po
}

async function assertWarehouseActive(tenantId: string, warehouseId: string) {
  const wh = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
  })
  if (!wh) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED,
      [{ field: 'warehouseId', message: 'Warehouse not found or inactive' }],
    )
  }
  return wh
}

async function resolveStorageLocation(
  tenantId: string,
  warehouseId: string,
  storageLocationId: string | null | undefined,
) {
  if (!storageLocationId) return null
  const loc = await prisma.masterLocation.findFirst({
    where: {
      id: storageLocationId,
      warehouseId,
      ...tenantActiveFilter(tenantId),
      status: 'ACTIVE',
    },
  })
  if (!loc) {
    throw new GoodsReceiptValidationError(
      'Storage location not found under the selected warehouse.',
      PURCHASE_ERROR_CODE.GRN_VALIDATION_FAILED,
      [{ field: 'storageLocationId', message: 'Storage location not found under the selected warehouse.' }],
    )
  }
  return loc
}

async function resolveBin(
  tenantId: string,
  warehouseId: string,
  storageLocationId: string | null | undefined,
  binId: string | null | undefined,
) {
  if (!binId) return null
  const bin = await prisma.masterBin.findFirst({
    where: {
      id: binId,
      warehouseId,
      ...(storageLocationId ? { storageLocationId } : {}),
      ...tenantActiveFilter(tenantId),
      status: 'ACTIVE',
    },
  })
  if (!bin) {
    throw new GoodsReceiptValidationError(
      'BIN not found under the selected warehouse/location.',
      PURCHASE_ERROR_CODE.GRN_VALIDATION_FAILED,
      [{ field: 'binId', message: 'BIN not found under the selected warehouse/location.' }],
    )
  }
  return bin
}

async function buildLineCreates(
  tenantId: string,
  po: Awaited<ReturnType<typeof loadReceivablePo>>,
  headerWarehouseId: string,
  headerStorageLocationId: string | null | undefined,
  allowExcess: boolean,
  overReceiptTolerancePct: number,
  inspectionRequired: boolean,
  lines: GoodsReceiptLineInput[],
): Promise<repo.GrnLineCreateData[]> {
  const poLineById = new Map(po.lines.map((l) => [l.id, l]))
  const uomIds = [...new Set(po.lines.map((l) => l.uomId).filter(Boolean))] as string[]
  const uoms = uomIds.length
    ? await prisma.masterUom.findMany({
        where: { id: { in: uomIds }, tenantId, deletedAt: null },
        select: { id: true, code: true },
      })
    : []
  const uomCode = new Map(uoms.map((u) => [u.id, u.code]))

  const result: repo.GrnLineCreateData[] = []
  for (let i = 0; i < lines.length; i++) {
    const input = lines[i]!
    const poLine = poLineById.get(input.purchaseOrderLineId)
    if (!poLine) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_LINE_PO_MISMATCH),
        PURCHASE_ERROR_CODE.GRN_LINE_PO_MISMATCH,
        [{ field: `lines[${i}].purchaseOrderLineId`, message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_LINE_PO_MISMATCH) }],
      )
    }
    const received = qty(input.receivedQuantity)
    if (!(received > 0)) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_INVALID),
        PURCHASE_ERROR_CODE.GRN_QTY_INVALID,
        [{ field: `lines[${i}].receivedQuantity`, message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_INVALID) }],
      )
    }
    const ordered = qty(poLine.quantity)
    const previously = qty(poLine.receivedQuantity)
    const open = Math.max(0, ordered - previously)
    const excess = Math.max(0, received - open)
    const maxAllowed = open + (allowExcess ? (open * overReceiptTolerancePct) / 100 : 0)
    if (received > maxAllowed + 1e-9) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_EXCEEDS),
        PURCHASE_ERROR_CODE.GRN_QTY_EXCEEDS,
        [{ field: `lines[${i}].receivedQuantity`, message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_EXCEEDS) }],
      )
    }

    const lineWarehouseId = input.warehouseId ?? headerWarehouseId
    const lineStorageId = input.storageLocationId ?? headerStorageLocationId ?? null
    await resolveStorageLocation(tenantId, lineWarehouseId, lineStorageId)
    const bin = await resolveBin(tenantId, lineWarehouseId, lineStorageId, input.binId)

    const rate = qty(poLine.rate)
    const damaged = qty(input.damagedQuantity)
    const short = qty(input.shortQuantity) || Math.max(0, open - received)
    const excessQty = qty(input.excessQuantity) || excess
    const qcRequired = input.qcRequired ?? inspectionRequired
    const acceptedForQc = qty(input.acceptedForQcQuantity) || (qcRequired ? Math.max(0, received - damaged) : 0)
    const accepted = qcRequired ? 0 : Math.max(0, received - damaged)
    const rejected = damaged

    result.push({
      lineNumber: i + 1,
      purchaseOrderLineId: poLine.id,
      itemId: poLine.itemId,
      itemCodeSnapshot: poLine.itemCodeSnapshot,
      itemNameSnapshot: poLine.itemNameSnapshot,
      description: poLine.description,
      uomId: poLine.uomId,
      uomCodeSnapshot: poLine.uomId ? (uomCode.get(poLine.uomId) ?? '') : '',
      orderedQuantity: ordered,
      previouslyReceivedQuantity: previously,
      openQuantity: open,
      challanQuantity: qty(input.challanQuantity) || received,
      receivedQuantity: received,
      damagedQuantity: damaged,
      shortQuantity: short,
      excessQuantity: excessQty,
      acceptedForQcQuantity: acceptedForQc,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      rate,
      amount: money(received * rate),
      warehouseId: lineWarehouseId,
      storageLocationId: lineStorageId,
      binId: bin?.id ?? null,
      binCodeSnapshot: bin?.code ?? '',
      batchNumber: input.batchNumber?.trim() || null,
      heatNumber: input.heatNumber?.trim() || null,
      lotNumber: input.lotNumber?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      manufacturingDate: parseDateInput(input.manufacturingDate ?? undefined) ?? null,
      expiryDate: parseDateInput(input.expiryDate ?? undefined) ?? null,
      qcRequired,
      remarks: input.remarks?.trim() || null,
    })
  }
  return result
}

function assertGrnPolicyFields(
  settings: Awaited<ReturnType<typeof resolveEffectivePurchaseDefaults>>,
  input: {
    vendorChallanNumber?: string | null
    vehicleNumber?: string | null
    gateEntryNumber?: string | null
  },
  lines: Array<{
    lineNumber?: number
    batchNumber?: string | null
    serialNumber?: string | null
    expiryDate?: Date | string | null
  }> = [],
) {
  const errors: Array<{ field: string; message: string }> = []
  if (settings.requireVendorChallan && !input.vendorChallanNumber?.trim()) {
    errors.push({
      field: 'vendorChallanNumber',
      message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_CHALLAN_REQUIRED),
    })
  }
  if (settings.requireVehicleNumber && !input.vehicleNumber?.trim()) {
    errors.push({
      field: 'vehicleNumber',
      message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_VEHICLE_REQUIRED),
    })
  }
  if (settings.requireGateEntry && !input.gateEntryNumber?.trim()) {
    errors.push({
      field: 'gateEntryNumber',
      message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_GATE_ENTRY_REQUIRED),
    })
  }
  lines.forEach((line, index) => {
    const lineNo = line.lineNumber ?? index + 1
    if (settings.requireBatch && !line.batchNumber?.toString().trim()) {
      errors.push({
        field: `lines[${lineNo - 1}].batchNumber`,
        message: 'Batch number is required by Purchase Setup.',
      })
    }
    if (settings.requireSerial && !line.serialNumber?.toString().trim()) {
      errors.push({
        field: `lines[${lineNo - 1}].serialNumber`,
        message: 'Serial number is required by Purchase Setup.',
      })
    }
    if (settings.requireExpiry && !line.expiryDate) {
      errors.push({
        field: `lines[${lineNo - 1}].expiryDate`,
        message: 'Expiry date is required by Purchase Setup.',
      })
    }
  })
  if (errors.length) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_VALIDATION_FAILED),
      PURCHASE_ERROR_CODE.GRN_VALIDATION_FAILED,
      errors,
    )
  }
}

async function assertDuplicateChallanPolicy(
  tenantId: string,
  vendorId: string,
  challan: string | null | undefined,
  policy: 'BLOCK' | 'WARN' | 'ALLOW',
  excludeId?: string,
) {
  if (!challan?.trim() || policy === 'ALLOW') return
  const dup = await repo.findDuplicateChallan(tenantId, vendorId, challan.trim(), excludeId)
  if (!dup) return
  if (policy === 'BLOCK' || policy === 'WARN') {
    // WARN still blocks create for Phase 1 — soft warn requires FE UX not yet present.
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_DUPLICATE_CHALLAN),
      PURCHASE_ERROR_CODE.GRN_DUPLICATE_CHALLAN,
      [{ field: 'vendorChallanNumber', message: `Duplicate of ${dup.grnNumber}` }],
    )
  }
}

export async function listGoodsReceipts(tenantId: string, query: ListGoodsReceiptsQuery) {
  const result = await repo.findGoodsReceipts(tenantId, query)
  return {
    items: result.items.map(mapGoodsReceiptToDto),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getGoodsReceipt(tenantId: string, id: string) {
  const grn = await loadOrThrow(tenantId, id)
  return mapGoodsReceiptToDto(grn)
}

export async function previewNextGoodsReceiptNumber(tenantId: string) {
  const grnNumber = await previewPurchaseDocumentNumber(tenantId, 'GOODS_RECEIPT', 'GRN')
  return { grnNumber }
}

export async function getReceivableLines(tenantId: string, purchaseOrderId: string) {
  const po = await loadReceivablePo(tenantId, purchaseOrderId)
  const uomIds = [...new Set(po.lines.map((l) => l.uomId).filter(Boolean))] as string[]
  const uoms = uomIds.length
    ? await prisma.masterUom.findMany({
        where: { id: { in: uomIds }, tenantId, deletedAt: null },
        select: { id: true, code: true },
      })
    : []
  const uomById = new Map(uoms.map((u) => [u.id, u]))
  return {
    purchaseOrderId: po.id,
    orderNumber: po.orderNumber,
    status: po.status,
    vendorId: po.vendorId,
    vendorCode: po.vendor.code,
    vendorName: po.vendor.name,
    lines: po.lines
      .map((line) =>
        mapReceivableLineDto({
          ...line,
          uom: line.uomId ? uomById.get(line.uomId) ?? null : null,
        }),
      )
      .filter((l) => l.openQuantity > 0),
  }
}

export async function createGoodsReceipt(
  tenantId: string,
  actorId: string,
  input: CreateGoodsReceiptInput,
) {
  const po = await loadReceivablePo(tenantId, input.purchaseOrderId)
  const settings = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  assertGrnPolicyFields(settings, input, input.lines ?? [])

  // Prefer explicit warehouse → PO delivery warehouse → setup default (never first master).
  const resolvedWarehouseId =
    input.warehouseId || po.deliveryWarehouseId || settings.defaultWarehouseId
  if (!resolvedWarehouseId) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED,
      [{ field: 'warehouseId', message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED) }],
    )
  }

  const warehouse = await assertWarehouseActive(tenantId, resolvedWarehouseId)
  const storageLocationId =
    input.storageLocationId !== undefined
      ? input.storageLocationId
      : settings.defaultReceivingLocationId
  const storage = await resolveStorageLocation(tenantId, warehouse.id, storageLocationId)

  // Client allowExcess is ignored — Setup is authoritative.
  const allowExcess = settings.allowOverReceipt
  const overReceiptTolerancePct = settings.overReceiptTolerancePct
  const inspectionRequired =
    input.inspectionRequired !== undefined
      ? Boolean(input.inspectionRequired)
      : settings.autoCreateQualityInspection

  const lines = await buildLineCreates(
    tenantId,
    po,
    warehouse.id,
    storage?.id,
    allowExcess,
    overReceiptTolerancePct,
    inspectionRequired,
    input.lines,
  )

  await assertDuplicateChallanPolicy(
    tenantId,
    po.vendorId,
    input.vendorChallanNumber,
    settings.duplicateChallanPolicy,
  )

  const grnNumber = await nextPurchaseDocumentNumber(tenantId, 'GOODS_RECEIPT', 'GRN')
  const receiptDate = parseDateInput(input.receiptDate) ?? new Date()

  const created = await prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceipt.create({
      data: {
        tenantId,
        grnNumber,
        receiptDate: receiptDate as Date,
        purchaseOrderId: po.id,
        vendorId: po.vendorId,
        vendorCodeSnapshot: po.vendor.code,
        vendorNameSnapshot: po.vendor.name,
        purchaseOrderNumber: po.orderNumber,
        status: 'DRAFT',
        plantId: input.plantId ?? warehouse.plantId,
        warehouseId: warehouse.id,
        warehouseCodeSnapshot: warehouse.code,
        warehouseNameSnapshot: warehouse.name,
        storageLocationId: storage?.id ?? null,
        storageLocationCodeSnapshot: storage?.code ?? '',
        storageLocationNameSnapshot: storage?.name ?? '',
        vendorChallanNumber: input.vendorChallanNumber?.trim() || null,
        vendorChallanDate: parseDateInput(input.vendorChallanDate ?? undefined) ?? null,
        vendorInvoiceNumber: input.vendorInvoiceNumber?.trim() || null,
        vehicleNumber: input.vehicleNumber?.trim() || null,
        transporterName: input.transporterName?.trim() || null,
        lrNumber: input.lrNumber?.trim() || null,
        gateEntryNumber: input.gateEntryNumber?.trim() || null,
        receivedById: input.receivedById?.trim() || actorId,
        receivedByName: input.receivedByName?.trim() || null,
        inspectionRequired,
        allowExcess,
        remarks: input.remarks?.trim() || null,
        createdById: actorId,
        updatedById: actorId,
        lines: { create: lines.map((line) => ({ ...line, tenantId })) },
      },
      include: repo.includeGrn,
    })
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: grn.id,
        documentNumber: grn.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_CREATED,
        fromStatus: null,
        toStatus: 'DRAFT',
        actorId,
      },
      tx,
    )
    return grn
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.GRN_CREATED,
    newValue: { grnNumber: created.grnNumber, purchaseOrderId: po.id, status: 'DRAFT' },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, created.id))
}

export async function updateGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  input: UpdateGoodsReceiptInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertEditable(existing)

  const settings = await resolveEffectivePurchaseDefaults(
    tenantId,
    input.plantId !== undefined ? input.plantId : existing.plantId,
  )

  const warehouseId = input.warehouseId ?? existing.warehouseId
  const warehouse = await assertWarehouseActive(tenantId, warehouseId)
  const storage = await resolveStorageLocation(
    tenantId,
    warehouse.id,
    input.storageLocationId !== undefined ? input.storageLocationId : existing.storageLocationId,
  )
  // Setup is authoritative for over-receipt; inspection can still be toggled on the draft.
  const allowExcess = settings.allowOverReceipt
  const overReceiptTolerancePct = settings.overReceiptTolerancePct
  const inspectionRequired =
    input.inspectionRequired !== undefined
      ? input.inspectionRequired
      : existing.inspectionRequired

  const effectiveFields = {
    vendorChallanNumber:
      input.vendorChallanNumber !== undefined
        ? input.vendorChallanNumber
        : existing.vendorChallanNumber,
    vehicleNumber:
      input.vehicleNumber !== undefined ? input.vehicleNumber : existing.vehicleNumber,
    gateEntryNumber:
      input.gateEntryNumber !== undefined ? input.gateEntryNumber : existing.gateEntryNumber,
  }
  assertGrnPolicyFields(settings, effectiveFields, input.lines ?? existing.lines)

  let lines: repo.GrnLineCreateData[] | undefined
  if (input.lines) {
    const po = await loadReceivablePo(tenantId, existing.purchaseOrderId)
    lines = await buildLineCreates(
      tenantId,
      po,
      warehouse.id,
      storage?.id,
      allowExcess,
      overReceiptTolerancePct,
      inspectionRequired,
      input.lines,
    )
  }

  const challan = input.vendorChallanNumber !== undefined
    ? input.vendorChallanNumber?.trim() || null
    : existing.vendorChallanNumber
  await assertDuplicateChallanPolicy(
    tenantId,
    existing.vendorId,
    challan,
    settings.duplicateChallanPolicy,
    id,
  )

  const data: Prisma.GoodsReceiptUncheckedUpdateInput = {
    updatedById: actorId,
    warehouseId: warehouse.id,
    warehouseCodeSnapshot: warehouse.code,
    warehouseNameSnapshot: warehouse.name,
    plantId: input.plantId !== undefined ? input.plantId : existing.plantId ?? warehouse.plantId,
    storageLocationId: storage?.id ?? null,
    storageLocationCodeSnapshot: storage?.code ?? '',
    storageLocationNameSnapshot: storage?.name ?? '',
    allowExcess,
    inspectionRequired,
  }
  if (input.receiptDate !== undefined) data.receiptDate = parseDateInput(input.receiptDate) ?? existing.receiptDate
  if (input.vendorChallanNumber !== undefined) data.vendorChallanNumber = challan
  if (input.vendorChallanDate !== undefined) {
    data.vendorChallanDate = parseDateInput(input.vendorChallanDate) ?? null
  }
  if (input.vendorInvoiceNumber !== undefined) {
    data.vendorInvoiceNumber = input.vendorInvoiceNumber?.trim() || null
  }
  if (input.vehicleNumber !== undefined) data.vehicleNumber = input.vehicleNumber?.trim() || null
  if (input.transporterName !== undefined) data.transporterName = input.transporterName?.trim() || null
  if (input.lrNumber !== undefined) data.lrNumber = input.lrNumber?.trim() || null
  if (input.gateEntryNumber !== undefined) data.gateEntryNumber = input.gateEntryNumber?.trim() || null
  if (input.receivedById !== undefined) data.receivedById = input.receivedById?.trim() || null
  if (input.receivedByName !== undefined) data.receivedByName = input.receivedByName?.trim() || null
  if (input.remarks !== undefined) data.remarks = input.remarks?.trim() || null

  const updated = await prisma.$transaction(async (tx) => {
    if (lines) await repo.replaceGoodsReceiptLines(tenantId, id, lines, tx)
    const grn = await repo.updateGoodsReceipt(tenantId, id, data, tx)
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_UPDATED,
        fromStatus: existing.status,
        toStatus: existing.status,
        actorId,
      },
      tx,
    )
    return grn
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.GRN_UPDATED,
    previousValue: { status: existing.status },
    newValue: { status: updated?.status },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}

async function applyPoReceiptDeltas(
  tenantId: string,
  purchaseOrderId: string,
  deltas: Array<{ purchaseOrderLineId: string; receivedDelta: number; acceptedDelta: number; rejectedDelta: number }>,
  actorId: string,
  tx: Prisma.TransactionClient,
) {
  for (const d of deltas) {
    if (d.receivedDelta === 0 && d.acceptedDelta === 0 && d.rejectedDelta === 0) continue
    await tx.purchaseOrderLine.updateMany({
      where: { id: d.purchaseOrderLineId, tenantId, purchaseOrderId },
      data: {
        receivedQuantity: { increment: d.receivedDelta },
        acceptedQuantity: { increment: d.acceptedDelta },
        rejectedQuantity: { increment: d.rejectedDelta },
      },
    })
  }
  const lines = await tx.purchaseOrderLine.findMany({ where: { tenantId, purchaseOrderId } })
  const nextStatus = deriveReceiptStatus(lines)
  const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, tenantId } })
  if (!po) return
  if (po.status === nextStatus) return
  // Only move among receipt-driven statuses (never overwrite cancelled/closed/invoiced).
  const receiptDriven = ['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']
  if (!receiptDriven.includes(po.status) && po.status !== 'APPROVED') return
  await tx.purchaseOrder.updateMany({
    where: { id: purchaseOrderId, tenantId, deletedAt: null },
    data: { status: nextStatus, updatedById: actorId },
  })
  await tx.purchaseStatusHistory.create({
    data: {
      tenantId,
      documentType: 'PURCHASE_ORDER',
      documentId: purchaseOrderId,
      documentNumber: po.orderNumber,
      action:
        nextStatus === 'FULLY_RECEIVED'
          ? PURCHASE_AUDIT_ACTION.PO_FULLY_RECEIVED
          : PURCHASE_AUDIT_ACTION.PO_PARTIALLY_RECEIVED,
      fromStatus: po.status,
      toStatus: nextStatus,
      actorId,
    },
  })
}

export async function submitGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSubmittable(existing)

  const settings = await resolveEffectivePurchaseDefaults(tenantId, existing.plantId)
  assertGrnPolicyFields(
    settings,
    {
      vendorChallanNumber: existing.vendorChallanNumber,
      vehicleNumber: existing.vehicleNumber,
      gateEntryNumber: existing.gateEntryNumber,
    },
    existing.lines,
  )

  // Re-validate against current PO open qty + Setup tolerance
  const po = await loadReceivablePo(tenantId, existing.purchaseOrderId)
  const poLineById = new Map(po.lines.map((l) => [l.id, l]))
  const allowExcess = settings.allowOverReceipt
  const tolerancePct = settings.overReceiptTolerancePct
  for (const line of existing.lines) {
    const poLine = poLineById.get(line.purchaseOrderLineId)
    if (!poLine) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_LINE_PO_MISMATCH),
        PURCHASE_ERROR_CODE.GRN_LINE_PO_MISMATCH,
      )
    }
    const open = Math.max(0, qty(poLine.quantity) - qty(poLine.receivedQuantity))
    const received = qty(line.receivedQuantity)
    const maxAllowed = open + (allowExcess ? (open * tolerancePct) / 100 : 0)
    if (received > maxAllowed + 1e-9) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_EXCEEDS),
        PURCHASE_ERROR_CODE.GRN_QTY_EXCEEDS,
      )
    }
  }

  const nextStatus: GoodsReceiptStatus = existing.inspectionRequired ? 'QC_PENDING' : 'SUBMITTED'
  const deltas = existing.lines.map((l) => ({
    purchaseOrderLineId: l.purchaseOrderLineId,
    receivedDelta: qty(l.receivedQuantity),
    acceptedDelta: qty(l.acceptedQuantity),
    rejectedDelta: qty(l.rejectedQuantity),
  }))

  await prisma.$transaction(async (tx) => {
    const updated = await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: nextStatus,
        submittedAt: new Date(),
        allowExcess,
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    if (!updated) throw new GoodsReceiptNotFoundError()
    await applyPoReceiptDeltas(tenantId, existing.purchaseOrderId, deltas, actorId, tx)
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_SUBMITTED,
        fromStatus: existing.status,
        toStatus: nextStatus,
        actorId,
        remarks: body.remarks,
      },
      tx,
    )
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.GRN_SUBMITTED,
    previousValue: { status: existing.status },
    newValue: { status: nextStatus },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}

export async function cancelGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertCancellable(existing)

  const wasPosted = existing.status !== 'DRAFT'
  const deltas = wasPosted
    ? existing.lines.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        receivedDelta: -qty(l.receivedQuantity),
        acceptedDelta: -qty(l.acceptedQuantity),
        rejectedDelta: -qty(l.rejectedQuantity),
      }))
    : []

  await prisma.$transaction(async (tx) => {
    await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    if (deltas.length) {
      await applyPoReceiptDeltas(tenantId, existing.purchaseOrderId, deltas, actorId, tx)
    }
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_CANCELLED,
        fromStatus: existing.status,
        toStatus: 'CANCELLED',
        actorId,
        remarks: body.remarks,
      },
      tx,
    )
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.GRN_CANCELLED,
    previousValue: { status: existing.status },
    newValue: { status: 'CANCELLED' },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}

export async function reverseGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertReversible(existing)

  const deltas = existing.lines.map((l) => ({
    purchaseOrderLineId: l.purchaseOrderLineId,
    receivedDelta: -qty(l.receivedQuantity),
    acceptedDelta: -qty(l.acceptedQuantity),
    rejectedDelta: -qty(l.rejectedQuantity),
  }))

  await prisma.$transaction(async (tx) => {
    await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: 'REVERSED',
        reversedAt: new Date(),
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    await applyPoReceiptDeltas(tenantId, existing.purchaseOrderId, deltas, actorId, tx)
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_REVERSED,
        fromStatus: existing.status,
        toStatus: 'REVERSED',
        actorId,
        remarks: body.remarks,
      },
      tx,
    )
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.GRN_REVERSED,
    previousValue: { status: existing.status },
    newValue: { status: 'REVERSED' },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}
