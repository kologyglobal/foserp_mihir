import { CheckCircle2, Clock, FilePen, Rocket } from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import {
  buildSparklineFromCounts,
  countSince,
  percentOf,
} from '../design-system/enterprise/enterpriseKpiUtils'
import type { PurchaseRequisitionListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export interface PrKpiCounts {
  draft: number
  pendingApproval: number
  approved: number
  converted: number
}

function dailyCounts(
  rows: PurchaseRequisitionListRow[],
  predicate: (r: PurchaseRequisitionListRow) => boolean,
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
        const c = new Date(r.createdAt || r.documentDate)
        return c >= day && c < next
      }).length,
    )
  }
  return counts
}

function isConverted(r: PurchaseRequisitionListRow) {
  return r.status === 'converted_to_rfq' || r.status === 'converted_to_po'
}

export function buildPrRegisterKpiItems(
  rows: PurchaseRequisitionListRow[],
  summary: PrKpiCounts,
  activeStatus: string,
  onFilter: (status: string) => void,
): EnterpriseKpiItem[] {
  const total = rows.length
  const now = Date.now()
  const draftValue = rows
    .filter((r) => r.status === 'draft')
    .reduce((s, r) => s + r.estimatedValue, 0)
  const approvedValue = rows
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.estimatedValue, 0)

  const draftToday = rows.filter(
    (r) => r.status === 'draft' && countSince(r.createdAt || r.documentDate, 0),
  ).length
  const pendingWeek = rows.filter(
    (r) => r.status === 'pending_approval' && countSince(r.createdAt || r.documentDate, 7),
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
          ? `${percentOf(summary.draft, total)} of total · ${formatCompactCurrency(draftValue)} est.`
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
      context: total > 0 ? `${percentOf(summary.pendingApproval, total)} awaiting review` : undefined,
      trend:
        pendingWeek > 0
          ? { direction: 'up', label: `${pendingWeek} this week`, tone: 'neutral' }
          : undefined,
      sparkline: buildSparklineFromCounts(
        dailyCounts(rows, (r) => r.status === 'pending_approval'),
      ),
      updatedAt: now,
      onClick: () => onFilter(activeStatus === 'pending_approval' ? '' : 'pending_approval'),
    },
    {
      id: 'approved',
      label: 'Approved',
      value: summary.approved,
      icon: CheckCircle2,
      accent: 'green',
      active: activeStatus === 'approved',
      context:
        total > 0
          ? `${percentOf(summary.approved, total)} · ${formatCompactCurrency(approvedValue)} ready`
          : 'Ready to convert',
      sparkline: buildSparklineFromCounts(dailyCounts(rows, (r) => r.status === 'approved')),
      updatedAt: now,
      onClick: () => onFilter(activeStatus === 'approved' ? '' : 'approved'),
    },
    {
      id: 'converted',
      label: 'Converted',
      value: summary.converted,
      icon: Rocket,
      accent: 'blue',
      active: activeStatus === 'converted',
      context: `${summary.converted} linked to RFQ / PO`,
      sparkline: buildSparklineFromCounts(dailyCounts(rows, isConverted)),
      updatedAt: now,
      onClick: () => onFilter(activeStatus === 'converted' ? '' : 'converted'),
    },
  ]
}
