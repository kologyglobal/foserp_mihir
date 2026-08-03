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
  /** Raw document status: draft | pending_approval | approved | sent | converted | … */
  status: string
  customerApproval?: 'pending' | 'approved' | 'rejected' | null
  lineCount: number
  hasValidLine: boolean
  grandTotal: number
  validUntil?: string | null
  opportunityId?: string | null
  salesOrderId?: string | null
  ownerName?: string
  lastSavedLabel?: string
  /** When true, commercial checks pass and Convert to SO is enabled (send/approval optional). */
  canConvertDirect?: boolean
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
  deliveryTime?: string | null
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
  const hasDeliveryTime = Boolean(input.deliveryTime?.trim())
  const sourceComplete =
    input.createMode === 'opportunity' ? input.opportunitySelected : true
  // Validity dates live in Quotation Information (top) with customer/template.
  const customerComplete = hasCustomer && hasValidity
  const commercialComplete =
    input.grandTotal > 0 && hasPayment && hasDelivery && hasDeliveryTime
  const commercialStarted =
    input.grandTotal > 0 || hasPayment || hasDelivery || hasDeliveryTime
  const productsStarted = input.lineCount > 0 || input.hasValidLine
  const customerStarted = hasCustomer || hasValidity

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
        started: customerStarted && !customerComplete,
        hasError: errorSet.has('customer') || errorSet.has('quick'),
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

  if (!input.customerId) missing.push({ id: 'company', label: 'Link a customer', tone: 'warn' })
  else ok.push({ id: 'company', label: 'Customer linked', tone: 'ok' })

  if (!input.hasValidLine) missing.push({ id: 'lines', label: 'Add line items', tone: 'warn' })
  else ok.push({ id: 'lines', label: `${input.lineCount} line(s)`, tone: 'ok' })

  if (input.grandTotal <= 0) missing.push({ id: 'total', label: 'Review totals', tone: 'warn' })
  else ok.push({ id: 'total', label: 'Totals ready', tone: 'ok' })

  if (!input.validUntil) missing.push({ id: 'validity', label: 'Set validity date', tone: 'warn' })
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
      focusField: 'customerId',
      sectionId: 'quick',
    }
  }
  if (!input.hasValidLine) {
    return {
      id: 'add_lines',
      title: 'Add Line Items',
      description: 'Add products or services so the quotation has a commercial offer.',
      ctaLabel: 'Add Lines',
      focusField: 'products',
      sectionId: 'products',
    }
  }
  if (!input.validUntil) {
    return {
      id: 'set_validity',
      title: 'Set Validity',
      description: 'Define how long this quotation remains valid for the customer.',
      ctaLabel: 'Set Validity',
      focusField: 'validUntil',
      sectionId: 'commercial',
    }
  }

  if (input.salesOrderId) {
    return {
      id: 'review',
      title: 'View Sales Order',
      description: 'This quotation is converted. Continue fulfilment from the sales order.',
      ctaLabel: 'Review Quotation',
    }
  }

  const status = input.status.toLowerCase().replace(/\s+/g, '_')
  const customerApproval = input.customerApproval ?? 'pending'

  // Direct convert is available whenever commercial readiness passes — approval/send are optional.
  if (input.canConvertDirect && status !== 'converted' && status !== 'rejected') {
    return {
      id: 'convert_so',
      title: 'Convert to Sales Order',
      description:
        customerApproval === 'approved'
          ? 'Customer approved — convert to an Open sales order (marks the opportunity Won).'
          : 'Commercial details are ready. Convert now, or continue optional Send / Customer Approve first.',
      ctaLabel: 'Convert to Sales Order',
    }
  }

  if (status === 'draft' || status === 'rejected') {
    return {
      id: 'submit_approval',
      title: 'Submit for Internal Approval',
      description: 'Optional path — submit for internal approval, or finish commercial details and convert directly.',
      ctaLabel: 'Submit for Approval',
    }
  }
  if (status === 'pending_approval') {
    return {
      id: 'approve',
      title: 'Approve Quotation',
      description: 'Pending internal approval — approve or reject this quotation (optional before convert).',
      ctaLabel: 'Approve',
    }
  }
  if (status === 'approved') {
    return {
      id: 'send',
      title: 'Send to Customer',
      description: 'Internally approved — send to the customer, or convert directly to a sales order.',
      ctaLabel: 'Send to Customer',
    }
  }
  if (status === 'sent' && customerApproval === 'pending') {
    return {
      id: 'customer_approve',
      title: 'Customer Approve',
      description: 'Optional — record customer approval, or convert directly to a sales order.',
      ctaLabel: 'Customer Approve',
    }
  }
  if (status === 'sent' && customerApproval === 'approved') {
    return {
      id: 'convert_so',
      title: 'Convert to Sales Order',
      description: 'Customer approved — convert to an Open sales order (marks the opportunity Won).',
      ctaLabel: 'Convert to Sales Order',
    }
  }
  if (status === 'converted') {
    return {
      id: 'review',
      title: 'Converted',
      description: 'Quotation is already converted to a sales order.',
      ctaLabel: 'Review Quotation',
    }
  }

  return {
    id: 'review',
    title: 'Review Quotation',
    description: 'Approval and send are optional. Convert when commercial details are ready.',
    ctaLabel: 'Review Quotation',
  }
}

export function buildQuotationAiInsight(input: QuotationSmartOverviewInput): string | null {
  if (!input.customerId) return 'Link a customer first so pricing, tax, and credit context stay on the account.'
  if (!input.hasValidLine) return 'Customer is set. Add line items to build a sendable commercial offer.'
  if (!input.validUntil) return 'Lines look good. Set a validity date before sharing the quotation.'
  if (input.salesOrderId) return 'This quotation already has a sales order. Use Order 360 for execution.'
  if (input.canConvertDirect) {
    return 'Ready to convert — Send and Customer Approve are optional if you want a direct sales order.'
  }
  const status = input.status.toLowerCase().replace(/\s+/g, '_')
  if (status === 'approved') return 'Approved internally. Send to the customer, or convert directly when ready.'
  if (status === 'sent' && (input.customerApproval ?? 'pending') === 'pending') {
    return 'Sent to customer. Record approval, or convert directly to a sales order.'
  }
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
  const s = input.status.toLowerCase().replace(/\s+/g, '_')
  const tone: CrmSmartChip['tone'] =
    s === 'converted' || (s === 'sent' && input.customerApproval === 'approved') ? 'success'
      : s === 'rejected' || s === 'expired' || s === 'cancelled' || input.customerApproval === 'rejected' ? 'critical'
        : s === 'sent' || s === 'approved' ? 'info'
          : s === 'pending_approval' ? 'warning'
            : 'neutral'
  return [{ label: input.status || 'Draft', tone }]
}

export function quotationOverviewTitle(input: QuotationSmartOverviewInput): string {
  return input.quotationNo.trim() || input.customerName.trim() || 'New Quotation'
}
