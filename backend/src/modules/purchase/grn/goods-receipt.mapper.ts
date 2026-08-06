import type { GoodsReceipt, GoodsReceiptLine, MasterVendor, MasterWarehouse, PurchaseOrder } from '@prisma/client'
import type { GrnMaterialReturnEntry, GrnMaterialReturnLineSummary } from '../returns/returnable-quantity.service.js'
import {
  allowedActions,
  isGrnLineFullyReversed,
  qty,
  remainingReversibleReceived,
} from './goods-receipt.workflow.js'

const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null

type GrnWithRelations = GoodsReceipt & {
  lines: GoodsReceiptLine[]
  purchaseOrder?: Pick<
    PurchaseOrder,
    'id' | 'orderNumber' | 'status' | 'expectedDeliveryDate' | 'paymentTerms' | 'deliveryTerms' | 'currencyCode'
  > | null
  vendor?: Pick<MasterVendor, 'id' | 'code' | 'name' | 'gstin'> | null
  warehouse?: Pick<MasterWarehouse, 'id' | 'code' | 'name' | 'plantId'> | null
}

export function mapGoodsReceiptToDto(
  grn: GrnWithRelations,
  returnStats?: {
    byGrnLineId: Map<string, GrnMaterialReturnLineSummary>
    totalReturnedQuantity: number
    totalReturnableQuantity: number
    entries: GrnMaterialReturnEntry[]
  },
  uomCodeById?: Map<string, string>,
) {
  // View/API expose what belongs on the document: received > 0 or short-closed.
  // Idle zero-qty rows (legacy) are not shown as if they were received.
  const documentLines = grn.lines.filter((line) => {
    const received = qty(line.receivedQuantity)
    const shortClosed = Boolean(
      (line as { shortCloseRequested?: boolean }).shortCloseRequested ||
        (line as { closeOpenQuantity?: boolean }).closeOpenQuantity,
    )
    return received > 0 || shortClosed
  })
  const totalReceived = documentLines.reduce((s, l) => s + remainingReversibleReceived(l), 0)
  const totalAccepted = documentLines.reduce(
    (s, l) => s + Math.max(0, qty(l.acceptedQuantity) - qty((l as { reversedAcceptedQuantity?: unknown }).reversedAcceptedQuantity)),
    0,
  )
  const totalRejected = documentLines.reduce(
    (s, l) => s + Math.max(0, qty(l.rejectedQuantity) - qty((l as { reversedRejectedQuantity?: unknown }).reversedRejectedQuantity)),
    0,
  )
  const totalAmount = documentLines.reduce((s, l) => {
    const netRatio =
      qty(l.receivedQuantity) > 0
        ? remainingReversibleReceived(l) / qty(l.receivedQuantity)
        : qty(l.acceptedQuantity) > 0
          ? Math.max(
              0,
              qty(l.acceptedQuantity) - qty((l as { reversedAcceptedQuantity?: unknown }).reversedAcceptedQuantity),
            ) / qty(l.acceptedQuantity)
          : 1
    return s + qty(l.amount) * netRatio
  }, 0)
  const partiallyReversed =
    grn.status !== 'REVERSED' &&
    documentLines.some(
      (l) => isGrnLineFullyReversed(l) || qty((l as { reversedQuantity?: unknown }).reversedQuantity) > 0,
    )

  return {
    id: grn.id,
    grnNumber: grn.grnNumber,
    documentNumber: grn.grnNumber,
    receiptDate: date(grn.receiptDate),
    documentDate: date(grn.receiptDate),
    status: grn.status,
    partiallyReversed,
    purchaseOrderId: grn.purchaseOrderId,
    purchaseOrderNumber: grn.purchaseOrderNumber || grn.purchaseOrder?.orderNumber || '',
    purchaseOrderStatus: grn.purchaseOrder?.status ?? null,
    vendorId: grn.vendorId,
    vendorCode: grn.vendorCodeSnapshot || grn.vendor?.code || '',
    vendorName: grn.vendorNameSnapshot || grn.vendor?.name || '',
    vendorGstin: grn.vendor?.gstin ?? '',
    plantId: grn.plantId,
    warehouseId: grn.warehouseId,
    warehouseCode: grn.warehouseCodeSnapshot || grn.warehouse?.code || '',
    warehouseName: grn.warehouseNameSnapshot || grn.warehouse?.name || '',
    storageLocationId: grn.storageLocationId,
    storageLocationCode: grn.storageLocationCodeSnapshot,
    storageLocationName: grn.storageLocationNameSnapshot,
    vendorChallanNumber: grn.vendorChallanNumber,
    vendorChallanDate: date(grn.vendorChallanDate),
    vendorInvoiceNumber: grn.vendorInvoiceNumber,
    vehicleNumber: grn.vehicleNumber,
    transporterName: grn.transporterName,
    lrNumber: grn.lrNumber,
    gateEntryNumber: grn.gateEntryNumber,
    receivedById: grn.receivedById,
    receivedByName: grn.receivedByName,
    inspectionRequired: grn.inspectionRequired,
    allowExcess: grn.allowExcess,
    toleranceApprovalRequired: Boolean(
      (grn as { toleranceApprovalRequired?: boolean }).toleranceApprovalRequired,
    ),
    toleranceApprovedAt: iso((grn as { toleranceApprovedAt?: Date | null }).toleranceApprovedAt),
    toleranceApprovedById:
      (grn as { toleranceApprovedById?: string | null }).toleranceApprovedById ?? null,
    remarks: grn.remarks,
    submittedAt: iso(grn.submittedAt),
    cancelledAt: iso(grn.cancelledAt),
    reversedAt: iso(grn.reversedAt),
    closedAt: iso(grn.closedAt),
    createdAt: iso(grn.createdAt),
    updatedAt: iso(grn.updatedAt),
    lineCount: documentLines.length,
    totalReceivedQty: totalReceived,
    totalAcceptedQty: totalAccepted,
    totalRejectedQty: totalRejected,
    totalReturnedQty: returnStats?.totalReturnedQuantity ?? 0,
    totalReturnableQty: returnStats?.totalReturnableQuantity ?? 0,
    materialReturnLines: returnStats?.entries ?? [],
    totalAmount,
    currencyCode: grn.purchaseOrder?.currencyCode ?? 'INR',
    expectedDeliveryDate: date(grn.purchaseOrder?.expectedDeliveryDate),
    paymentTerms: grn.purchaseOrder?.paymentTerms ?? '',
    deliveryTerms: grn.purchaseOrder?.deliveryTerms ?? '',
    allowedActions: allowedActions(grn),
    lines: documentLines.map((line) => {
      const returnLine = returnStats?.byGrnLineId?.get(line.id)
      const reversedQuantity = qty((line as { reversedQuantity?: unknown }).reversedQuantity)
      const reversedAcceptedQuantity = qty(
        (line as { reversedAcceptedQuantity?: unknown }).reversedAcceptedQuantity,
      )
      const reversedRejectedQuantity = qty(
        (line as { reversedRejectedQuantity?: unknown }).reversedRejectedQuantity,
      )
      return {
      id: line.id,
      lineNumber: line.lineNumber,
      purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      description: line.description,
      uomId: line.uomId,
      uom:
        (line.uomCodeSnapshot ?? '').trim() ||
        (line.uomId ? uomCodeById?.get(line.uomId)?.trim() : '') ||
        '',
      uomConversionFactor: qty((line as { uomConversionFactor?: unknown }).uomConversionFactor ?? 1) || 1,
      unitCostPrimary: qty((line as { unitCostPrimary?: unknown }).unitCostPrimary ?? line.rate),
      orderedQuantity: qty(line.orderedQuantity),
      previouslyReceivedQuantity: qty(line.previouslyReceivedQuantity),
      openQuantity: qty(line.openQuantity),
      challanQuantity: qty(line.challanQuantity),
      receivedQuantity: qty(line.receivedQuantity),
      receivedUomQuantity: qty((line as { receivedUomQuantity?: unknown }).receivedUomQuantity ?? line.receivedQuantity),
      orderedUomQuantity: qty((line as { orderedUomQuantity?: unknown }).orderedUomQuantity ?? line.orderedQuantity),
      acceptedUomQuantity: qty((line as { acceptedUomQuantity?: unknown }).acceptedUomQuantity ?? line.acceptedQuantity),
      rejectedUomQuantity: qty((line as { rejectedUomQuantity?: unknown }).rejectedUomQuantity ?? line.rejectedQuantity),
      damagedQuantity: qty(line.damagedQuantity),
      shortQuantity: qty(line.shortQuantity),
      excessQuantity: qty(line.excessQuantity),
      acceptedForQcQuantity: qty(line.acceptedForQcQuantity),
      acceptedQuantity: qty(line.acceptedQuantity),
      rejectedQuantity: qty(line.rejectedQuantity),
      reversedQuantity,
      reversedAcceptedQuantity,
      reversedRejectedQuantity,
      reversedAt: iso((line as { reversedAt?: Date | null }).reversedAt),
      remainingReversibleQuantity: remainingReversibleReceived(line),
      lineFullyReversed: isGrnLineFullyReversed(line) || (reversedQuantity > 0 && remainingReversibleReceived(line) <= 0),
      returnedQuantity: returnLine?.returnedQuantity ?? 0,
      returnableQuantity: returnLine?.returnableQuantity ?? 0,
      rate: qty(line.rate),
      amount: qty(line.amount),
      hsnId: (line as { hsnIdSnapshot?: string | null }).hsnIdSnapshot ?? null,
      hsnCode: (line as { hsnCodeSnapshot?: string }).hsnCodeSnapshot ?? '',
      gstGroupId: (line as { gstGroupIdSnapshot?: string | null }).gstGroupIdSnapshot ?? null,
      gstGroupCode: (line as { gstGroupCodeSnapshot?: string }).gstGroupCodeSnapshot ?? '',
      gstRatePct: qty((line as { gstRatePctSnapshot?: unknown }).gstRatePctSnapshot),
      cgstRate: qty((line as { cgstRateSnapshot?: unknown }).cgstRateSnapshot),
      sgstRate: qty((line as { sgstRateSnapshot?: unknown }).sgstRateSnapshot),
      igstRate: qty((line as { igstRateSnapshot?: unknown }).igstRateSnapshot),
      gstScheme: (line as { gstSchemeSnapshot?: string }).gstSchemeSnapshot ?? 'cgst_sgst',
      warehouseId: line.warehouseId,
      storageLocationId: line.storageLocationId,
      binId: line.binId,
      binCode: line.binCodeSnapshot,
      batchNumber: line.batchNumber,
      heatNumber: line.heatNumber,
      lotNumber: line.lotNumber,
      serialNumber: line.serialNumber,
      manufacturingDate: date(line.manufacturingDate),
      expiryDate: date(line.expiryDate),
      qcRequired: line.qcRequired,
      tolerancePercentage: qty((line as { tolerancePercentage?: unknown }).tolerancePercentage),
      variancePercentage:
        (line as { variancePercentage?: unknown }).variancePercentage == null
          ? null
          : qty((line as { variancePercentage?: unknown }).variancePercentage),
      toleranceStatus:
        ((line as { toleranceStatus?: string }).toleranceStatus as string | undefined) ?? 'EXACT',
      receivingToleranceIdSnapshot:
        (line as { receivingToleranceIdSnapshot?: string | null }).receivingToleranceIdSnapshot ?? null,
      receivingToleranceCodeSnapshot:
        (line as { receivingToleranceCodeSnapshot?: string }).receivingToleranceCodeSnapshot ?? '',
      receivingToleranceNameSnapshot:
        (line as { receivingToleranceNameSnapshot?: string }).receivingToleranceNameSnapshot ?? '',
      receivingTolerancePercentageSnapshot: qty(
        (line as { receivingTolerancePercentageSnapshot?: unknown }).receivingTolerancePercentageSnapshot ?? 0,
      ),
      weightReceivingToleranceIdSnapshot:
        (line as { weightReceivingToleranceIdSnapshot?: string | null }).weightReceivingToleranceIdSnapshot ??
        null,
      weightReceivingToleranceCodeSnapshot:
        (line as { weightReceivingToleranceCodeSnapshot?: string }).weightReceivingToleranceCodeSnapshot ??
        '',
      weightReceivingToleranceNameSnapshot:
        (line as { weightReceivingToleranceNameSnapshot?: string }).weightReceivingToleranceNameSnapshot ??
        '',
      weightReceivingTolerancePercentageSnapshot: qty(
        (line as { weightReceivingTolerancePercentageSnapshot?: unknown })
          .weightReceivingTolerancePercentageSnapshot ?? 0,
      ),
      maximumAllowedUnitQuantity: qty(
        (line as { maximumAllowedUnitQuantity?: unknown }).maximumAllowedUnitQuantity ?? 0,
      ),
      unitVariance: qty((line as { unitVariance?: unknown }).unitVariance ?? 0),
      receivedWeight:
        (line as { receivedWeight?: unknown }).receivedWeight == null
          ? null
          : qty((line as { receivedWeight?: unknown }).receivedWeight),
      expectedWeight:
        (line as { expectedWeight?: unknown }).expectedWeight == null
          ? null
          : qty((line as { expectedWeight?: unknown }).expectedWeight),
      maximumAllowedWeight:
        (line as { maximumAllowedWeight?: unknown }).maximumAllowedWeight == null
          ? null
          : qty((line as { maximumAllowedWeight?: unknown }).maximumAllowedWeight),
      weightVariance:
        (line as { weightVariance?: unknown }).weightVariance == null
          ? null
          : qty((line as { weightVariance?: unknown }).weightVariance),
      weightVariancePercentage:
        (line as { weightVariancePercentage?: unknown }).weightVariancePercentage == null
          ? null
          : qty((line as { weightVariancePercentage?: unknown }).weightVariancePercentage),
      weightConversionRateSnapshot:
        (line as { weightConversionRateSnapshot?: unknown }).weightConversionRateSnapshot == null
          ? null
          : qty((line as { weightConversionRateSnapshot?: unknown }).weightConversionRateSnapshot),
      weightUomIdSnapshot:
        (line as { weightUomIdSnapshot?: string | null }).weightUomIdSnapshot ?? null,
      weightUomCodeSnapshot: (line as { weightUomCodeSnapshot?: string }).weightUomCodeSnapshot ?? '',
      weightToleranceStatus:
        (line as { weightToleranceStatus?: string }).weightToleranceStatus ?? 'NOT_APPLICABLE',
      manualUnitEntry: Boolean((line as { manualUnitEntry?: boolean }).manualUnitEntry),
      manualWeightEntry: Boolean((line as { manualWeightEntry?: boolean }).manualWeightEntry),
      requiresApproval: Boolean((line as { requiresApproval?: boolean }).requiresApproval),
      approvalReasons: (line as { approvalReasons?: string[] }).approvalReasons ?? [],
      shortCloseRequested: Boolean((line as { shortCloseRequested?: boolean }).shortCloseRequested),
      shortCloseReason: (line as { shortCloseReason?: string | null }).shortCloseReason ?? null,
      closeOpenQuantity: Boolean(
        (line as { shortCloseRequested?: boolean }).shortCloseRequested ??
          (line as { closeOpenQuantity?: boolean }).closeOpenQuantity,
      ),
      receivingCondition:
        ((line as { receivingCondition?: string }).receivingCondition as string | undefined) ?? 'NORMAL',
      receivingConditionReason:
        (line as { receivingConditionReason?: string | null }).receivingConditionReason ?? null,
      remarks: line.remarks,
    }
    }),
  }
}

