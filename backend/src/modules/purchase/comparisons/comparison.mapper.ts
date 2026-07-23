import type {
  PurchaseOrder,
  PurchaseOrderLine,
  VendorComparison,
  VendorComparisonLine,
  VendorQuotation,
  VendorQuotationLine,
} from '@prisma/client'

const num = (value: unknown) => Number(value ?? 0)
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null

type ComparisonData = VendorComparison & {
  lines: VendorComparisonLine[]
  awardedVendor?: { id: string } | null
}

export function mapComparisonToDto(
  comparison: ComparisonData,
  quotations: Array<VendorQuotation & { lines: VendorQuotationLine[] }>,
  userNames?: Map<string, string>,
) {
  const vendors = quotations.map((quotation) => {
    const basicRateTotal = quotation.lines.reduce((total, line) => total + num(line.amount), 0)
    const leadTimes = quotation.lines.map((line) => line.leadTimeDays).filter((value): value is number => value !== null)
    return {
      vendorId: quotation.vendorId,
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      basicRateTotal,
      discountAmount: num(quotation.discountAmount),
      taxAmount: num(quotation.taxAmount),
      freightAmount: num(quotation.freightAmount),
      otherCharges: num(quotation.otherCharges),
      landedCost: num(quotation.landedCost),
      deliveryLeadDays: leadTimes.length ? Math.min(...leadTimes) : null,
      paymentTerms: quotation.paymentTerms,
      warranty: quotation.warranty,
      validUntil: date(quotation.validUntil),
      isAwarded: quotation.id === comparison.awardedVendorQuotationId,
    }
  })
  return {
    id: comparison.id,
    comparisonNumber: comparison.comparisonNumber,
    comparisonDate: date(comparison.comparisonDate),
    requestForQuotationId: comparison.requestForQuotationId,
    status: comparison.status,
    awardedVendorId: comparison.awardedVendorId,
    awardedVendorQuotationId: comparison.awardedVendorQuotationId,
    selectionReason: comparison.selectionReason,
    awardedById: comparison.awardedById,
    awardedByName:
      (comparison.awardedById && userNames?.get(comparison.awardedById)) || null,
    selectedAt: comparison.selectedAt?.toISOString() ?? null,
    remarks: comparison.remarks,
    vendors,
    lines: comparison.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      requestForQuotationLineId: line.requestForQuotationLineId,
      vendorQuotationId: line.vendorQuotationId,
      vendorQuotationLineId: line.vendorQuotationLineId,
      itemId: line.itemId,
      quantity: num(line.quantity),
      rate: num(line.rate),
      amount: num(line.amount),
      rank: line.rank,
      isSelected: line.isSelected,
      remarks: line.remarks,
    })),
  }
}

export function mapPurchaseOrderToDto(order: PurchaseOrder & { lines: PurchaseOrderLine[] }) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: date(order.orderDate),
    vendorId: order.vendorId,
    status: order.status,
    origin: order.origin,
    requestForQuotationId: order.requestForQuotationId,
    vendorQuotationId: order.vendorQuotationId,
    vendorComparisonId: order.vendorComparisonId,
    purchaseRequisitionId: order.purchaseRequisitionId,
    totalAmount: num(order.totalAmount),
    lines: order.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      description: line.description,
      quantity: num(line.quantity),
      uomId: line.uomId,
      rate: num(line.rate),
      amount: num(line.amount),
      requiredDate: date(line.requiredDate),
      remarks: line.remarks,
    })),
  }
}
