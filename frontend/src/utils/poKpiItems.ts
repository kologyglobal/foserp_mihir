import { CheckCircle2, Clock, FilePen, PackageCheck } from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import {
  buildSparklineFromCounts,
  countSince,
  percentOf,
} from '../design-system/enterprise/enterpriseKpiUtils'
import type { PurchaseOrderListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export const PO_RELEASED_OR_LATER_STATUSES = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
] as const

export interface PoKpiCounts {
  draft: number
  pendingApproval: number
  releasedOrLater: number
  totalValue: number
}

function dailyCounts(
  rows: PurchaseOrderListRow[],
  predicate: (r: PurchaseOrderListRow) => boolean,
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

function isReleasedOrLater(r: PurchaseOrderListRow) {
  return (PO_RELEASED_OR_LATER_STATUSES as readonly string[]).includes(r.status)
}

export function buildPoRegisterKpiItems(
  rows: PurchaseOrderListRow[],
  summary: PoKpiCounts,
  activeStatus: string,
  onFilter: (status: string) => void,
): EnterpriseKpiItem[] {
  const total = rows.length
  const now = Date.now()
  const draftValue = rows
    .filter((r) => r.status === 'draft')
    .reduce((s, r) => s + r.totalAmount, 0)
  const releasedValue = rows
    .filter(isReleasedOrLater)
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
          : 'Not yet submitted',
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
      id: 'released',
      label: 'Released or Later',
      value: summary.releasedOrLater,
      icon: PackageCheck,
      accent: 'green',
      active: activeStatus === 'released_or_later',
      context:
        total > 0
          ? `${percentOf(summary.releasedOrLater, total)} · ${formatCompactCurrency(releasedValue)}`
          : 'In fulfilment',
      sparkline: buildSparklineFromCounts(dailyCounts(rows, isReleasedOrLater)),
      updatedAt: now,
      onClick: () =>
        onFilter(activeStatus === 'released_or_later' ? '' : 'released_or_later'),
    },
    {
      id: 'total-value',
      label: 'Total Value',
      value: formatCompactCurrency(summary.totalValue),
      icon: CheckCircle2,
      accent: 'blue',
      active: false,
      context: total > 0 ? `${total} order${total === 1 ? '' : 's'} in register` : 'No orders',
      updatedAt: now,
    },
  ]
}
