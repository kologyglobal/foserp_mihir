import type { MasterVendor, RequestForQuotation, RequestForQuotationLine, RfqVendor } from '@prisma/client'

type RfqVendorWithMaster = RfqVendor & {
  vendor?: Pick<
    MasterVendor,
    'id' | 'code' | 'name' | 'email' | 'contactPerson' | 'contactPhone' | 'gstin' | 'state' | 'rating'
  > | null
}

type RfqPrWithWarehouse = {
  id: string
  requisitionNumber: string
  warehouse?: { id: string; code: string; name: string } | null
}

type RfqWithRelations = RequestForQuotation & {
  lines: RequestForQuotationLine[]
  vendors: RfqVendorWithMaster[]
  purchaseRequisition?: RfqPrWithWarehouse | null
}

function num(v: unknown): number {
  return Number(v ?? 0)
}

function dateStr(v: Date | null | undefined): string | null {
  if (!v) return null
  return v.toISOString().slice(0, 10)
}

export function mapRfqToDto(rfq: RfqWithRelations, userNames?: Map<string, string>) {
  return {
    id: rfq.id,
    rfqNumber: rfq.rfqNumber,
    rfqDate: dateStr(rfq.rfqDate),
    purchaseRequisitionId: rfq.purchaseRequisitionId,
    purchaseRequisitionNumber: rfq.purchaseRequisition?.requisitionNumber ?? null,
    warehouseId: rfq.purchaseRequisition?.warehouse?.id ?? null,
    warehouseCode: rfq.purchaseRequisition?.warehouse?.code ?? '',
    warehouseName: rfq.purchaseRequisition?.warehouse?.name ?? '',
    title: rfq.title,
    responseDueDate: dateStr(rfq.responseDueDate),
    status: rfq.status,
    remarks: rfq.remarks,
    sentAt: rfq.sentAt?.toISOString() ?? null,
    closedAt: rfq.closedAt?.toISOString() ?? null,
    createdById: rfq.createdById,
    createdByName: (rfq.createdById && userNames?.get(rfq.createdById)) || null,
    updatedById: rfq.updatedById,
    createdAt: rfq.createdAt?.toISOString() ?? null,
    updatedAt: rfq.updatedAt?.toISOString() ?? null,
    vendors: rfq.vendors.map((v) => ({
      id: v.id,
      vendorId: v.vendorId,
      vendorCode: v.vendor?.code ?? '',
      vendorName: v.vendor?.name ?? '',
      gstin: v.vendor?.gstin ?? '',
      state: v.vendor?.state ?? '',
      contactPerson: v.vendor?.contactPerson ?? '',
      contactEmail: v.vendor?.email ?? '',
      contactPhone: v.vendor?.contactPhone ?? '',
      vendorRating: v.vendor?.rating == null ? null : Number(v.vendor.rating),
      inviteStatus: v.inviteStatus,
      invitedAt: v.invitedAt?.toISOString() ?? null,
      respondedAt: v.respondedAt?.toISOString() ?? null,
      remarks: v.remarks,
    })),
    lines: rfq.lines.map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      purchaseRequisitionLineId: l.purchaseRequisitionLineId,
      itemId: l.itemId,
      itemCode: l.itemCodeSnapshot,
      itemName: l.itemNameSnapshot,
      description: l.description,
      quantity: num(l.requiredQuantity),
      requiredQuantity: num(l.requiredQuantity),
      uomId: l.uomId,
      targetRate: l.targetRate == null ? null : num(l.targetRate),
      requiredDate: dateStr(l.requiredDate),
      remarks: l.remarks,
    })),
  }
}
