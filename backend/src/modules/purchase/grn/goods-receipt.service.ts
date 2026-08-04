import type { GoodsReceiptStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import {
  postGrnStockInward,
  reverseGrnStockInward,
  reverseGrnQcHold,
} from '../shared/purchase-inventory-posting.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import {
  evaluateGrnLineTolerance,
} from '../shared/grn-tolerance.js'
import {
  lineAmountFromVendor,
  resolveDualQuantities,
  toPrimaryUnitCost,
  toUomQuantity,
  UomConversionError,
} from '../shared/uom-conversion.js'
import { assertGrnLineMatchesPoUom } from '../shared/item-uom-resolution.js'
import {
  nextPurchaseDocumentNumber,
  previewPurchaseDocumentNumber,
} from '../shared/purchase-document-number.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  deriveReceiptStatus,
  resolvePoReceivableStatuses,
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
  assertInventoryPostable,
  assertReversible,
  assertSubmittable,
  assertToleranceApprovable,
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
  const settings = await resolveEffectivePurchaseDefaults(tenantId)
  const receivable = resolvePoReceivableStatuses(
    (settings as { requirePoReleaseWorkflow?: boolean }).requirePoReleaseWorkflow !== false,
  )
  if (!receivable.includes(po.status)) {
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

const itemReceiptConfigSelect = {
  id: true,
  receivingToleranceId: true,
  receivingTolerancePercentage: true,
  receiptEntryMode: true,
  standardWeightPerBaseUnit: true,
  weightUomId: true,
  allowManualUnitQuantity: true,
  allowManualWeightQuantity: true,
  receivingTolerance: {
    select: { id: true, code: true, name: true, percentage: true, status: true },
  },
  weightUom: { select: { id: true, code: true } },
} as const

type ItemReceiptConfig = {
  id: string
  receivingToleranceId: string | null
  receivingTolerancePercentage: unknown
  receiptEntryMode: 'UNIT_ONLY' | 'WEIGHT_ONLY' | 'UNIT_AND_WEIGHT'
  standardWeightPerBaseUnit: unknown
  weightUomId: string | null
  allowManualUnitQuantity: boolean
  allowManualWeightQuantity: boolean
  receivingTolerance: {
    id: string
    code: string
    name: string
    percentage: unknown
    status: string
  } | null
  weightUom: { id: string; code: string } | null
}

async function loadItemReceiptConfigMap(tenantId: string, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, ItemReceiptConfig>()
  const items = await prisma.masterItem.findMany({
    where: { id: { in: itemIds }, tenantId, deletedAt: null },
    select: itemReceiptConfigSelect,
  })
  return new Map(items.map((it) => [it.id, it as ItemReceiptConfig]))
}

function mapItemMasterTolerance(
  tol: ItemReceiptConfig['receivingTolerance'],
): { id: string; code: string; name: string; percentage: number } | null {
  if (!tol) return null
  return {
    id: tol.id,
    code: tol.code,
    name: tol.name,
    percentage: Number(tol.percentage),
  }
}

function toleranceFieldsFromEvaluation(
  tol: ReturnType<typeof evaluateGrnLineTolerance>,
  input: GoodsReceiptLineInput,
  itemConfig?: ItemReceiptConfig | null,
): Pick<
  repo.GrnLineCreateData,
  | 'tolerancePercentage'
  | 'variancePercentage'
  | 'toleranceStatus'
  | 'receivingToleranceIdSnapshot'
  | 'receivingToleranceCodeSnapshot'
  | 'receivingToleranceNameSnapshot'
  | 'receivingTolerancePercentageSnapshot'
  | 'maximumAllowedUnitQuantity'
  | 'unitVariance'
  | 'receivedWeight'
  | 'expectedWeight'
  | 'maximumAllowedWeight'
  | 'weightVariance'
  | 'weightVariancePercentage'
  | 'weightConversionRateSnapshot'
  | 'weightUomIdSnapshot'
  | 'weightUomCodeSnapshot'
  | 'manualUnitEntry'
  | 'manualWeightEntry'
  | 'weightToleranceStatus'
  | 'requiresApproval'
  | 'approvalReasons'
  | 'shortCloseRequested'
  | 'shortCloseReason'
  | 'closeOpenQuantity'
> {
  const shortCloseRequested = Boolean(input.shortCloseRequested ?? input.closeOpenQuantity)
  return {
    tolerancePercentage: tol.tolerancePercentage,
    variancePercentage: tol.variancePercentage,
    toleranceStatus: tol.toleranceStatus,
    receivingToleranceIdSnapshot: tol.receivingToleranceIdSnapshot,
    receivingToleranceCodeSnapshot: tol.receivingToleranceCodeSnapshot,
    receivingToleranceNameSnapshot: tol.receivingToleranceNameSnapshot,
    receivingTolerancePercentageSnapshot: tol.receivingTolerancePercentageSnapshot,
    maximumAllowedUnitQuantity: tol.maximumAllowedUnitQuantity,
    unitVariance: tol.unitVariance,
    receivedWeight: tol.receivedWeight,
    expectedWeight: tol.expectedWeight,
    maximumAllowedWeight: tol.maximumAllowedWeight,
    weightVariance: tol.weightVariance,
    weightVariancePercentage: tol.weightVariancePercentage,
    weightConversionRateSnapshot: tol.weightConversionRateSnapshot,
    weightUomIdSnapshot: itemConfig?.weightUomId ?? null,
    weightUomCodeSnapshot: tol.weightUomCodeSnapshot,
    manualUnitEntry: tol.manualUnitEntry,
    manualWeightEntry: tol.manualWeightEntry,
    weightToleranceStatus: tol.weightToleranceStatus as repo.GrnLineCreateData['weightToleranceStatus'],
    requiresApproval: tol.requiresApproval,
    approvalReasons: tol.approvalReasons as repo.GrnLineCreateData['approvalReasons'],
    shortCloseRequested: tol.shortCloseRequested,
    shortCloseReason: tol.shortCloseReason,
    closeOpenQuantity: shortCloseRequested,
  }
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

  const itemIds = [
    ...new Set(po.lines.map((l) => l.itemId).filter((id): id is string => Boolean(id))),
  ]
  const itemConfigById = await loadItemReceiptConfigMap(tenantId, itemIds)

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
    const factor = (() => {
      const fromPo = Number(
        (poLine as { uomConversionFactor?: unknown }).uomConversionFactor ?? 1,
      )
      return fromPo > 0 ? fromPo : 1
    })()
    assertGrnLineMatchesPoUom({
      poConversionFactor: factor,
      clientFactor: (input as { uomConversionFactor?: unknown }).uomConversionFactor,
    })

    let receivedUom: number
    let received: number
    try {
      const dual = resolveDualQuantities({
        uomQuantity: input.receivedUomQuantity,
        quantity: input.receivedQuantity,
        uomConversionFactor: factor,
      })
      receivedUom = dual.uomQuantity
      received = dual.quantity
    } catch (err) {
      if (err instanceof UomConversionError) {
        throw new GoodsReceiptValidationError(err.message, PURCHASE_ERROR_CODE.GRN_QTY_INVALID, [
          { field: `lines[${i}].receivedUomQuantity`, message: err.message },
        ])
      }
      throw err
    }

    if (received < 0 || receivedUom < 0) {
      throw new GoodsReceiptValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_INVALID),
        PURCHASE_ERROR_CODE.GRN_QTY_INVALID,
        [{ field: `lines[${i}].receivedUomQuantity`, message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_QTY_INVALID) }],
      )
    }

    const ordered = qty(poLine.quantity)
    const orderedUom = qty((poLine as { uomQuantity?: unknown }).uomQuantity) || toUomQuantity(ordered, factor)
    const previously = qty(poLine.receivedQuantity)
    const open = Math.max(0, ordered - previously)
    const shortCloseRequested = Boolean(input.shortCloseRequested ?? input.closeOpenQuantity)
    const itemConfig = poLine.itemId ? itemConfigById.get(poLine.itemId) : undefined
    const tol = evaluateGrnLineTolerance({
      openQuantity: open,
      receivedQuantity: received,
      receivingToleranceId: itemConfig?.receivingToleranceId,
      masterTolerance: mapItemMasterTolerance(itemConfig?.receivingTolerance ?? null),
      itemTolerancePct: itemConfig ? Number(itemConfig.receivingTolerancePercentage ?? 0) : 0,
      setupTolerancePct: overReceiptTolerancePct,
      allowOverReceipt: allowExcess,
      closeOpenQuantity: shortCloseRequested,
      shortCloseRequested,
      shortCloseReason: input.shortCloseReason,
      receivedWeight: input.receivedWeight,
      standardWeightPerBaseUnit: itemConfig ? Number(itemConfig.standardWeightPerBaseUnit ?? 0) : 0,
      receiptEntryMode: itemConfig?.receiptEntryMode,
      manualUnitEntry: input.manualUnitEntry,
      manualWeightEntry: input.manualWeightEntry,
      weightUomCode: itemConfig?.weightUom?.code ?? null,
    })

    const lineWarehouseId = input.warehouseId ?? headerWarehouseId
    const lineStorageId = input.storageLocationId ?? headerStorageLocationId ?? null
    await resolveStorageLocation(tenantId, lineWarehouseId, lineStorageId)
    const bin = await resolveBin(tenantId, lineWarehouseId, lineStorageId, input.binId)

    const rate = qty(poLine.rate)
    const unitCostPrimary =
      qty((poLine as { unitCostPrimary?: unknown }).unitCostPrimary) || toPrimaryUnitCost(rate, factor)
    const damaged = qty(input.damagedQuantity)
    const short = qty(input.shortQuantity) || tol.shortQuantity
    const excessQty = qty(input.excessQuantity) || tol.excessQuantity
    const qcRequired = input.qcRequired ?? inspectionRequired
    const acceptedForQc =
      received <= 0 ? 0 : qty(input.acceptedForQcQuantity) || (qcRequired ? Math.max(0, received - damaged) : 0)
    const accepted = received <= 0 ? 0 : qcRequired ? 0 : Math.max(0, received - damaged)
    const rejected = received <= 0 ? 0 : damaged
    const acceptedUom = toUomQuantity(accepted || acceptedForQc, factor)
    const rejectedUom = toUomQuantity(rejected, factor)

    result.push({
      lineNumber: i + 1,
      purchaseOrderLineId: poLine.id,
      itemId: poLine.itemId,
      itemCodeSnapshot: poLine.itemCodeSnapshot,
      itemNameSnapshot: poLine.itemNameSnapshot,
      description: poLine.description,
      uomId: poLine.uomId,
      uomCodeSnapshot: poLine.uomId ? (uomCode.get(poLine.uomId) ?? '') : '',
      uomConversionFactor: factor,
      unitCostPrimary,
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
      orderedUomQuantity: orderedUom,
      receivedUomQuantity: receivedUom,
      acceptedUomQuantity: acceptedUom,
      rejectedUomQuantity: rejectedUom,
      rate,
      amount: money(lineAmountFromVendor(rate, receivedUom)),
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
      ...toleranceFieldsFromEvaluation(tol, input, itemConfig),
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
    lotNumber?: string | null
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
    if (
      settings.requireBatch &&
      !line.batchNumber?.toString().trim() &&
      !line.lotNumber?.toString().trim()
    ) {
      errors.push({
        field: `lines[${lineNo - 1}].batchNumber`,
        message: 'Batch or lot number is required by Purchase Setup.',
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
  const itemIds = [...new Set(po.lines.map((l) => l.itemId).filter((id): id is string => Boolean(id)))]
  const itemConfigById = await loadItemReceiptConfigMap(tenantId, itemIds)
  return {
    purchaseOrderId: po.id,
    orderNumber: po.orderNumber,
    status: po.status,
    vendorId: po.vendorId,
    vendorCode: po.vendor.code,
    vendorName: po.vendor.name,
    lines: po.lines
      .map((line) => {
        const itemConfig = line.itemId ? itemConfigById.get(line.itemId) : undefined
        return mapReceivableLineDto({
          ...line,
          uom: line.uomId ? uomById.get(line.uomId) ?? null : null,
          receivingTolerancePercentage: itemConfig
            ? Number(itemConfig.receivingTolerancePercentage ?? 0)
            : 0,
          receivingToleranceId: itemConfig?.receivingToleranceId ?? null,
          receivingToleranceCode: itemConfig?.receivingTolerance?.code ?? null,
          receiptEntryMode: itemConfig?.receiptEntryMode ?? 'UNIT_ONLY',
          standardWeightPerBaseUnit: itemConfig
            ? Number(itemConfig.standardWeightPerBaseUnit ?? 0)
            : 0,
          weightUomId: itemConfig?.weightUomId ?? null,
          weightUomCode: itemConfig?.weightUom?.code ?? null,
          requireWeightAtReceipt: false,
        })
      })
      .filter((l) => l.openQuantity > 0),
  }
}

export async function evaluateGoodsReceiptLines(
  tenantId: string,
  input: { purchaseOrderId: string; lines: GoodsReceiptLineInput[] },
) {
  const po = await loadReceivablePo(tenantId, input.purchaseOrderId)
  const settings = await resolveEffectivePurchaseDefaults(
    tenantId,
    (po as { plantId?: string | null }).plantId,
  )
  const allowExcess = settings.allowOverReceipt
  let warehouseId = po.deliveryWarehouseId ?? settings.defaultWarehouseId
  if (!warehouseId) {
    const fallbackWh = await prisma.masterWarehouse.findFirst({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    })
    warehouseId = fallbackWh?.id ?? ''
  }
  const lines = await buildLineCreates(
    tenantId,
    po,
    warehouseId,
    settings.defaultReceivingLocationId,
    allowExcess,
    settings.overReceiptTolerancePct,
    settings.autoCreateQualityInspection,
    input.lines,
  )
  return {
    purchaseOrderId: po.id,
    requiresApproval: lines.some((l) => l.requiresApproval),
    lines: lines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      lineNumber: line.lineNumber,
      openQuantity: line.openQuantity,
      receivedQuantity: line.receivedQuantity,
      tolerancePercentage: line.tolerancePercentage,
      variancePercentage: line.variancePercentage,
      toleranceStatus: line.toleranceStatus,
      receivingToleranceIdSnapshot: line.receivingToleranceIdSnapshot,
      receivingToleranceCodeSnapshot: line.receivingToleranceCodeSnapshot,
      receivingToleranceNameSnapshot: line.receivingToleranceNameSnapshot,
      maximumAllowedUnitQuantity: line.maximumAllowedUnitQuantity,
      receivedWeight: line.receivedWeight,
      expectedWeight: line.expectedWeight,
      maximumAllowedWeight: line.maximumAllowedWeight,
      weightToleranceStatus: line.weightToleranceStatus,
      requiresApproval: line.requiresApproval,
      approvalReasons: line.approvalReasons,
      shortQuantity: line.shortQuantity,
      excessQuantity: line.excessQuantity,
    })),
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
  const toleranceApprovalRequired = lines.some((l) => l.requiresApproval)

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
        toleranceApprovalRequired,
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
  if (lines) {
    data.toleranceApprovalRequired = lines.some((l) => l.requiresApproval)
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

  // Re-evaluate tolerance against current PO open qty
  const po = await loadReceivablePo(tenantId, existing.purchaseOrderId)
  const poLineById = new Map(po.lines.map((l) => [l.id, l]))
  const itemIds = [
    ...new Set(existing.lines.map((l) => l.itemId).filter((x): x is string => Boolean(x))),
  ]
  const itemConfigById = await loadItemReceiptConfigMap(tenantId, itemIds)

  let needsApproval = false
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
    const itemConfig = line.itemId ? itemConfigById.get(line.itemId) : undefined
    const shortCloseRequested = Boolean(
      (line as { shortCloseRequested?: boolean }).shortCloseRequested ??
        (line as { closeOpenQuantity?: boolean }).closeOpenQuantity,
    )
    const tol = evaluateGrnLineTolerance({
      openQuantity: open,
      receivedQuantity: received,
      receivingToleranceId: itemConfig?.receivingToleranceId,
      masterTolerance: mapItemMasterTolerance(itemConfig?.receivingTolerance ?? null),
      itemTolerancePct: itemConfig ? Number(itemConfig.receivingTolerancePercentage ?? 0) : 0,
      setupTolerancePct: settings.overReceiptTolerancePct,
      allowOverReceipt: settings.allowOverReceipt,
      closeOpenQuantity: shortCloseRequested,
      shortCloseRequested,
      shortCloseReason: (line as { shortCloseReason?: string | null }).shortCloseReason,
      receivedWeight: (line as { receivedWeight?: unknown }).receivedWeight != null
        ? qty((line as { receivedWeight?: unknown }).receivedWeight)
        : null,
      standardWeightPerBaseUnit: itemConfig ? Number(itemConfig.standardWeightPerBaseUnit ?? 0) : 0,
      receiptEntryMode: itemConfig?.receiptEntryMode,
      weightUomCode: itemConfig?.weightUom?.code ?? null,
    })
    if (tol.requiresApproval) needsApproval = true
  }

  if (needsApproval) {
    await prisma.$transaction(async (tx) => {
      await repo.updateGoodsReceipt(
        tenantId,
        id,
        {
          status: 'PENDING_TOLERANCE_APPROVAL',
          toleranceApprovalRequired: true,
          updatedById: actorId,
          remarks: body.remarks?.trim() || existing.remarks,
        },
        tx,
      )
      await tx.purchaseApproval.create({
        data: {
          tenantId,
          documentType: 'GOODS_RECEIPT',
          documentId: id,
          documentNumber: existing.grnNumber,
          level: 1,
          status: 'PENDING',
          requesterId: actorId,
          amount: existing.lines.reduce((s, l) => s + qty(l.amount), 0),
          remarks: body.remarks?.trim() || null,
        },
      })
      await repo.createStatusHistory(
        {
          tenantId,
          documentId: id,
          documentNumber: existing.grnNumber,
          action: 'GRN_TOLERANCE_APPROVAL_REQUESTED',
          fromStatus: existing.status,
          toStatus: 'PENDING_TOLERANCE_APPROVAL',
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
      action: 'GRN_TOLERANCE_APPROVAL_REQUESTED',
      previousValue: { status: existing.status },
      newValue: { status: 'PENDING_TOLERANCE_APPROVAL' },
    })

    return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
  }

  return finalizeGoodsReceiptSubmit(tenantId, id, actorId, body)
}

/** Continue GRN submit after tolerance is within band or approved. */
async function finalizeGoodsReceiptSubmit(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_TOLERANCE_APPROVAL') {
    throw new GoodsReceiptWorkflowError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_NOT_SUBMITTABLE),
      PURCHASE_ERROR_CODE.GRN_NOT_SUBMITTABLE,
    )
  }

  const settings = await resolveEffectivePurchaseDefaults(tenantId, existing.plantId)
  const allowExcess = settings.allowOverReceipt
  const nextStatus: GoodsReceiptStatus = existing.inspectionRequired ? 'QC_PENDING' : 'SUBMITTED'
  const deltas = existing.lines
    .filter((l) => qty(l.receivedQuantity) > 0)
    .map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      receivedDelta: qty(l.receivedQuantity),
      acceptedDelta: qty(l.acceptedQuantity),
      rejectedDelta: qty(l.rejectedQuantity),
    }))

  const stockLines = existing.lines.filter((l) => qty(l.receivedQuantity) > 0)

  const qcHoldMovements = await prisma.$transaction(async (tx) => {
    const movements =
      existing.inspectionRequired && stockLines.length
        ? await postGrnStockInward({
            tenantId,
            grnId: existing.id,
            grnNumber: existing.grnNumber,
            warehouseId: existing.warehouseId,
            lines: stockLines,
            useAcceptedQuantity: true,
            actorId,
            tx,
          })
        : []
    const updated = await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: nextStatus,
        submittedAt: new Date(),
        allowExcess,
        toleranceApprovalRequired: false,
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
    return movements
  })

  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, qcHoldMovements, {
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: existing.id,
    narration: `GRN inward ${existing.grnNumber}`,
    userId: actorId,
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

  if (!existing.inspectionRequired && nextStatus === 'SUBMITTED') {
    return postInventoryGoodsReceipt(tenantId, id, actorId, body)
  }

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}

