import { Link } from 'react-router-dom'
import { FactBox, FactBoxPanel } from '@/components/design-system/FactBox'
import { ErpFactBoxPanel } from '@/components/erp/card-form/ErpFactBoxPanel'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

export type PurchaseDocumentFactBoxRelatedKind =
  | 'pr'
  | 'rfq'
  | 'quotation'
  | 'comparison'
  | 'grn'
  | 'invoice'
  | 'return'
  | 'blanket'
  | 'po'

export type PurchaseDocumentFactBoxRelatedLink = {
  kind: PurchaseDocumentFactBoxRelatedKind
  id: string
  number: string
  status?: string
}

export type PurchaseDocumentFactBoxVendor = {
  id?: string
  code?: string
  name?: string
  rating?: number
  paymentTerms?: string
  leadTimeDays?: number
  outstandingBalance?: number
  creditLimit?: number
  lastPurchaseDate?: string | null
  lastPurchaseValue?: number | null
}

export type PurchaseDocumentFactBoxHistory = {
  lastPurchasePrice?: number | null
  lastVendorName?: string | null
  averageLeadTimeDays?: number | null
  previousRejectionRatePct?: number | null
}

export type PurchaseDocumentFactBoxStatus = {
  statusLabel: string
  currentApprover?: string | null
  approvalLevel?: string | null
  createdBy?: string | null
  modifiedBy?: string | null
  modifiedDate?: string | null
}

export type PurchaseDocumentFactBoxProps = {
  vendor?: PurchaseDocumentFactBoxVendor | null
  /** Optional overrides / line hints; missing fields are derived for demo. */
  purchaseHistory?: PurchaseDocumentFactBoxHistory
  documentStatus: PurchaseDocumentFactBoxStatus
  related?: PurchaseDocumentFactBoxRelatedLink[]
  title?: string
  className?: string
}

const RELATED_PATH: Record<PurchaseDocumentFactBoxRelatedKind, (id: string) => string> = {
  pr: (id) => `/purchase/requisitions/${id}`,
  rfq: (id) => `/purchase/rfqs/${id}`,
  quotation: (id) => `/purchase/vendor-quotations/${id}`,
  comparison: (id) => `/purchase/comparison/${id}`,
  grn: (id) => `/purchase/grn/${id}`,
  invoice: (id) => `/purchase/invoices/${id}`,
  return: (id) => `/purchase/returns/${id}`,
  blanket: (id) => `/purchase/orders?blanket=${id}`,
  po: (id) => `/purchase/orders/${id}`,
}

const RELATED_LABEL: Record<PurchaseDocumentFactBoxRelatedKind, string> = {
  pr: 'PR',
  rfq: 'RFQ',
  quotation: 'Vendor Quotation',
  comparison: 'Quotation Comparison',
  grn: 'GRN',
  invoice: 'Purchase Invoice',
  return: 'Return',
  blanket: 'Blanket Order',
  po: 'Purchase Order',
}

/** Stable demo numbers from an id — avoids random flicker without MDM fields. */
function demoSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

export function derivePurchaseVendorDemoInsights(
  vendor: Pick<PurchaseDocumentFactBoxVendor, 'id' | 'rating' | 'leadTimeDays'>,
) {
  const id = vendor.id ?? 'vendor'
  const seed = demoSeed(id)
  const rating = vendor.rating ?? 3 + (seed % 20) / 10
  const lead = vendor.leadTimeDays ?? 7 + (seed % 14)
  const creditLimit = 250_000 + (seed % 20) * 50_000
  const outstandingBalance = Math.round(creditLimit * (0.08 + (seed % 35) / 100))
  const daysAgo = 14 + (seed % 90)
  const lastPurchaseDate = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
  const lastPurchaseValue = Math.round((15_000 + (seed % 80) * 1_250) / 100) * 100
  const lastPurchasePrice = Math.round((40 + (seed % 120) + (seed % 10) / 10) * 100) / 100
  const previousRejectionRatePct = Math.round(((seed % 80) / 10) * 10) / 10

  return {
    rating: Math.round(rating * 10) / 10,
    outstandingBalance,
    creditLimit,
    lastPurchaseDate,
    lastPurchaseValue,
    lastPurchasePrice,
    averageLeadTimeDays: lead,
    previousRejectionRatePct,
  }
}

