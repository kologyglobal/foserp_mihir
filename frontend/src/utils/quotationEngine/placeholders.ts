import type { QuotationDocument, QuotationSection } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { calcPriceSummary, syncLineTotals } from '../crmQuotationCalc'
import { formatCurrency } from '../formatters/currency'
import { amountInWordsINR } from './amountInWords'
import { QUOTATION_COMPANY } from './companyProfile'
import { sectionContent } from '../crmIntegration'
import { formatDate } from '../dates/format'
import { opportunityRequirementDisplay } from '../leadRequirementLines'

export interface QuotationMergeContext {
  document: QuotationDocument
  quotation?: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contactName?: string
}

export const QUOTATION_PLACEHOLDERS = [
  'quotation_no',
  'quotation_date',
  'reference_no',
  'customer_name',
  'customer_address',
  'contact_person',
  'contact_mobile',
  'contact_email',
  'opportunity_no',
  'product_name',
  'product_capacity',
  'quantity',
  'basic_price',
  'gst_rate',
  'gst_amount',
  'grand_total',
  'amount_in_words',
  'payment_terms',
  'delivery_time',
  'validity_days',
  'authorized_person',
  'designation',
  'company_name',
  'company_gstin',
] as const

export type QuotationPlaceholderKey = (typeof QUOTATION_PLACEHOLDERS)[number]

function fmtDate(iso?: string | null) {
  if (!iso) return formatDate(new Date().toISOString())
  return formatDate(iso)
}

function fmtMoney(n: number) {
  return formatCurrency(n)
}

export function buildQuotationMergeMap(ctx: QuotationMergeContext): Record<QuotationPlaceholderKey, string> {
  const { document, quotation, customer, opportunity, contactName } = ctx
  const lines = syncLineTotals(document.priceLines)
  const summary = calcPriceSummary(lines, document.freightAmount, document.installationAmount, document.customCharges)
  const primary = lines.find((l) => !l.isOptional) ?? lines[0]
  const payment = sectionContent(document, 'payment')
  const delivery = sectionContent(document, 'delivery')
  const validityMatch = sectionContent(document, 'commercial').match(/(\d+)\s*days/i)

  return {
    quotation_no: quotation?.quotationNo ?? document.quotationId,
    quotation_date: fmtDate(quotation?.createdAt ?? document.createdAt),
    reference_no: opportunity?.opportunityNo ?? quotation?.inquiryNo ?? '—',
    customer_name: customer?.customerName ?? '—',
    customer_address: customer ? [customer.addressLine1, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') : '—',
    contact_person: contactName ?? customer?.contactPerson ?? '—',
    contact_mobile: customer?.contactPhone ?? '—',
    contact_email: customer?.contactEmail ?? '—',
    opportunity_no: opportunity?.opportunityNo ?? '—',
    product_name: primary?.productOrItem ?? opportunity?.opportunityName ?? '—',
    product_capacity:
      opportunityRequirementDisplay(opportunity?.productRequirement)?.split('\n')[0]
      || primary?.description
      || '—',
    quantity: primary ? String(primary.qty) : '1',
    basic_price: fmtMoney(summary.basicAmount),
    gst_rate: primary ? `${primary.taxPct}%` : '18%',
    gst_amount: fmtMoney(summary.gstAmount),
    grand_total: fmtMoney(summary.grandTotal),
    amount_in_words: amountInWordsINR(summary.grandTotal),
    payment_terms: payment || quotation?.paymentTerms || 'As per commercial terms',
    delivery_time: delivery || quotation?.deliveryTerms || 'As agreed',
    // Prefer explicit "N days" from commercial copy; never dump a raw validity Date into a days slot
    validity_days: validityMatch?.[1] ?? '30',
    authorized_person: QUOTATION_COMPANY.authorizedPerson,
    designation: QUOTATION_COMPANY.designation,
    company_name: QUOTATION_COMPANY.legalName,
    company_gstin: QUOTATION_COMPANY.gstin,
  }
}

const PLACEHOLDER_RE = /\{\{([a-z0-9_]+)\}\}/gi

export function resolvePlaceholders(text: string, map: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => map[key] ?? `{{${key}}}`)
}

export function resolveSectionContent(section: QuotationSection, map: Record<string, string>): string {
  if (section.contentFormat === 'spec_table' && section.specRows?.length) {
    return section.specRows.map((r) => {
      const label = resolvePlaceholders(r.label, map)
      const value = resolvePlaceholders(r.value, map)
      return r.sectionNo ? `${r.sectionNo} ${label}: ${value}` : `${label}: ${value}`
    }).join('\n')
  }
  return resolvePlaceholders(section.content, map)
}

export function findUnresolvedPlaceholders(text: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null
  const re = /\{\{([a-z0-9_]+)\}\}/gi
  while ((m = re.exec(text)) !== null) found.add(m[1])
  return [...found]
}

export function findMissingPlaceholderValues(map: Record<string, string>): string[] {
  return Object.entries(map)
    .filter(([, v]) => v === '—' || !v?.trim())
    .map(([k]) => k)
}