export async function approveToleranceGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertToleranceApprovable(existing)

  await prisma.$transaction(async (tx) => {
    await tx.purchaseApproval.updateMany({
      where: {
        tenantId,
        documentType: 'GOODS_RECEIPT',
        documentId: id,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        approverId: actorId,
        respondedAt: new Date(),
        remarks: body.remarks?.trim() || null,
      },
    })
    await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        toleranceApprovedAt: new Date(),
        toleranceApprovedById: actorId,
        updatedById: actorId,
      },
      tx,
    )
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: 'GRN_TOLERANCE_APPROVED',
        fromStatus: existing.status,
        toStatus: existing.status,
        actorId,
        remarks: body.remarks,
      },
      tx,
    )
  })

  return finalizeGoodsReceiptSubmit(tenantId, id, actorId, body)
}

export async function rejectToleranceGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertToleranceApprovable(existing)

  await prisma.$transaction(async (tx) => {
    await tx.purchaseApproval.updateMany({
      where: {
        tenantId,
        documentType: 'GOODS_RECEIPT',
        documentId: id,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        approverId: actorId,
        respondedAt: new Date(),
        remarks: body.remarks?.trim() || null,
      },
    })
    await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: 'DRAFT',
        toleranceApprovalRequired: true,
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: 'GRN_TOLERANCE_REJECTED',
        fromStatus: existing.status,
        toStatus: 'DRAFT',
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
    action: 'GRN_TOLERANCE_REJECTED',
    previousValue: { status: existing.status },
    newValue: { status: 'DRAFT' },
  })

  return mapGoodsReceiptToDto(await loadOrThrow(tenantId, id))
}

