import type { QuotationDocument } from '../types/crm'
import type { Customer } from '../types/master'
import type { Quotation } from '../types/sales'
import { calcPriceSummary, syncLineTotals } from './crmQuotationCalc'
import { sectionContent } from './crmIntegration'
import { quotationLineItemsSummary, summarizeQuotationLinesForSo } from './crmQuotationSoLines'
import { useMasterStore } from '../store/masterStore'
import { canUseItemInSales } from './opportunityItemOptions'

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
  /** Fallback when sales quotation header is not hydrated (API list). */
  customerId?: string | null
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

const DISABLED_NOT_LATEST = 'Only the latest quotation revision can be converted to a Sales Order.'

export function isQuotationExpired(salesQuotation?: Quotation): boolean {
  if (!salesQuotation?.validityDate) return false
  return salesQuotation.validityDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

export function canShowConvertButton(ctx: QuotationSoConversionContext): boolean {
  const { document, latestDocument, salesQuotation } = ctx
  if (document.status === 'converted' || document.salesOrderId || salesQuotation?.salesOrderId) {
    return false
  }
  if (document.status === 'superseded' || document.status === 'rejected') return false
  if (salesQuotation?.customerApproval === 'rejected') return false
  return latestDocument?.id === document.id
}

export function validateQuotationForSoConversion(ctx: QuotationSoConversionContext): QuotationSoValidationResult {
  const { document, latestDocument, salesQuotation, customer, contactName, customerId: fallbackCustomerId } = ctx
  const issues: QuotationSoValidationIssue[] = []

  if (document.status === 'converted' || document.salesOrderId || salesQuotation?.salesOrderId) {
    issues.push({ id: 'already-converted', message: 'Quotation is already converted to a Sales Order.', blocking: true })
  }
  if (document.status === 'superseded') {
    issues.push({ id: 'superseded', message: 'Superseded revisions cannot be converted.', blocking: true })
  }
  if (document.status === 'rejected') {
    issues.push({
      id: 'internally-rejected',
      message: 'Internally rejected quotations cannot be converted — recall to draft or create a new revision.',
      blocking: true,
    })
  }
  if (salesQuotation?.customerApproval === 'rejected') {
    issues.push({
      id: 'customer-rejected',
      message: 'Customer-rejected quotations cannot be converted — create a new revision first.',
      blocking: true,
    })
  }
  // Send / internal approval / customer approval remain optional (non-blocking tips).
  if (document.status !== 'sent' && document.status !== 'converted') {
    issues.push({
      id: 'not-sent',
      message: 'Optional: send to customer and record approval before converting (not required for a direct sales order).',
      blocking: false,
    })
  }
  if (!document.approvalHistory.some((a) => a.action === 'approved')) {
    issues.push({
      id: 'no-approval',
      message: 'Optional: internal approval has not been completed yet.',
      blocking: false,
    })
  }
  if (salesQuotation && salesQuotation.customerApproval !== 'approved' && salesQuotation.customerApproval !== 'rejected') {
    issues.push({
      id: 'not-customer-accepted',
      message: 'Optional: customer approval has not been recorded yet.',
      blocking: false,
    })
  }
  if (latestDocument && latestDocument.id !== document.id) {
    issues.push({ id: 'not-latest', message: DISABLED_NOT_LATEST, blocking: true })
  }
  if (isQuotationExpired(salesQuotation)) {
    issues.push({ id: 'expired', message: 'Quotation validity has expired.', blocking: true })
  }
  const resolvedCustomerId = salesQuotation?.customerId || fallbackCustomerId || customer?.id || null
  if (!resolvedCustomerId) {
    issues.push({ id: 'no-customer', message: 'Customer must be selected on the quotation.', blocking: true })
  }
  if (customer && !customer.addressLine1?.trim()) {
    issues.push({ id: 'no-billing', message: 'Customer billing address is required.', blocking: true })
  }
  if (!document.contactId && !contactName && !customer?.contactPerson) {
    issues.push({ id: 'no-contact', message: 'Contact person is required.', blocking: true })
  }

  const lines = syncLineTotals(document.priceLines).filter((l) => !l.isOptional)
  if (!lines.length) {
    issues.push({ id: 'no-lines', message: 'At least one product / price line is required.', blocking: true })
  } else {
    const checkedIds = new Set<string>()
    for (const line of lines) {
      if (!line.qty || line.qty <= 0) {
        issues.push({ id: `qty-${line.id}`, message: `Quantity required for ${line.description || 'line item'}.`, blocking: true })
      }
      if (!line.unitPrice || line.unitPrice <= 0) {
        issues.push({ id: `price-${line.id}`, message: `Unit price required for ${line.description || 'line item'}.`, blocking: true })
      }
      let lineItemId: string | null = line.itemId ?? null
      if (!lineItemId && line.productId) {
        lineItemId = useMasterStore.getState().getProduct(line.productId)?.fgItemId ?? null
      }
      if (!lineItemId) {
        lineItemId = salesQuotation?.itemId ?? null
      }
      if (lineItemId && !checkedIds.has(lineItemId)) {
        checkedIds.add(lineItemId)
        const sellable = canUseItemInSales(lineItemId)
        if (!sellable.ok) {
          issues.push({ id: `item-not-sellable-${lineItemId}`, message: sellable.error ?? 'Item is not allowed for sales', blocking: true })
        }
      } else if (!lineItemId && (line.productOrItem || line.description)) {
        issues.push({
          id: `item-missing-${line.id}`,
          message: `Select an Item for ${line.description || line.productOrItem || 'line item'}.`,
          blocking: true,
        })
      }
    }
  }

  const summary = calcPriceSummary(lines, document)
  if (summary.grandTotal <= 0) {
    issues.push({ id: 'no-total', message: 'Grand total must be greater than zero.', blocking: true })
  }
  if (summary.gstAmount <= 0 && lines.some((l) => l.taxPct > 0)) {
    issues.push({ id: 'no-gst', message: 'GST amount could not be calculated.', blocking: true })
  }

  const paymentTerms = salesQuotation?.paymentTerms?.trim() || sectionContent(document, 'payment')
  const deliveryTerms = salesQuotation?.deliveryTerms?.trim() || sectionContent(document, 'delivery')
  const deliveryTime = (salesQuotation as { deliveryTime?: string } | undefined)?.deliveryTime?.trim() || ''
  if (!paymentTerms?.trim()) {
    issues.push({ id: 'no-payment', message: 'Payment terms are required.', blocking: true })
  }
  if (!deliveryTerms?.trim()) {
    issues.push({ id: 'no-delivery', message: 'Delivery terms are required.', blocking: true })
  }
  if (!deliveryTime?.trim()) {
    issues.push({
      id: 'no-delivery-time',
      message: 'Optional: set delivery time / lead time on the quotation header.',
      blocking: false,
    })
  }
  if (!salesQuotation?.validityDate) {
    issues.push({
      id: 'no-validity',
      message: 'Optional: validity date is not set on the quotation — a default validity is applied on conversion.',
      blocking: false,
    })
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
    paymentTerms: salesQuotation?.paymentTerms?.trim() || sectionContent(document, 'payment') || '',
    deliveryTerms: salesQuotation?.deliveryTerms?.trim() || sectionContent(document, 'delivery') || '',
    deliveryTime: (salesQuotation as { deliveryTime?: string } | undefined)?.deliveryTime?.trim() || '',
    validTill: salesQuotation?.validityDate
      ? salesQuotation.validityDate
      : '',
    salesOwner: document.salesOwnerName ?? '—',
    lines: priced.lines.map((l) => ({
      productOrItem: l.productOrItem,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  }
}