export function mapReceivableLineDto(line: {
  id: string
  lineNumber: number
  itemId: string | null
  itemCodeSnapshot: string
  itemNameSnapshot: string
  description: string | null
  quantity: unknown
  receivedQuantity: unknown
  uomId: string | null
  rate: unknown
  uom?: { code: string } | null
  receivingTolerancePercentage?: number | null
  receivingToleranceId?: string | null
  receivingToleranceCode?: string | null
  receiptEntryMode?: string | null
  standardWeightPerBaseUnit?: number | null
  weightUomId?: string | null
  weightUomCode?: string | null
  requireWeightAtReceipt?: boolean | null
  uomQuantity?: unknown
  uomConversionFactor?: unknown
}) {
  const ordered = qty(line.quantity)
  const received = qty(line.receivedQuantity)
  const factor = qty(line.uomConversionFactor) || 1
  return {
    purchaseOrderLineId: line.id,
    lineNumber: line.lineNumber,
    itemId: line.itemId,
    itemCode: line.itemCodeSnapshot,
    itemName: line.itemNameSnapshot,
    description: line.description,
    uomId: line.uomId,
    uom: line.uom?.code ?? '',
    orderedQuantity: ordered,
    orderedUomQuantity: qty(line.uomQuantity) || ordered * factor,
    previouslyReceivedQuantity: received,
    openQuantity: Math.max(0, ordered - received),
    rate: qty(line.rate),
    uomConversionFactor: factor,
    receivingTolerancePercentage: qty(line.receivingTolerancePercentage),
    receivingToleranceId: line.receivingToleranceId ?? null,
    receivingToleranceCode: line.receivingToleranceCode ?? null,
    receiptEntryMode: line.receiptEntryMode ?? 'UNIT_ONLY',
    standardWeightPerBaseUnit: qty(line.standardWeightPerBaseUnit),
    weightUomId: line.weightUomId ?? null,
    weightUomCode: line.weightUomCode ?? '',
    requireWeightAtReceipt: Boolean(line.requireWeightAtReceipt),
  }
}
