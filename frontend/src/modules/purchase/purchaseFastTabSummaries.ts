import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, isValidTimestamp } from '@/utils/dates/format'

/** Join non-empty FastTab peek fragments with BC-style middots. */
export function joinFastTabSummary(parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(' · ')
}

export function formatFastTabDate(date: string | null | undefined): string | undefined {
  if (!date || !isValidTimestamp(date)) return undefined
  return formatDate(date)
}

export function commercialTermsSummary(opts: {
  expectedDelivery?: string | null
  paymentTerms?: string | null
  freightTerms?: string | null
  deliveryTerms?: string | null
  dueDate?: string | null
  priceBasis?: string | null
  validityDate?: string | null
}): string {
  const delivery = formatFastTabDate(opts.expectedDelivery)
  const due = formatFastTabDate(opts.dueDate)
  const validity = formatFastTabDate(opts.validityDate)
  return joinFastTabSummary([
    delivery ? `Expected Delivery: ${delivery}` : false,
    opts.paymentTerms?.trim() ? `Payment: ${opts.paymentTerms.trim()}` : false,
    opts.freightTerms?.trim()
      ? `Freight: ${opts.freightTerms.trim()}`
      : opts.deliveryTerms?.trim()
        ? `Delivery: ${opts.deliveryTerms.trim()}`
        : false,
    opts.priceBasis?.trim() ? `Price: ${opts.priceBasis.trim()}` : false,
    due ? `Due: ${due}` : false,
    !delivery && validity ? `Valid until: ${validity}` : false,
  ])
}

export function taxTotalsSummary(opts: {
  subtotal?: number
  tax?: number
  total?: number
}): string {
  return joinFastTabSummary([
    opts.subtotal != null ? `Subtotal ${formatCurrency(opts.subtotal)}` : false,
    opts.tax != null ? `GST ${formatCurrency(opts.tax)}` : false,
    opts.total != null ? `Total ${formatCurrency(opts.total)}` : false,
  ])
}

/** Open Tax & Totals when any monetary total / line amount is meaningful. */
export function hasMeaningfulTaxTotals(...amounts: Array<number | null | undefined>): boolean {
  return amounts.some((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) > 0)
}

export function notesSummary(...notes: Array<string | null | undefined>): string {
  const nonEmpty = notes.map((n) => n?.trim()).filter((n): n is string => Boolean(n))
  if (nonEmpty.length === 0) return ''
  const first = nonEmpty[0]
  const preview = first.length > 72 ? `${first.slice(0, 72)}…` : first
  if (nonEmpty.length === 1) return preview
  return `${nonEmpty.length} notes · ${preview}`
}

export function attachmentsSummary(count: number): string {
  if (count <= 0) return ''
  return `${count} attachment${count === 1 ? '' : 's'}`
}

export function termsAndAttachmentsSummary(opts: {
  notes?: Array<string | null | undefined>
  attachmentCount?: number
}): string {
  const noteBit = notesSummary(...(opts.notes ?? []))
  const attBit = attachmentsSummary(opts.attachmentCount ?? 0)
  return joinFastTabSummary([noteBit || false, attBit || false])
}

export function approvalActivitySummary(opts: {
  statusLabel?: string | null
  historyCount?: number
}): string {
  return joinFastTabSummary([
    opts.statusLabel?.trim() || false,
    opts.historyCount != null && opts.historyCount > 0
      ? `${opts.historyCount} event${opts.historyCount === 1 ? '' : 's'}`
      : false,
  ])
}

export function receivingSummary(opts: {
  warehouse?: string | null
  gateEntry?: string | null
  vehicle?: string | null
  qcRequired?: boolean | null
}): string {
  return joinFastTabSummary([
    opts.warehouse?.trim() ? `WH: ${opts.warehouse.trim()}` : false,
    opts.gateEntry?.trim() ? `Gate: ${opts.gateEntry.trim()}` : false,
    opts.vehicle?.trim() ? `Vehicle: ${opts.vehicle.trim()}` : false,
    opts.qcRequired != null ? (opts.qcRequired ? 'QC required' : 'QC not required') : false,
  ])
}
