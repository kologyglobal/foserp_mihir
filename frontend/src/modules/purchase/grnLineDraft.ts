import {
  evaluateGrnLineTolerance,
  resolveReceivingTolerancePct,
} from '@/services/purchase/grnTolerance'
import {
  GRN_RECEIVING_CONDITION_LABELS,
  resolveReceivingCondition,
  type GrnReceivingCondition,
} from '@/services/purchase/grnReceivingCondition'
import type { GoodsReceiptNote, PurchaseOrder } from '@/types/purchaseDomain'
import type { Item } from '@/types/master'

export type ItemReceiptControl = {
  batch: boolean
  serial: boolean
  expiry: boolean
  qcRequired: boolean
  quantityTolerancePct: number
  weightTolerancePct: number
  receiptEntryMode: 'UNIT_ONLY' | 'WEIGHT_ONLY' | 'UNIT_AND_WEIGHT'
  standardWeightPerBaseUnit: number
  weightUomCode: string
  requireWeightAtReceipt: boolean
}

export type GrnLineDraft = {
  purchaseOrderLineId: string
  itemId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  orderedQty: number
  previouslyReceivedQty: number
  pendingQty: number
  receivedQty: number
  receivedUomQty?: number
  acceptedQty: number
  rejectedQty: number
  shortQty: number
  excessQty: number
  damagedQty: number
  receivedWeight: number | null
  expectedWeight: number | null
  weightVariancePercentage: number | null
  weightToleranceStatus: string
  quantityTolerancePct: number
  weightTolerancePct: number
  receiptEntryMode: ItemReceiptControl['receiptEntryMode']
  standardWeightPerBaseUnit: number
  weightUomCode: string
  batchNumber: string
  lotNumber: string
  serialNumber: string
  manufacturingDate: string
  expiryDate: string
  warehouseId: string
  warehouseName: string
  binId: string | null
  bin: string
  allowExcess: boolean
  batchControlled: boolean
  serialControlled: boolean
  expiryControlled: boolean
  qcRequired: boolean
  tolerancePercentage: number
  variancePercentage: number | null
  toleranceStatus: string
  receivingCondition: GrnReceivingCondition
  receivingConditionReason: string
  closeOpenQuantity: boolean
  shortCloseReason: string
  remarks: string
}

export { GRN_RECEIVING_CONDITION_LABELS }

export function buildItemReceiptControls(
  items: Item[],
  tolerancePctById: Map<string, number>,
): Record<string, ItemReceiptControl> {
  const controls: Record<string, ItemReceiptControl> = {}
  for (const item of items) {
    const qtyPct = item.receivingToleranceId
      ? tolerancePctById.get(item.receivingToleranceId) ?? Number(item.receivingTolerancePercentage ?? 0)
      : Number(item.receivingTolerancePercentage ?? 0)
    const weightPct = item.weightReceivingToleranceId
      ? tolerancePctById.get(item.weightReceivingToleranceId) ?? 0
      : qtyPct
    controls[item.id] = {
      batch: Boolean(item.batchTracked),
      serial: Boolean(item.serialTracked),
      expiry: false,
      qcRequired: Boolean(item.qcRequired),
      quantityTolerancePct: qtyPct,
      weightTolerancePct: weightPct,
      receiptEntryMode: item.receiptEntryMode ?? 'UNIT_ONLY',
      standardWeightPerBaseUnit: Number(item.standardWeightPerBaseUnit ?? 0),
      weightUomCode: '',
      requireWeightAtReceipt: Boolean(item.requireWeightAtReceipt),
    }
  }
  return controls
}

function weightPreview(input: {
  receivedQty: number
  receivedWeight: number | null
  standardWeightPerBaseUnit: number
  weightTolerancePct: number
  receiptEntryMode: ItemReceiptControl['receiptEntryMode']
}) {
  if (input.receiptEntryMode === 'UNIT_ONLY') {
    return {
      expectedWeight: null as number | null,
      weightVariancePercentage: null as number | null,
      weightToleranceStatus: 'NOT_APPLICABLE',
    }
  }
  const expected = input.receivedQty * input.standardWeightPerBaseUnit
  const receivedWeight = input.receivedWeight ?? 0
  if (expected <= 0 && receivedWeight <= 0) {
    return { expectedWeight: 0, weightVariancePercentage: null, weightToleranceStatus: 'NOT_APPLICABLE' }
  }
  const variancePct =
    expected > 0 ? Number((((receivedWeight - expected) / expected) * 100).toFixed(4)) : null
  const maxAllowed = expected * (1 + input.weightTolerancePct / 100)
  let weightToleranceStatus = 'EXACT'
  if (receivedWeight > maxAllowed) weightToleranceStatus = 'EXCESS_OUTSIDE_TOLERANCE'
  else if (receivedWeight > expected) weightToleranceStatus = 'EXCESS_WITHIN_TOLERANCE'
  return { expectedWeight: expected, weightVariancePercentage: variancePct, weightToleranceStatus }
}

