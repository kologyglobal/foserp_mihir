import type { QuotationDocument } from '../../types/crm'
import type { Quotation } from '../../types/sales'
import { formatDate } from '../dates/format'
import { sectionContent } from '../crmIntegration'

/** Labels used consistently on Detail, Preview, Print, and PDF. */
export const QUOTATION_COMMERCIAL_LABELS = {
  commercialValidity: 'Commercial Validity',
  validUntil: 'Valid Until',
  validityPeriod: 'Validity Period',
  currency: 'Currency',
  paymentTerms: 'Payment Terms',
  deliveryTerms: 'Delivery Terms',
  deliveryTime: 'Delivery Time',
} as const

export type QuotationCommercialFieldKey = keyof typeof QUOTATION_COMMERCIAL_LABELS

export interface QuotationCommercialField {
  key: QuotationCommercialFieldKey
  label: string
  value: string
  multiline?: boolean
}

const GENERIC_TERMS = new Set([
  'standard manufacturing terms apply.',
  'standard manufacturing terms apply',
  'as per commercial terms',
  'as agreed',
])

const CURRENCY_NAMES: Record<string, string> = {
  INR: 'Indian Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
}

export function formatQuotationCurrencyDisplay(code?: string | null): string {
  const c = (code?.trim() || 'INR').toUpperCase()
  const name = CURRENCY_NAMES[c]
  return name ? `${c} – ${name}` : c
}

function isMeaningfulText(value: string | null | undefined): value is string {
  const t = value?.trim() ?? ''
  if (!t) return false
  if (t === '-' || t === '-') return false
  if (GENERIC_TERMS.has(t.toLowerCase())) return false
  return true
}

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const day = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Whole calendar days from start (inclusive of start→end span used for validity period). */
export function daysBetweenDates(startIso: string, endIso: string): number | null {
  const a = parseDay(startIso)
  const b = parseDay(endIso)
  if (!a || !b) return null
  const ms = b.getTime() - a.getTime()
  if (ms < 0) return null
  return Math.round(ms / 86400000)
}

export function formatValidityPeriodLabel(days: number | null): string {
  if (days == null || !Number.isFinite(days) || days < 0) return ''
  if (days === 0) return 'Same day'
  if (days === 1) return '1 Day'
  return `${days} Days`
}

function resolveHeaderOrSection(
  header: string | null | undefined,
  document: QuotationDocument | undefined,
  sectionType: 'payment' | 'delivery' | 'commercial',
): string {
  if (isMeaningfulText(header)) return header.trim()
  if (!document) return ''
  const fromSection = sectionContent(document, sectionType)?.trim() ?? ''
  return isMeaningfulText(fromSection) ? fromSection : ''
}

export interface BuildQuotationCommercialFieldsInput {
  quotation: Pick<
    Quotation,
    'terms' | 'paymentTerms' | 'deliveryTerms' | 'deliveryTime' | 'validityDate' | 'createdAt'
  > & {
    currencyCode?: string | null
  }
  document?: QuotationDocument | null
  /** Override quotation date when editor has a separate date field */
  quotationDate?: string | null
  /** When true, always include currency even if only default INR applies. */
  includeDefaultCurrency?: boolean
}

/**
 * Build Commercial Terms rows from the **saved quotation record** (header fields preferred).
 * Blank / generic placeholder values are omitted — never emit N/A, null, or undefined.
 */
export function buildQuotationCommercialFields(
  input: BuildQuotationCommercialFieldsInput,
): QuotationCommercialField[] {
  const { quotation, document, includeDefaultCurrency = true } = input
  const quotationDate = input.quotationDate?.slice(0, 10) || quotation.createdAt?.slice(0, 10) || ''
  const validUntilRaw = quotation.validityDate?.trim() || ''

  const commercialValidity = resolveHeaderOrSection(quotation.terms, document ?? undefined, 'commercial')
  const paymentTerms = resolveHeaderOrSection(quotation.paymentTerms, document ?? undefined, 'payment')
  const deliveryTerms = resolveHeaderOrSection(quotation.deliveryTerms, document ?? undefined, 'delivery')
  const deliveryTime = isMeaningfulText(quotation.deliveryTime) ? quotation.deliveryTime.trim() : ''

  const periodDays =
    quotationDate && validUntilRaw ? daysBetweenDates(quotationDate, validUntilRaw) : null
  const validityPeriod = formatValidityPeriodLabel(periodDays)

  const currencyCode = quotation.currencyCode?.trim() || (includeDefaultCurrency ? 'INR' : '')
  const currency =
    currencyCode && (includeDefaultCurrency || quotation.currencyCode?.trim())
      ? formatQuotationCurrencyDisplay(currencyCode)
      : ''

  const rows: Array<QuotationCommercialField | null> = [
    commercialValidity
      ? {
          key: 'commercialValidity',
          label: QUOTATION_COMMERCIAL_LABELS.commercialValidity,
          value: commercialValidity,
          multiline: true,
        }
      : null,
    validUntilRaw
      ? {
          key: 'validUntil',
          label: QUOTATION_COMMERCIAL_LABELS.validUntil,
          value: formatDate(validUntilRaw),
        }
      : null,
    validityPeriod
      ? {
          key: 'validityPeriod',
          label: QUOTATION_COMMERCIAL_LABELS.validityPeriod,
          value: validityPeriod,
        }
      : null,
    currency
      ? {
          key: 'currency',
          label: QUOTATION_COMMERCIAL_LABELS.currency,
          value: currency,
        }
      : null,
    paymentTerms
      ? {
          key: 'paymentTerms',
          label: QUOTATION_COMMERCIAL_LABELS.paymentTerms,
          value: paymentTerms,
          multiline: true,
        }
      : null,
    deliveryTerms
      ? {
          key: 'deliveryTerms',
          label: QUOTATION_COMMERCIAL_LABELS.deliveryTerms,
          value: deliveryTerms,
          multiline: true,
        }
      : null,
    deliveryTime
      ? {
          key: 'deliveryTime',
          label: QUOTATION_COMMERCIAL_LABELS.deliveryTime,
          value: deliveryTime,
          multiline: true,
        }
      : null,
  ]

  return rows.filter((r): r is QuotationCommercialField => Boolean(r?.value?.trim()))
}

export function hasQuotationCommercialFields(input: BuildQuotationCommercialFieldsInput): boolean {
  return buildQuotationCommercialFields(input).length > 0
}

/** Prefer saved header commercial fields when converting to SO / other documents. */
export function resolveCommercialTermsForConversion(
  quotation:
    | Pick<Quotation, 'paymentTerms' | 'deliveryTerms' | 'deliveryTime' | 'terms' | 'validityDate'>
    | null
    | undefined,
  document?: QuotationDocument | null,
): {
  paymentTerms: string
  deliveryTerms: string
  deliveryTime: string
  commercialNotes: string
  validityDate: string
} {
  const paymentTerms = resolveHeaderOrSection(quotation?.paymentTerms, document ?? undefined, 'payment')
  const deliveryTerms = resolveHeaderOrSection(quotation?.deliveryTerms, document ?? undefined, 'delivery')
  const deliveryTime = isMeaningfulText(quotation?.deliveryTime) ? quotation!.deliveryTime!.trim() : ''
  const commercialNotes = resolveHeaderOrSection(quotation?.terms, document ?? undefined, 'commercial')
  return {
    paymentTerms,
    deliveryTerms,
    deliveryTime,
    commercialNotes,
    validityDate: quotation?.validityDate?.trim() || '',
  }
}
