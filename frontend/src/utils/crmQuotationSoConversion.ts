import type { QuotationDocument } from '../types/crm'
import type { Customer } from '../types/master'
import type { Quotation } from '../types/sales'
import { calcPriceSummary, syncLineTotals } from './crmQuotationCalc'
import { sectionContent } from './crmIntegration'
import { quotationLineItemsSummary, summarizeQuotationLinesForSo } from './crmQuotationSoLines'
import { useMasterStore } from '../store/masterStore'
import { assertProductSellableForSales } from './productMaster'

export interface CrmSalesOrderHandoverInput {
  customerPoNumber?: string
  customerPoDate?: string
  expectedDeliveryDate?: string
  deliveryLocation?: string
  locationId?: string | null
  internalRemarks?: string
}

export interface QuotationSoConversionContext {
  document: QuotationDocument
  latestDocument?: QuotationDocument
  salesQuotation?: Quotation
  customer?: Customer
  contactName?: string | null
  opportunityName?: string | null
  productName?: string | null
}

export interface QuotationSoValidationIssue {
  id: string
  message: string
  blocking: boolean
}

export interface QuotationSoValidationResult {
  ok: boolean
  canConvert: boolean
  disabledReason: string | null
  issues: QuotationSoValidationIssue[]
}

const DISABLED_NOT_LATEST = 'Only latest approved quotation revision can be converted to Sales Order.'