export function recalcGrnLineDraft(
  row: GrnLineDraft,
  setup: { allowOverReceipt: boolean; overReceiptTolerancePct: number },
  inspectionRequired: boolean,
): GrnLineDraft {
  const pending = row.pendingQty
  const received = Math.max(0, Number(row.receivedQty) || 0)
  const rejected = Math.max(0, Number(row.rejectedQty) || 0)
  const damaged = Math.max(0, Number(row.damagedQty) || 0)
  const qcRequired = row.qcRequired || inspectionRequired

  const tol = evaluateGrnLineTolerance({
    openQuantity: pending,
    receivedQuantity: received,
    itemTolerancePct: row.quantityTolerancePct,
    setupTolerancePct: setup.overReceiptTolerancePct,
    allowOverReceipt: setup.allowOverReceipt || row.allowExcess,
    closeOpenQuantity: row.closeOpenQuantity,
    shortCloseRequested: row.closeOpenQuantity,
    shortCloseReason: row.shortCloseReason || null,
  })

  const weight = weightPreview({
    receivedQty: received,
    receivedWeight: row.receivedWeight,
    standardWeightPerBaseUnit: row.standardWeightPerBaseUnit,
    weightTolerancePct: row.weightTolerancePct,
    receiptEntryMode: row.receiptEntryMode,
  })

  let accepted = received
  let nextRejected = rejected
  if (qcRequired) {
    accepted = 0
  } else if (row.receivingCondition === 'DAMAGE' || damaged > 0) {
    nextRejected = Math.max(rejected, damaged)
    accepted = Math.max(0, received - nextRejected)
  } else if (row.receivingCondition === 'REJECTED') {
    nextRejected = received
    accepted = 0
  } else if (received > 0) {
    accepted = Math.max(0, received - nextRejected)
  }

  const receivingCondition = resolveReceivingCondition({
    pendingQty: pending,
    receivedQty: received,
    rejectedQty: nextRejected,
    damagedQty: damaged,
    qcRequired,
    shortCloseRequested: row.closeOpenQuantity,
    userCondition:
      row.receivingCondition && row.receivingCondition !== 'NORMAL'
        ? row.receivingCondition
        : null,
  })

  return {
    ...row,
    receivedQty: received,
    acceptedQty: accepted,
    rejectedQty: nextRejected,
    shortQty: tol.shortQuantity,
    excessQty: tol.excessQuantity,
    tolerancePercentage: tol.tolerancePercentage,
    variancePercentage: tol.variancePercentage,
    toleranceStatus: tol.toleranceStatus,
    expectedWeight: weight.expectedWeight,
    weightVariancePercentage: weight.weightVariancePercentage,
    weightToleranceStatus: weight.weightToleranceStatus,
    receivingCondition,
  }
}

function traceabilityFromControls(
  itemId: string,
  itemControls: Record<string, ItemReceiptControl>,
  fallback?: { batchControlled?: boolean; serialControlled?: boolean; expiryControlled?: boolean },
) {
  const ctrl = itemId ? itemControls[itemId] : undefined
  return {
    batchControlled: ctrl?.batch ?? fallback?.batchControlled ?? false,
    serialControlled: ctrl?.serial ?? fallback?.serialControlled ?? false,
    expiryControlled: ctrl?.expiry ?? fallback?.expiryControlled ?? false,
    qcRequired: ctrl?.qcRequired ?? false,
  }
}