function dash(value: string | number | null | undefined, empty = '—') {
  if (value == null || value === '') return empty
  return value
}

/**
 * Business Central–style right-rail FactBox for purchase documents.
 * Dense panels: Vendor Summary, Purchase History, Document Status, Related Documents.
 */
export function PurchaseDocumentFactBox({
  vendor,
  purchaseHistory,
  documentStatus,
  related = [],
  title = 'Details',
  className,
}: PurchaseDocumentFactBoxProps) {
  const derived = vendor?.id || vendor?.name
    ? derivePurchaseVendorDemoInsights({
        id: vendor.id ?? vendor.name ?? 'vendor',
        rating: vendor.rating,
        leadTimeDays: vendor.leadTimeDays,
      })
    : null

  const rating = vendor?.rating ?? derived?.rating
  const outstanding = vendor?.outstandingBalance ?? derived?.outstandingBalance
  const creditLimit = vendor?.creditLimit ?? derived?.creditLimit
  const paymentTerms = vendor?.paymentTerms
  const lastPurchaseDate = vendor?.lastPurchaseDate ?? derived?.lastPurchaseDate ?? null
  const lastPurchaseValue = vendor?.lastPurchaseValue ?? derived?.lastPurchaseValue ?? null

  const lastPrice = purchaseHistory?.lastPurchasePrice ?? derived?.lastPurchasePrice ?? null
  const lastVendor =
    purchaseHistory?.lastVendorName ?? (vendor?.name ? vendor.name : null)
  const avgLead =
    purchaseHistory?.averageLeadTimeDays ??
    vendor?.leadTimeDays ??
    derived?.averageLeadTimeDays ??
    null
  const rejection =
    purchaseHistory?.previousRejectionRatePct ?? derived?.previousRejectionRatePct ?? null

  const modified =
    documentStatus.modifiedBy || documentStatus.modifiedDate
      ? [documentStatus.modifiedBy, documentStatus.modifiedDate].filter(Boolean).join(' · ')
      : '—'

  const vendorFields = vendor?.id || vendor?.name
    ? [
        {
          label: 'Vendor',
          value: vendor.code ? `${vendor.code} — ${vendor.name ?? ''}` : dash(vendor.name),
        },
        { label: 'Rating', value: rating != null ? `${rating} / 5` : '—' },
        {
          label: 'Outstanding',
          value: outstanding != null ? formatCurrency(outstanding) : '—',
        },
        {
          label: 'Credit Limit',
          value: creditLimit != null ? formatCurrency(creditLimit) : '—',
        },
        { label: 'Payment Terms', value: dash(paymentTerms) },
        {
          label: 'Last Purchase',
          value: lastPurchaseDate ? formatDate(lastPurchaseDate) : '—',
        },
        {
          label: 'Last Purchase Value',
          value: lastPurchaseValue != null ? formatCurrency(lastPurchaseValue) : '—',
        },
      ]
    : [
        { label: 'Vendor', value: 'Not selected' },
        { label: 'Rating', value: '—' },
        { label: 'Outstanding', value: '—' },
        { label: 'Credit Limit', value: '—' },
        { label: 'Payment Terms', value: '—' },
        { label: 'Last Purchase', value: '—' },
        { label: 'Last Purchase Value', value: '—' },
      ]

  const historyFields = [
    {
      label: 'Last Purchase Price',
      value: lastPrice != null ? formatCurrency(lastPrice) : '—',
    },
    { label: 'Last Vendor', value: dash(lastVendor) },
    {
      label: 'Avg Lead Time',
      value: avgLead != null ? `${avgLead} days` : '—',
    },
    {
      label: 'Prev. Rejection Rate',
      value: rejection != null ? `${rejection}%` : '—',
    },
  ]

  const statusFields = [
    { label: 'Status', value: dash(documentStatus.statusLabel) },
    { label: 'Current Approver', value: dash(documentStatus.currentApprover) },
    { label: 'Approval Level', value: dash(documentStatus.approvalLevel) },
    { label: 'Created By', value: dash(documentStatus.createdBy) },
    { label: 'Last Modified', value: modified },
  ]

  return (
    <ErpFactBoxPanel title={title} sticky className={cn('purchase-document-factbox', className)}>
      <FactBoxPanel className="space-y-2">
        <FactBox title="Vendor Summary" fields={vendorFields} defaultOpen />
        <FactBox title="Purchase History" fields={historyFields} defaultOpen />
        <FactBox title="Document Status" fields={statusFields} defaultOpen />
        <FactBox
          title="Related Documents"
          defaultOpen
          fields={
            related.length === 0
              ? [{ label: 'Linked', value: 'None' }]
              : related.map((doc) => ({
                  label: RELATED_LABEL[doc.kind],
                  value: (
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <Link
                        to={RELATED_PATH[doc.kind](doc.id)}
                        className="font-mono text-erp-primary hover:underline"
                      >
                        {doc.number}
                      </Link>
                      {doc.status ? (
                        <span className="text-[10px] font-normal text-erp-muted">{doc.status}</span>
                      ) : null}
                    </span>
                  ),
                }))
          }
        />
      </FactBoxPanel>
    </ErpFactBoxPanel>
  )
}

