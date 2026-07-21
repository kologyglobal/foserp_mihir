import type { GoodsReceipt, GoodsReceiptLine, MasterVendor, MasterWarehouse, PurchaseOrder } from '@prisma/client'
import { allowedActions, qty } from './goods-receipt.workflow.js'

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

export function mapGoodsReceiptToDto(grn: GrnWithRelations) {
  const totalReceived = grn.lines.reduce((s, l) => s + qty(l.receivedQuantity), 0)
  const totalAccepted = grn.lines.reduce((s, l) => s + qty(l.acceptedQuantity), 0)
  const totalRejected = grn.lines.reduce((s, l) => s + qty(l.rejectedQuantity), 0)
  const totalAmount = grn.lines.reduce((s, l) => s + qty(l.amount), 0)

  return {
    id: grn.id,
    grnNumber: grn.grnNumber,
    documentNumber: grn.grnNumber,
    receiptDate: date(grn.receiptDate),
    documentDate: date(grn.receiptDate),
    status: grn.status,
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
    remarks: grn.remarks,
    submittedAt: iso(grn.submittedAt),
    cancelledAt: iso(grn.cancelledAt),
    reversedAt: iso(grn.reversedAt),
    closedAt: iso(grn.closedAt),
    createdAt: iso(grn.createdAt),
    updatedAt: iso(grn.updatedAt),
    lineCount: grn.lines.length,
    totalReceivedQty: totalReceived,
    totalAcceptedQty: totalAccepted,
    totalRejectedQty: totalRejected,
    totalAmount,
    currencyCode: grn.purchaseOrder?.currencyCode ?? 'INR',
    expectedDeliveryDate: date(grn.purchaseOrder?.expectedDeliveryDate),
    paymentTerms: grn.purchaseOrder?.paymentTerms ?? '',
    deliveryTerms: grn.purchaseOrder?.deliveryTerms ?? '',
    allowedActions: allowedActions(grn),
    lines: grn.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      description: line.description,
      uomId: line.uomId,
      uom: line.uomCodeSnapshot,
      orderedQuantity: qty(line.orderedQuantity),
      previouslyReceivedQuantity: qty(line.previouslyReceivedQuantity),
      openQuantity: qty(line.openQuantity),
      challanQuantity: qty(line.challanQuantity),
      receivedQuantity: qty(line.receivedQuantity),
      damagedQuantity: qty(line.damagedQuantity),
      shortQuantity: qty(line.shortQuantity),
      excessQuantity: qty(line.excessQuantity),
      acceptedForQcQuantity: qty(line.acceptedForQcQuantity),
      acceptedQuantity: qty(line.acceptedQuantity),
      rejectedQuantity: qty(line.rejectedQuantity),
      rate: qty(line.rate),
      amount: qty(line.amount),
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
      remarks: line.remarks,
    })),
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
}) {
  const ordered = qty(line.quantity)
  const received = qty(line.receivedQuantity)
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
    previouslyReceivedQuantity: received,
    openQuantity: Math.max(0, ordered - received),
    rate: qty(line.rate),
  }
}
