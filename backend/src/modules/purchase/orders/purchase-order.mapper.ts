import type { MasterVendor, MasterWarehouse, PurchaseOrder, PurchaseOrderLine } from '@prisma/client'
import { allowedActions } from './purchase-order.workflow.js'

const num = (value: unknown) => Number(value ?? 0)
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null

type WarehousePick = Pick<MasterWarehouse, 'id' | 'code' | 'name' | 'plantId'>

type OrderWithRelations = PurchaseOrder & {
  lines: PurchaseOrderLine[]
  vendor?: Pick<
    MasterVendor,
    'id' | 'code' | 'name' | 'gstin' | 'state' | 'address' | 'city'
  > | null
  purchaseRequisition?: {
    id: string
    requisitionNumber: string
    warehouseId?: string | null
    warehouse?: WarehousePick | null
  } | null
  requestForQuotation?: { id: string; rfqNumber: string } | null
  deliveryWarehouse?: WarehousePick | null
  revisions?: Array<{
    id: string
    revisionNo: number
    reason: string
    statusBefore: string
    statusAfter: string
    revisedById: string | null
    revisedAt: Date
    headerSnapshot: unknown
    linesSnapshot: unknown
    changes: unknown
  }>
}

export function mapPurchaseOrderToDto(
  order: OrderWithRelations,
  userNames?: Map<string, string>,
) {
  const warehouse = order.deliveryWarehouse ?? order.purchaseRequisition?.warehouse ?? null
  const warehouseId =
    order.deliveryWarehouseId ?? order.purchaseRequisition?.warehouseId ?? warehouse?.id ?? null

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: date(order.orderDate),
    vendorId: order.vendorId,
    vendorCode: order.vendor?.code ?? '',
    vendorName: order.vendor?.name ?? '',
    vendorGstin: order.vendor?.gstin ?? '',
    vendorState: order.vendor?.state ?? '',
    vendorAddress: order.vendor?.address ?? '',
    vendorCity: order.vendor?.city ?? '',
    status: order.status,
    origin: order.origin,
    revisionNo: order.revisionNo ?? 0,
    purchaseRequisitionId: order.purchaseRequisitionId,
    purchaseRequisitionNumber: order.purchaseRequisition?.requisitionNumber ?? null,
    requestForQuotationId: order.requestForQuotationId,
    requestForQuotationNumber: order.requestForQuotation?.rfqNumber ?? null,
    vendorQuotationId: order.vendorQuotationId,
    vendorComparisonId: order.vendorComparisonId,
    currencyCode: order.currencyCode,
    expectedDeliveryDate: date(order.expectedDeliveryDate),
    paymentTerms: order.paymentTerms,
    deliveryTerms: order.deliveryTerms,
    deliveryWarehouseId: warehouseId,
    deliveryWarehouseCode: warehouse?.code ?? '',
    deliveryWarehouseName: warehouse?.name ?? '',
    deliveryWarehousePlantId: warehouse?.plantId ?? null,
    subtotalAmount: num(order.subtotalAmount),
    taxAmount: num(order.taxAmount),
    freightAmount: num(order.freightAmount),
    totalAmount: num(order.totalAmount),
    remarks: order.remarks,
    submittedAt: iso(order.submittedAt),
    approvedAt: iso(order.approvedAt),
    rejectedAt: iso(order.rejectedAt),
    rejectionReason: order.rejectionReason,
    sentBackAt: iso(order.sentBackAt),
    sendBackReason: order.sendBackReason,
    sentAt: iso(order.sentAt),
    closedAt: iso(order.closedAt),
    cancelledAt: iso(order.cancelledAt),
    createdById: order.createdById ?? null,
    createdByName: (order.createdById && userNames?.get(order.createdById)) || null,
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    allowedActions: allowedActions(order),
    revisions: (order.revisions ?? []).map((r) => ({
      id: r.id,
      revisionNo: r.revisionNo,
      reason: r.reason,
      statusBefore: r.statusBefore,
      statusAfter: r.statusAfter,
      revisedAt: iso(r.revisedAt),
      revisedById: r.revisedById,
      revisedByName: (r.revisedById && userNames?.get(r.revisedById)) || null,
      snapshot: JSON.stringify({
        header: r.headerSnapshot,
        lines: r.linesSnapshot,
      }),
      changes: Array.isArray(r.changes) ? r.changes : [],
    })),
    changeHistory: (order.revisions ?? []).flatMap((r) => {
      const rows = Array.isArray(r.changes) ? (r.changes as Array<Record<string, string>>) : []
      return rows.map((c, i) => ({
        id: `${r.id}-${i}`,
        revisionNo: r.revisionNo,
        changedAt: iso(r.revisedAt),
        changedBy: (r.revisedById && userNames?.get(r.revisedById)) || r.revisedById || '',
        reason: r.reason,
        fieldPath: c.fieldPath ?? '',
        fieldLabel: c.fieldLabel ?? '',
        previousValue: c.previousValue ?? '',
        newValue: c.newValue ?? '',
      }))
    }),
    lines: order.lines.map((line) => {
      const quantity = num(line.quantity)
      const received = num(line.receivedQuantity)
      return {
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCodeSnapshot,
        itemName: line.itemNameSnapshot,
        description: line.description,
        quantity,
        uomQuantity: num((line as { uomQuantity?: unknown }).uomQuantity ?? quantity),
        uomConversionFactor: num((line as { uomConversionFactor?: unknown }).uomConversionFactor ?? 1) || 1,
        unitCostPrimary: num((line as { unitCostPrimary?: unknown }).unitCostPrimary ?? line.rate),
        uomId: line.uomId,
        uomCode:
          (line as { uom?: { code?: string | null } | null }).uom?.code ??
          null,
        rate: num(line.rate),
        amount: num(line.amount),
        receivedQuantity: received,
        acceptedQuantity: num(line.acceptedQuantity),
        rejectedQuantity: num(line.rejectedQuantity),
        returnedQuantity: num(line.returnedQuantity),
        invoicedQuantity: num(line.invoicedQuantity),
        openQuantity: Math.max(0, quantity - received),
        requiredDate: date(line.requiredDate),
        purchaseRequisitionLineId: line.purchaseRequisitionLineId,
        purchasePlanningRowId: line.purchasePlanningRowId,
        requisitionNumber: (line as { requisitionNumber?: string | null }).requisitionNumber ?? null,
        remarks: line.remarks,
      }
    }),
  }
}
