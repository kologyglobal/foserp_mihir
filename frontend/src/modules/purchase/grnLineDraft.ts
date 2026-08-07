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
import { getPurchaseLineBaseUomCode, purchaseQtyToBaseQty, toUomQuantityFromBase } from '@/utils/purchaseLineUom'
import { resolveItemDefaultBin } from '@/utils/itemDefaultBin'
import { useMasterStore } from '@/store/masterStore'

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
  baseUom: string
  uomConversionFactor: number
  orderedQty: number
  orderedUomQty: number
  previouslyReceivedQty: number
  pendingQty: number
  pendingUomQty: number
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

/** Lines that belong on a saved GRN: received qty > 0, or explicitly short-closed. */
export function isIncludedGrnLine(line: {
  receivedQty?: number | null
  receivedUomQty?: number | null
  reversedQty?: number | null
  closeOpenQuantity?: boolean | null
  shortCloseRequested?: boolean | null
}): boolean {
  const received =
    Number(line.receivedUomQty ?? line.receivedQty) || Number(line.receivedQty) || 0
  if (received > 0) return true
  // Keep reversed lines visible after net qty display falls to zero.
  if ((Number(line.reversedQty) || 0) > 0) return true
  return Boolean(line.closeOpenQuantity || line.shortCloseRequested)
}

export function filterIncludedGrnLines<T extends {
  receivedQty?: number | null
  receivedUomQty?: number | null
  closeOpenQuantity?: boolean | null
  shortCloseRequested?: boolean | null
}>(lines: T[]): T[] {
  return lines.filter(isIncludedGrnLine)
}

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
    // Fully deferred to QC: GRN only captures Received. Accepted/Rejected are
    // determined when the Quality Inspection completes, not at receiving.
    accepted = 0
    nextRejected = 0
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
    damagedQty: qcRequired ? 0 : damaged,
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
      const factor = Number(l.uomConversionFactor) || 1
      const pendingBase = Number(l.pendingQty) || 0
      const pendingUom =
        Number(l.outstandingQty) ||
        (factor === 1 ? pendingBase : toUomQuantityFromBase(pendingBase, factor))
      // PO line: receivedQtyBase = stock; receivedQty = purchase UOM (after API map).
      const prevBase =
        l.receivedQtyBase != null
          ? Number(l.receivedQtyBase) || 0
          : factor === 1
            ? Number(l.receivedQty) || 0
            : purchaseQtyToBaseQty(Number(l.receivedQty) || 0, factor)
      const baseUom = getPurchaseLineBaseUomCode(l.itemId)
      const resolvedTol = resolveReceivingTolerancePct({
        itemTolerancePct: qtyTol,
        setupTolerancePct: setup.overReceiptTolerancePct,
        allowOverReceipt: setup.allowOverReceipt,
      })
      let binId = l.binId ?? null
      let bin = l.binCode ?? ''
      if (!binId && !bin) {
        const master = useMasterStore.getState().items.find((i) => i.id === l.itemId)
        const def = resolveItemDefaultBin(master)
        binId = def.binId
        bin = def.binCode
      }
      const draft: GrnLineDraft = {
        purchaseOrderLineId: l.id,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        description: l.specification || l.itemName,
        uom: l.uom,
        baseUom,
        uomConversionFactor: factor,
        orderedQty: l.quantity,
        orderedUomQty: Number(l.uomQuantity) || toUomQuantityFromBase(l.quantity, factor),
        previouslyReceivedQty: prevBase,
        pendingQty: pendingBase,
        pendingUomQty: pendingUom,
        // Leave received blank for the user to enter actual receipt qty per line.
        receivedQty: 0,
        receivedUomQty: 0,
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
        binId,
        bin,
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
  // Ignore legacy idle zero-qty rows that were previously persisted for open PO lines.
  return filterIncludedGrnLines(grn.lines).map((l) => {
    const ctrl = itemControls[l.itemId]
    const factor = Number(l.uomConversionFactor) || 1
    const pendingBase = Number(l.pendingQty) || 0
    const draft: GrnLineDraft = {
      purchaseOrderLineId: l.purchaseOrderLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description,
      uom: l.uom,
      baseUom: getPurchaseLineBaseUomCode(l.itemId) || l.uom,
      uomConversionFactor: factor,
      orderedQty: l.orderedQty,
      orderedUomQty: Number(l.orderedUomQty) || toUomQuantityFromBase(l.orderedQty, factor),
      previouslyReceivedQty: l.previouslyReceivedQty,
      pendingQty: pendingBase,
      pendingUomQty: toUomQuantityFromBase(pendingBase, factor),
      receivedQty: l.receivedQty,
      receivedUomQty:
        l.receivedUomQty ?? toUomQuantityFromBase(Number(l.receivedQty) || 0, factor),
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
