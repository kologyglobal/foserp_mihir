import type { RequestForQuotation, RequestForQuotationLine, RfqVendor } from '@prisma/client'

type RfqWithRelations = RequestForQuotation & {
  lines: RequestForQuotationLine[]
  vendors: RfqVendor[]
}

function num(v: unknown): number {
  return Number(v ?? 0)
}

function dateStr(v: Date | null | undefined): string | null {
  if (!v) return null
  return v.toISOString().slice(0, 10)
}

export function mapRfqToDto(rfq: RfqWithRelations) {
  return {
    id: rfq.id,
    rfqNumber: rfq.rfqNumber,
    rfqDate: dateStr(rfq.rfqDate),
    purchaseRequisitionId: rfq.purchaseRequisitionId,
    title: rfq.title,
    responseDueDate: dateStr(rfq.responseDueDate),
    status: rfq.status,
    remarks: rfq.remarks,
    sentAt: rfq.sentAt?.toISOString() ?? null,
    closedAt: rfq.closedAt?.toISOString() ?? null,
    createdById: rfq.createdById,
    updatedById: rfq.updatedById,
    createdAt: rfq.createdAt?.toISOString() ?? null,
    updatedAt: rfq.updatedAt?.toISOString() ?? null,
    vendors: rfq.vendors.map((v) => ({
      id: v.id,
      vendorId: v.vendorId,
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
