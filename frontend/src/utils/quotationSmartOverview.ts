import type {
  CrmSmartChip,
  CrmSmartKeyDetail,
  CrmSmartNextAction,
  CrmSmartSignal,
} from '../components/crm/CrmSmartOverviewPanel'
import type { EnterpriseFormSectionStatus } from '../design-system/workspace/EnterpriseFormSectionNav'
import { formatCurrency } from './formatters/currency'
import { formatDate } from './dates/format'

export interface QuotationSmartOverviewInput {
  quotationNo: string
  customerName: string
  customerId: string | null
  status: string
  lineCount: number
  hasValidLine: boolean
  grandTotal: number
  validUntil?: string | null
  opportunityId?: string | null
  salesOrderId?: string | null
  ownerName?: string
  lastSavedLabel?: string
}

export function computeQuotationCompleteness(input: QuotationSmartOverviewInput): number {
  const checks = [
    Boolean(input.customerId),
    input.hasValidLine,
    input.grandTotal > 0,
    Boolean(input.validUntil),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export type QuotationFormSectionId =
  | 'source'
  | 'customer'
  | 'template'
  | 'products'
  | 'commercial'
  | 'documents'

export interface QuotationFormSectionCompletion {
  id: QuotationFormSectionId
  label: string
  status: EnterpriseFormSectionStatus
  /** Mandatory sections contribute to overall %; optional never inflate via empty state. */
  mandatory: boolean
  done: boolean
}

export interface QuotationFormCompletionInput {
  createMode: 'opportunity' | 'direct'
  opportunitySelected: boolean
  customerId: string | null | undefined
  templateId: string | null | undefined
  lineCount: number
  hasValidLine: boolean
  grandTotal: number
  validUntil: string | null | undefined
  paymentTerms?: string | null
  deliveryTerms?: string | null
  attachmentCount: number
  /** Section ids that currently have blocking validation messages. */
  errorSectionIds?: Iterable<string>
}

function mandatoryStatus(opts: {
  complete: boolean
  started: boolean
  hasError: boolean
}): EnterpriseFormSectionStatus {
  if (opts.hasError) return 'error'
  if (opts.complete) return 'complete'
  if (opts.started) return 'in_progress'
  return 'required'
}

/**
 * Section nav / completion model for quotation create.
 * Green check (`complete`) only when every mandatory field in the section is satisfied.
 */
export function buildQuotationFormSectionCompletion(
  input: QuotationFormCompletionInput,
): QuotationFormSectionCompletion[] {
  const errorSet = new Set(input.errorSectionIds ?? [])
  const hasCustomer = Boolean(input.customerId)
  const hasValidity = Boolean(input.validUntil?.trim())
  const hasTemplate = Boolean(input.templateId)
  const hasPayment = Boolean(input.paymentTerms?.trim())
  const hasDelivery = Boolean(input.deliveryTerms?.trim())
  const sourceComplete =
    input.createMode === 'opportunity' ? input.opportunitySelected : true
  // Customer section = linked company only. Validity / terms live under Commercial.
  const customerComplete = hasCustomer
  const commercialComplete =
    input.grandTotal > 0 && hasValidity && hasPayment && hasDelivery
  const commercialStarted =
    input.grandTotal > 0 || hasValidity || hasPayment || hasDelivery
  const productsStarted = input.lineCount > 0 || input.hasValidLine

  const sections: QuotationFormSectionCompletion[] = [
    {
      id: 'source',
      label: 'Source',
      mandatory: true,
      done: sourceComplete,
      status: mandatoryStatus({
        complete: sourceComplete,
        started: false,
        hasError: errorSet.has('source'),
      }),
    },
    {
      id: 'customer',
      label: 'Customer',
      mandatory: true,
      done: customerComplete,
      status: mandatoryStatus({
        complete: customerComplete,
        started: false,
        hasError: errorSet.has('customer'),
      }),
    },
    {
      id: 'template',
      label: 'Template',
      mandatory: true,
      done: hasTemplate,
      status: mandatoryStatus({
        complete: hasTemplate,
        started: false,
        hasError: errorSet.has('template'),
      }),
    },
    {
      id: 'products',
      label: 'Products',
      mandatory: true,
      done: input.hasValidLine,
      status: mandatoryStatus({
        complete: input.hasValidLine,
        started: productsStarted && !input.hasValidLine,
        hasError: errorSet.has('products'),
      }),
    },
    {
      id: 'commercial',
      label: 'Commercial',
      mandatory: true,
      done: commercialComplete,
      status: mandatoryStatus({
        complete: commercialComplete,
        started: commercialStarted && !commercialComplete,
        hasError: errorSet.has('commercial'),
      }),
    },
    {
      id: 'documents',
      label: 'Attachments',
      mandatory: false,
      done: input.attachmentCount > 0,
      status: errorSet.has('documents')
        ? 'error'
        : input.attachmentCount > 0
          ? 'complete'
          : 'optional',
    },
  ]

  return sections
}

/** Overall % from mandatory sections only (optional attachments excluded). */
export function computeQuotationFormCompletionPercent(
  sections: QuotationFormSectionCompletion[],
): number {
  const mandatory = sections.filter((s) => s.mandatory)
  if (mandatory.length === 0) return 0
  return Math.round((mandatory.filter((s) => s.done).length / mandatory.length) * 100)
}

export function buildQuotationSmartSignals(input: QuotationSmartOverviewInput): CrmSmartSignal[] {
  const missing: CrmSmartSignal[] = []
  const ok: CrmSmartSignal[] = []

  if (!input.customerId) missing.push({ id: 'company', label: 'Customer not linked', tone: 'warn' })
  else ok.push({ id: 'company', label: 'Customer linked', tone: 'ok' })

  if (!input.hasValidLine) missing.push({ id: 'lines', label: 'Line items incomplete', tone: 'warn' })
  else ok.push({ id: 'lines', label: `${input.lineCount} line(s)`, tone: 'ok' })

  if (input.grandTotal <= 0) missing.push({ id: 'total', label: 'Total not calculated', tone: 'warn' })
  else ok.push({ id: 'total', label: 'Totals ready', tone: 'ok' })

  if (!input.validUntil) missing.push({ id: 'validity', label: 'Validity date missing', tone: 'warn' })
  else ok.push({ id: 'validity', label: 'Validity set', tone: 'ok' })

  return [...missing, ...ok].slice(0, 3)
}

export function resolveQuotationNextBestAction(input: QuotationSmartOverviewInput): CrmSmartNextAction {
  if (!input.customerId) {
    return {
      id: 'link_customer',
      title: 'Link Customer',
      description: 'Select the company this quotation is for.',
      ctaLabel: 'Link Customer',
    }
  }
  if (!input.hasValidLine) {
    return {
      id: 'add_lines',
      title: 'Add Line Items',
      description: 'Add products or services so the quotation has a commercial offer.',
      ctaLabel: 'Add Lines',
    }
  }
  if (!input.validUntil) {
    return {
      id: 'set_validity',
      title: 'Set Validity',
      description: 'Define how long this quotation remains valid for the customer.',
      ctaLabel: 'Set Validity',
    }
  }
  if (!input.salesOrderId && ['accepted', 'approved'].includes(input.status.toLowerCase())) {
    return {
      id: 'convert_so',
      title: 'Convert to Sales Order',
      description: 'Quotation is approved — convert to an Open sales order (marks the opportunity Won).',
      ctaLabel: 'Convert to Sales Order',
    }
  }
  return {
    id: 'review',
    title: 'Review & Send',
    description: 'Quotation looks ready. Preview, share, or follow up with the customer.',
    ctaLabel: 'Review Quotation',
  }
}

export function buildQuotationAiInsight(input: QuotationSmartOverviewInput): string | null {
  if (!input.customerId) return 'Link a customer first so pricing, tax, and credit context stay on the account.'
  if (!input.hasValidLine) return 'Customer is set. Add line items to build a sendable commercial offer.'
  if (!input.validUntil) return 'Lines look good. Set a validity date before sharing the quotation.'
  if (input.salesOrderId) return 'This quotation already has a sales order. Use Order 360 for execution.'
  return null
}

export function buildQuotationKeyDetails(input: QuotationSmartOverviewInput): CrmSmartKeyDetail[] {
  return [
    { label: 'Customer', value: input.customerName || 'Not linked', muted: !input.customerId },
    {
      label: 'Grand Total',
      value: input.grandTotal > 0 ? formatCurrency(input.grandTotal) : '—',
      muted: input.grandTotal <= 0,
    },
    {
      label: 'Valid Until',
      value: input.validUntil ? formatDate(input.validUntil) : 'Not set',
      muted: !input.validUntil,
    },
    { label: 'Lines', value: String(input.lineCount) },
  ]
}

export function quotationOverviewChips(input: QuotationSmartOverviewInput): CrmSmartChip[] {
  const s = input.status.toLowerCase()
  const tone: CrmSmartChip['tone'] =
    s === 'accepted' || s === 'approved' ? 'success'
      : s === 'rejected' || s === 'expired' || s === 'cancelled' ? 'critical'
        : s === 'sent' ? 'info'
          : 'neutral'
  return [{ label: input.status || 'Draft', tone }]
}

export function quotationOverviewTitle(input: QuotationSmartOverviewInput): string {
  return input.quotationNo.trim() || input.customerName.trim() || 'New Quotation'
}
