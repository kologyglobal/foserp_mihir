import type { VendorQuotation, VendorQuotationLine } from '@prisma/client'

type VendorQuotationWithLines = VendorQuotation & { lines: VendorQuotationLine[] }

const num = (value: unknown) => Number(value ?? 0)
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null

export function mapVendorQuotationToDto(quotation: VendorQuotationWithLines) {
  const lines = quotation.lines.map((line) => ({
    id: line.id,
    lineNumber: line.lineNumber,
    requestForQuotationLineId: line.requestForQuotationLineId,
    itemId: line.itemId,
    itemCode: line.itemCodeSnapshot,
    itemName: line.itemNameSnapshot,
    description: line.description,
    quantity: num(line.quantity),
    uomId: line.uomId,
    rate: num(line.rate),
    amount: num(line.amount),
    leadTimeDays: line.leadTimeDays,
    remarks: line.remarks,
  }))
  const basicRateTotal = lines.reduce((total, line) => total + line.amount, 0)
  const leadTimes = lines
    .map((line) => line.leadTimeDays)
    .filter((value): value is number => value !== null)

  return {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    quotationDate: date(quotation.quotationDate),
    requestForQuotationId: quotation.requestForQuotationId,
    vendorId: quotation.vendorId,
    status: quotation.status,
    currencyCode: quotation.currencyCode,
    validUntil: date(quotation.validUntil),
    paymentTerms: quotation.paymentTerms,
    deliveryTerms: quotation.deliveryTerms,
    warranty: quotation.warranty,
    basicRateTotal,
    totalAmount: num(quotation.totalAmount),
    discountAmount: num(quotation.discountAmount),
    taxAmount: num(quotation.taxAmount),
    freightAmount: num(quotation.freightAmount),
    otherCharges: num(quotation.otherCharges),
    landedCost: num(quotation.landedCost),
    leadTimeDays: leadTimes.length ? Math.min(...leadTimes) : null,
    remarks: quotation.remarks,
    submittedAt: quotation.submittedAt?.toISOString() ?? null,
    createdById: quotation.createdById,
    updatedById: quotation.updatedById,
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
    lines,
  }
}