export async function postInventoryGoodsReceipt(
  tenantId: string,
  id: string,
  actorId: string,
  body: { remarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertInventoryPostable(existing)
  if (existing.status === 'INVENTORY_POSTED') {
    return mapGoodsReceiptToDto(existing)
  }
  if (!existing.warehouseId) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED,
    )
  }

  const useAcceptedQuantity = existing.inspectionRequired
  const inwardMovements = await prisma.$transaction(async (tx) => {
    const movements = await postGrnStockInward({
      tenantId,
      grnId: existing.id,
      grnNumber: existing.grnNumber,
      warehouseId: existing.warehouseId!,
      lines: existing.lines,
      useAcceptedQuantity,
      actorId,
      tx,
    })
    await repo.updateGoodsReceipt(
      tenantId,
      id,
      {
        status: 'INVENTORY_POSTED',
        updatedById: actorId,
        remarks: body.remarks?.trim() || existing.remarks,
      },
      tx,
    )
    await repo.createStatusHistory(
      {
        tenantId,
        documentId: id,
        documentNumber: existing.grnNumber,
        action: PURCHASE_AUDIT_ACTION.GRN_INVENTORY_POSTED,
        fromStatus: existing.status,
        toStatus: 'INVENTORY_POSTED',
        actorId,
        remarks: body.remarks,
      },
      tx,
    )
    return movements
  })

  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, inwardMovements, {
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: existing.id,
    narration: `GRN inward ${existing.grnNumber}`,
    userId: actorId,
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.GRN,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.GRN_INVENTORY_POSTED,
    previousValue: { status: existing.status },
    newValue: { status: 'INVENTORY_POSTED' },
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

  const cancelMovements = await prisma.$transaction(async (tx) => {
    const movements =
      existing.inspectionRequired && existing.status === 'QC_PENDING'
        ? await reverseGrnQcHold({
            tenantId,
            grnId: existing.id,
            grnNumber: existing.grnNumber,
            warehouseId: existing.warehouseId,
            lines: existing.lines,
            actorId,
            tx,
          })
        : []
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
    return movements
  })

  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, cancelMovements, {
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: existing.id,
    narration: `GRN QC hold cancel ${existing.grnNumber}`,
    userId: actorId,
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

  const reversalMovements = await prisma.$transaction(async (tx) => {
    const movements =
      existing.status === 'INVENTORY_POSTED' && existing.warehouseId
        ? await reverseGrnStockInward({
            tenantId,
            grnId: existing.id,
            grnNumber: existing.grnNumber,
            warehouseId: existing.warehouseId,
            lines: existing.lines,
            useAcceptedQuantity: existing.inspectionRequired,
            actorId,
            tx,
          })
        : []
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
    return movements
  })

  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, reversalMovements, {
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: existing.id,
    narration: `GRN reverse ${existing.grnNumber}`,
    userId: actorId,
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