export function linesFromPo(
  po: PurchaseOrder,
  itemControls: Record<string, ItemReceiptControl>,
  setup: { allowOverReceipt: boolean; overReceiptTolerancePct: number },
  inspectionRequired: boolean,
): GrnLineDraft[] {
  return po.lines
    .filter((l) => l.pendingQty > 0)
    .map((l) => {
      const ctrl = itemControls[l.itemId]
      const qtyTol = ctrl?.quantityTolerancePct ?? 0
      const resolvedTol = resolveReceivingTolerancePct({
        itemTolerancePct: qtyTol,
        setupTolerancePct: setup.overReceiptTolerancePct,
        allowOverReceipt: setup.allowOverReceipt,
      })
      const draft: GrnLineDraft = {
        purchaseOrderLineId: l.id,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        description: l.specification || l.itemName,
        uom: l.uom,
        orderedQty: l.quantity,
        previouslyReceivedQty: l.receivedQty,
        pendingQty: l.pendingQty,
        receivedQty: l.pendingQty,
        acceptedQty: 0,
        rejectedQty: 0,
        shortQty: 0,
        excessQty: 0,
        damagedQty: 0,
        receivedWeight: null,
        expectedWeight: null,
        weightVariancePercentage: null,
        weightToleranceStatus: 'NOT_APPLICABLE',
        quantityTolerancePct: qtyTol,
        weightTolerancePct: ctrl?.weightTolerancePct ?? qtyTol,
        receiptEntryMode: ctrl?.receiptEntryMode ?? 'UNIT_ONLY',
        standardWeightPerBaseUnit: ctrl?.standardWeightPerBaseUnit ?? 0,
        weightUomCode: ctrl?.weightUomCode ?? '',
        batchNumber: '',
        lotNumber: '',
        serialNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        warehouseId: l.locationId || po.deliveryLocation.id,
        warehouseName: l.locationName || po.deliveryLocation.name,
        binId: l.binId ?? null,
        bin: l.binCode ?? '',
        allowExcess: setup.allowOverReceipt,
        ...traceabilityFromControls(l.itemId, itemControls),
        tolerancePercentage: resolvedTol,
        variancePercentage: null,
        toleranceStatus: 'EXACT',
        receivingCondition: 'NORMAL',
        receivingConditionReason: '',
        closeOpenQuantity: false,
        shortCloseReason: '',
        remarks: '',
      }
      return recalcGrnLineDraft(draft, setup, inspectionRequired)
    })
}

export function linesFromGrn(
  grn: GoodsReceiptNote,
  itemControls: Record<string, ItemReceiptControl>,
  setup: { allowOverReceipt: boolean; overReceiptTolerancePct: number },
  inspectionRequired: boolean,
): GrnLineDraft[] {
  return grn.lines.map((l) => {
    const ctrl = itemControls[l.itemId]
    const draft: GrnLineDraft = {
      purchaseOrderLineId: l.purchaseOrderLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description,
      uom: l.uom,
      orderedQty: l.orderedQty,
      previouslyReceivedQty: l.previouslyReceivedQty,
      pendingQty: l.pendingQty,
      receivedQty: l.receivedQty,
      receivedUomQty: l.receivedUomQty,
      acceptedQty: l.acceptedQty,
      rejectedQty: l.rejectedQty,
      shortQty: l.shortQty,
      excessQty: l.excessQty,
      damagedQty: l.damagedQty,
      receivedWeight: l.receivedWeight ?? null,
      expectedWeight: l.expectedWeight ?? null,
      weightVariancePercentage: l.weightVariancePercentage ?? null,
      weightToleranceStatus: l.weightToleranceStatus ?? 'NOT_APPLICABLE',
      quantityTolerancePct: l.receivingTolerancePercentage ?? l.tolerancePercentage ?? 0,
      weightTolerancePct: l.weightTolerancePercentage ?? l.tolerancePercentage ?? 0,
      receiptEntryMode: ctrl?.receiptEntryMode ?? 'UNIT_ONLY',
      standardWeightPerBaseUnit: ctrl?.standardWeightPerBaseUnit ?? 0,
      weightUomCode: ctrl?.weightUomCode ?? '',
      batchNumber: l.batchNumber,
      lotNumber: l.lotNumber,
      serialNumber: l.serialNumber,
      manufacturingDate: l.manufacturingDate ?? '',
      expiryDate: l.expiryDate ?? '',
      warehouseId: l.warehouseId,
      warehouseName: l.warehouseName,
      binId: l.binId ?? null,
      bin: l.bin,
      allowExcess: l.allowExcess,
      ...traceabilityFromControls(l.itemId, itemControls, {
        batchControlled: l.batchControlled,
        serialControlled: l.serialControlled,
        expiryControlled: l.expiryControlled,
      }),
      tolerancePercentage: l.tolerancePercentage ?? 0,
      variancePercentage: l.variancePercentage ?? null,
      toleranceStatus: l.toleranceStatus ?? 'EXACT',
      receivingCondition: l.receivingCondition ?? 'NORMAL',
      receivingConditionReason: l.receivingConditionReason ?? '',
      closeOpenQuantity: Boolean(l.closeOpenQuantity ?? l.shortCloseRequested),
      shortCloseReason: l.shortCloseReason ?? '',
      remarks: l.remarks,
    }
    return recalcGrnLineDraft(draft, setup, inspectionRequired)
  })
}
