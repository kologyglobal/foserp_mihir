import { CheckCircle2, Clock, FilePen, FileWarning } from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import {
  buildSparklineFromCounts,
  countSince,
  percentOf,
} from '../design-system/enterprise/enterpriseKpiUtils'
import type { PurchaseInvoiceListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export interface InvoiceKpiCounts {
  draft: number
  pendingApproval: number
  mismatchOrHold: number
  totalValue: number
}

function dailyCounts(
  rows: PurchaseInvoiceListRow[],
  predicate: (r: PurchaseInvoiceListRow) => boolean,
  days = 7,
): number[] {
  const counts: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    counts.push(
      rows.filter((r) => {
        if (!predicate(r)) return false
        const c = new Date(r.documentDate)
        return c >= day && c < next
      }).length,
    )
  }
  return counts
}

export function isInvoiceMismatchOrHold(row: PurchaseInvoiceListRow) {
  return row.status === 'mismatch' || row.status === 'on_hold' || row.matchStatus === 'mismatch'
}

export function isInvoiceNeedsAttention(row: PurchaseInvoiceListRow) {
  return (
    row.status === 'pending_verification' ||
    row.status === 'pending_approval' ||
    isInvoiceMismatchOrHold(row)
  )
}

export function isInvoiceReadyToPost(row: PurchaseInvoiceListRow) {
  return row.status === 'approved' || row.status === 'matched'
}

export function buildInvoiceRegisterKpiItems(
  rows: PurchaseInvoiceListRow[],
  summary: InvoiceKpiCounts,
  activeStatus: string,
  onFilter: (status: string) => void,
): EnterpriseKpiItem[] {
  const total = rows.length
  const now = Date.now()
  const draftValue = rows
    .filter((r) => r.status === 'draft')
    .reduce((s, r) => s + r.totalAmount, 0)
  const mismatchValue = rows
    .filter(isInvoiceMismatchOrHold)
    .reduce((s, r) => s + r.totalAmount, 0)

  const draftToday = rows.filter(
    (r) => r.status === 'draft' && countSince(r.documentDate, 0),
  ).length
  const pendingWeek = rows.filter(
    (r) => r.status === 'pending_approval' && countSince(r.documentDate, 7),
  ).length

  return [
    {
      id: 'draft',
      label: 'Draft',
      value: summary.draft,
      icon: FilePen,
      accent: 'slate',
      active: activeStatus === 'draft',
      context:
        total > 0
          ? `${percentOf(summary.draft, total)} of total · ${formatCompactCurrency(draftValue)}`
          : 'Not yet verified',
      trend:
        draftToday > 0
          ? { direction: 'up', label: `+${draftToday} today`, tone: 'neutral' }
          : { direction: 'flat', label: 'No new today', tone: 'neutral' },
      sparkline: buildSparklineFromCounts(dailyCounts(rows, (r) => r.status === 'draft')),
      updatedAt: now,
      onClick: () => onFilter(activeStatus === 'draft' ? '' : 'draft'),
    },
    {
      id: 'pending',
      label: 'Pending Approval',
      value: summary.pendingApproval,
      icon: Clock,
      accent: 'amber',
      active: activeStatus === 'pending_approval',
      context:
        total > 0 ? `${percentOf(summary.pendingApproval, total)} awaiting review` : undefined,
      trend:
        pendingWeek > 0
          ? { direction: 'up', label: `${pendingWeek} this week`, tone: 'neutral' }
          : undefined,
      sparkline: buildSparklineFromCounts(
        dailyCounts(rows, (r) => r.status === 'pending_approval'),
      ),
      updatedAt: now,
      onClick: () =>
        onFilter(activeStatus === 'pending_approval' ? '' : 'pending_approval'),
    },
    {
      id: 'mismatch',
      label: 'Mismatch / Hold',
      value: summary.mismatchOrHold,
      icon: FileWarning,
      accent: 'red',
      active: activeStatus === 'mismatch_or_hold',
      context:
        total > 0
          ? `${percentOf(summary.mismatchOrHold, total)} · ${formatCompactCurrency(mismatchValue)}`
          : 'No matching issues',
      sparkline: buildSparklineFromCounts(dailyCounts(rows, isInvoiceMismatchOrHold)),
      updatedAt: now,
      onClick: () =>
        onFilter(activeStatus === 'mismatch_or_hold' ? '' : 'mismatch_or_hold'),
    },
    {
      id: 'total-value',
      label: 'Total Value',
      value: formatCompactCurrency(summary.totalValue),
      icon: CheckCircle2,
      accent: 'blue',
      active: false,
      context: total > 0 ? `${total} invoice${total === 1 ? '' : 's'} in register` : 'No invoices',
      updatedAt: now,
    },
  ]
}
