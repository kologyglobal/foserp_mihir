import type { CrmContact, QuotationDocument, QuotationSection } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import type { Customer } from '../../types/master'
import type { Opportunity } from '../../types/crm'
import { calcPriceSummary, syncLineTotals } from '../crmQuotationCalc'
import { formatCurrency } from '../formatters/currency'
import { amountInWordsINR } from './amountInWords'
import { QUOTATION_COMPANY } from './companyProfile'
import { formatDate } from '../dates/format'
import { opportunityRequirementDisplay } from '../leadRequirementLines'
import {
  buildQuotationCommercialFields,
  daysBetweenDates,
  formatQuotationCurrencyDisplay,
  formatValidityPeriodLabel,
} from './commercialTermsDisplay'

export interface QuotationMergeContext {
  document: QuotationDocument
  quotation?: Quotation
  customer?: Customer
  opportunity?: Opportunity
  contact?: CrmContact | null
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
  'delivery_terms',
  'delivery_time',
  'validity_days',
  'validity_date',
  'validity_period',
  'currency',
  'commercial_validity',
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
  const { document, quotation, customer, opportunity, contact, contactName } = ctx
  const lines = syncLineTotals(document.priceLines)
  const summary = calcPriceSummary(lines, document)
  const primary = lines.find((l) => !l.isOptional) ?? lines[0]

  const commercial = quotation
    ? buildQuotationCommercialFields({ quotation, document })
    : []
  const byKey = Object.fromEntries(commercial.map((f) => [f.key, f.value])) as Partial<
    Record<(typeof commercial)[number]['key'], string>
  >

  const quotationDate = quotation?.createdAt ?? document.createdAt
  const validUntil = quotation?.validityDate ?? ''
  const periodDays =
    quotationDate && validUntil ? daysBetweenDates(quotationDate.slice(0, 10), validUntil.slice(0, 10)) : null
  const validityPeriod = byKey.validityPeriod || formatValidityPeriodLabel(periodDays)
  // Numeric days for {{validity_days}} only when derived from saved dates — never invent "30"
  const validityDays = periodDays != null ? String(periodDays) : ''

  return {
    quotation_no: quotation?.quotationNo ?? document.quotationId,
    quotation_date: fmtDate(quotationDate),
    reference_no: opportunity?.opportunityNo ?? quotation?.inquiryNo ?? '-',
    customer_name: customer?.customerName ?? '-',
    customer_address: customer ? [customer.addressLine1, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') : '-',
    contact_person: contactName ?? contact?.name ?? customer?.contactPerson ?? '-',
    contact_mobile: contact?.phone?.trim() || customer?.contactPhone || '-',
    contact_email: contact?.email?.trim() || customer?.contactEmail || '-',
    opportunity_no: opportunity?.opportunityNo ?? '-',
    product_name: primary?.productOrItem ?? opportunity?.opportunityName ?? '-',
    product_capacity:
      opportunityRequirementDisplay(opportunity?.productRequirement)?.split('\n')[0]
      || primary?.description
      || '-',
    quantity: primary ? String(primary.qty) : '1',
    basic_price: fmtMoney(summary.basicAmount),
    gst_rate: primary ? `${primary.taxPct}%` : '',
    gst_amount: fmtMoney(summary.gstAmount),
    grand_total: fmtMoney(summary.grandTotal),
    amount_in_words: amountInWordsINR(summary.grandTotal),
    // Always from saved quotation commercial fields (header preferred over section body)
    payment_terms: byKey.paymentTerms ?? '',
    delivery_terms: byKey.deliveryTerms ?? '',
    delivery_time: byKey.deliveryTime ?? '',
    validity_days: validityDays,
    validity_date: byKey.validUntil ?? (validUntil ? fmtDate(validUntil) : ''),
    validity_period: validityPeriod,
    currency: byKey.currency ?? formatQuotationCurrencyDisplay((quotation as { currencyCode?: string } | undefined)?.currencyCode),
    commercial_validity: byKey.commercialValidity ?? '',
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
    .filter(([, v]) => v === '-' || !v?.trim())
    .map(([k]) => k)
}