export function isQuotationExpired(salesQuotation?: Quotation): boolean {
  if (!salesQuotation?.validityDate) return false
  return salesQuotation.validityDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

export function canShowConvertButton(ctx: QuotationSoConversionContext): boolean {
  const { document, latestDocument, salesQuotation } = ctx
  if (document.status === 'converted' || document.salesOrderId || salesQuotation?.salesOrderId) {
    return false
  }
  return document.status === 'approved' && latestDocument?.id === document.id
}

export function validateQuotationForSoConversion(ctx: QuotationSoConversionContext): QuotationSoValidationResult {
  const { document, latestDocument, salesQuotation, customer, contactName } = ctx
  const issues: QuotationSoValidationIssue[] = []

  if (document.status === 'converted' || document.salesOrderId || salesQuotation?.salesOrderId) {
    issues.push({ id: 'already-converted', message: 'Quotation is already converted to a Sales Order.', blocking: true })
  }
  if (document.status !== 'sent' && document.status !== 'converted') {
    issues.push({
      id: 'not-sent',
      message: `Quotation must be sent to the customer before conversion — current status is ${document.status.replace(/_/g, ' ')}.`,
      blocking: true,
    })
  }
  if (latestDocument && latestDocument.id !== document.id) {
    issues.push({ id: 'not-latest', message: DISABLED_NOT_LATEST, blocking: true })
  }
  if (isQuotationExpired(salesQuotation)) {
    issues.push({ id: 'expired', message: 'Quotation validity has expired.', blocking: true })
  }
  if (!salesQuotation?.customerId) {
    issues.push({ id: 'no-customer', message: 'Customer must be selected on the quotation.', blocking: true })
  }
  if (customer && !customer.addressLine1?.trim()) {
    issues.push({ id: 'no-billing', message: 'Customer billing address is required.', blocking: true })
  }
  if (!document.contactId && !contactName && !customer?.contactPerson) {
    issues.push({ id: 'no-contact', message: 'Contact person is required.', blocking: true })
  }
  if (!document.approvalHistory.some((a) => a.action === 'approved')) {
    issues.push({ id: 'no-approval', message: 'Quotation internal approval must be completed.', blocking: true })
  }
  if (salesQuotation && salesQuotation.customerApproval !== 'approved') {
    issues.push({
      id: 'not-customer-accepted',
      message: 'Customer must approve the quotation before creating a sales order.',
      blocking: true,
    })
  }

  const lines = syncLineTotals(document.priceLines).filter((l) => !l.isOptional)
  if (!lines.length) {
    issues.push({ id: 'no-lines', message: 'At least one product / price line is required.', blocking: true })
  } else {
    const masters = useMasterStore.getState()
    const checkedIds = new Set<string>()
    for (const line of lines) {
      if (!line.qty || line.qty <= 0) {
        issues.push({ id: `qty-${line.id}`, message: `Quantity required for ${line.description || 'line item'}.`, blocking: true })
      }
      if (!line.unitPrice || line.unitPrice <= 0) {
        issues.push({ id: `price-${line.id}`, message: `Unit price required for ${line.description || 'line item'}.`, blocking: true })
      }
      const productId = line.productId ?? salesQuotation?.productId ?? null
      if (productId && !checkedIds.has(productId)) {
        checkedIds.add(productId)
        const product = masters.getProduct(productId)
        const sellable = assertProductSellableForSales(product)
        if (!sellable.ok) {
          issues.push({ id: `product-not-released-${productId}`, message: sellable.error, blocking: true })
        }
      }
    }
    if (salesQuotation?.productId && !checkedIds.has(salesQuotation.productId)) {
      const product = masters.getProduct(salesQuotation.productId)
      const sellable = assertProductSellableForSales(product)
      if (!sellable.ok) {
        issues.push({ id: `product-not-released-${salesQuotation.productId}`, message: sellable.error, blocking: true })
      }
    }
  }

  const summary = calcPriceSummary(lines, document.freightAmount, document.installationAmount, document.customCharges)
  if (summary.grandTotal <= 0) {
    issues.push({ id: 'no-total', message: 'Grand total must be greater than zero.', blocking: true })
  }
  if (summary.gstAmount <= 0 && lines.some((l) => l.taxPct > 0)) {
    issues.push({ id: 'no-gst', message: 'GST amount could not be calculated.', blocking: true })
  }

  const paymentTerms = sectionContent(document, 'payment') || salesQuotation?.paymentTerms
  const deliveryTerms = sectionContent(document, 'delivery') || salesQuotation?.deliveryTerms
  if (!paymentTerms?.trim()) {
    issues.push({ id: 'no-payment', message: 'Payment terms are required.', blocking: true })
  }
  if (!deliveryTerms?.trim()) {
    issues.push({ id: 'no-delivery', message: 'Delivery terms are required.', blocking: true })
  }
  if (!salesQuotation?.validityDate) {
    issues.push({ id: 'no-validity', message: 'Quotation validity date is required.', blocking: true })
  }

  const blocking = issues.filter((i) => i.blocking)
  const canConvert = blocking.length === 0
  let disabledReason: string | null = null
  if (!canConvert) {
    disabledReason = blocking.find((i) => i.id === 'not-latest')?.message
      ?? blocking[0]?.message
      ?? DISABLED_NOT_LATEST
  }

  return { ok: canConvert, canConvert, disabledReason, issues }
}

export function buildSoConversionPreview(ctx: QuotationSoConversionContext) {
  const { document, salesQuotation, customer, contactName, opportunityName, productName } = ctx
  const priced = summarizeQuotationLinesForSo(document)
  const line = priced.lines[0]
  return {
    quotationNo: salesQuotation?.quotationNo ?? document.quotationId,
    revisionNo: document.revisionNo,
    customerName: customer?.customerName ?? '—',
    contactName: contactName ?? customer?.contactPerson ?? '—',
    opportunityName: opportunityName ?? '—',
    productName: priced.lineCount > 1 ? quotationLineItemsSummary(document) : productName ?? line?.productOrItem ?? '—',
    lineCount: priced.lineCount,
    quantity: priced.totalQty,
    basicAmount: priced.summary.taxableValue,
    gstAmount: priced.summary.gstAmount,
    grandTotal: priced.summary.grandTotal,
    paymentTerms: sectionContent(document, 'payment') || salesQuotation?.paymentTerms || '—',
    deliveryTerms: sectionContent(document, 'delivery') || salesQuotation?.deliveryTerms || '—',
    validTill: salesQuotation?.validityDate ?? '—',
    salesOwner: document.salesOwnerName ?? '—',
    lines: priced.lines.map((l) => ({
      productOrItem: l.productOrItem,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  }
}