/** Build related links from common purchase header / linked-document shapes. */
export function buildPurchaseRelatedLinks(input: {
  purchaseRequisitionId?: string | null
  purchaseRequisitionNumber?: string | null
  rfqId?: string | null
  rfqNumber?: string | null
  vendorQuotationId?: string | null
  vendorQuotationNumber?: string | null
  comparisonId?: string | null
  comparisonNumber?: string | null
  blanketOrderId?: string | null
  blanketOrderNumber?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  goodsReceiptId?: string | null
  goodsReceiptNumber?: string | null
  grns?: Array<{ id: string; documentNumber: string; status?: string }>
  invoices?: Array<{ id: string; documentNumber: string; status?: string }>
  returns?: Array<{ id: string; documentNumber: string; status?: string }>
}): PurchaseDocumentFactBoxRelatedLink[] {
  const links: PurchaseDocumentFactBoxRelatedLink[] = []
  if (input.purchaseRequisitionId && input.purchaseRequisitionNumber) {
    links.push({ kind: 'pr', id: input.purchaseRequisitionId, number: input.purchaseRequisitionNumber })
  }
  if (input.rfqId && input.rfqNumber) {
    links.push({ kind: 'rfq', id: input.rfqId, number: input.rfqNumber })
  }
  if (input.vendorQuotationId && input.vendorQuotationNumber) {
    links.push({
      kind: 'quotation',
      id: input.vendorQuotationId,
      number: input.vendorQuotationNumber,
    })
  }
  if (input.comparisonId && input.comparisonNumber) {
    // Comparison route is keyed by RFQ id
    links.push({
      kind: 'comparison',
      id: input.rfqId ?? input.comparisonId,
      number: input.comparisonNumber,
    })
  }
  if (input.blanketOrderId && input.blanketOrderNumber) {
    links.push({ kind: 'blanket', id: input.blanketOrderId, number: input.blanketOrderNumber })
  }
  if (input.purchaseOrderId && input.purchaseOrderNumber) {
    links.push({ kind: 'po', id: input.purchaseOrderId, number: input.purchaseOrderNumber })
  }
  if (input.goodsReceiptId && input.goodsReceiptNumber) {
    links.push({ kind: 'grn', id: input.goodsReceiptId, number: input.goodsReceiptNumber })
  }
  for (const g of input.grns ?? []) {
    links.push({ kind: 'grn', id: g.id, number: g.documentNumber, status: g.status })
  }
  for (const inv of input.invoices ?? []) {
    links.push({ kind: 'invoice', id: inv.id, number: inv.documentNumber, status: inv.status })
  }
  for (const r of input.returns ?? []) {
    links.push({ kind: 'return', id: r.id, number: r.documentNumber, status: r.status })
  }
  return links
}

export function purchaseDocumentApprovalFact(
  status: string,
  approverName?: string | null,
): Pick<PurchaseDocumentFactBoxStatus, 'currentApprover' | 'approvalLevel'> {
  const s = status.toLowerCase()
  if (s.includes('pending') || s === 'pending_approval' || s === 'submitted') {
    return {
      currentApprover: approverName || 'Purchase Head',
      approvalLevel: 'Level 1 · Purchase Head',
    }
  }
  if (s.includes('draft') || s === 'new') {
    return { currentApprover: '—', approvalLevel: 'Not submitted' }
  }
  if (approverName) {
    return { currentApprover: approverName, approvalLevel: 'Complete' }
  }
  return { currentApprover: '—', approvalLevel: '—' }
}
