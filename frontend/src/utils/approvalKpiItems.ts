import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import {
  buildSparklineFromCounts,
  countSince,
  percentOf,
} from '../design-system/enterprise/enterpriseKpiUtils'
import type {
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
} from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export interface ApprovalKpiCounts {
  pending: number
  approved: number
  rejected: number
  overdue: number
}

export function isApprovalOverdue(row: PurchaseApprovalQueueRow) {
  return row.status === 'pending' && row.pendingSinceDays >= 8
}

function dailyCounts(
  rows: PurchaseApprovalQueueRow[],
  predicate: (r: PurchaseApprovalQueueRow) => boolean,
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
        const c = new Date(r.submittedDate)
        return c >= day && c < next
      }).length,
    )
  }
  return counts
}

export function summarizeApprovalKpis(input: {
  pending: PurchaseApprovalQueueRow[]
  approved: PurchaseApprovalQueueRow[]
  rejected: PurchaseApprovalQueueRow[]
}): ApprovalKpiCounts {
  return {
    pending: input.pending.length,
    approved: input.approved.length,
    rejected: input.rejected.length,
    overdue: input.pending.filter(isApprovalOverdue).length,
  }
}

export function buildApprovalRegisterKpiItems(
  pendingRows: PurchaseApprovalQueueRow[],
  summary: ApprovalKpiCounts,
  activeTab: PurchaseApprovalQueueTab,
  activeAgeing: string,
  onSelect: (next: { tab: PurchaseApprovalQueueTab; ageing?: string }) => void,
): EnterpriseKpiItem[] {
  const now = Date.now()
  const pendingValue = pendingRows.reduce((s, r) => s + r.amount, 0)
  const overdueValue = pendingRows
    .filter(isApprovalOverdue)
    .reduce((s, r) => s + r.amount, 0)
  const pendingWeek = pendingRows.filter((r) => countSince(r.submittedDate, 7)).length
  const totalMine = summary.pending + summary.approved + summary.rejected

  return [
    {
      id: 'pending',
      label: 'Pending My Approval',
      value: summary.pending,
      icon: Clock,
      accent: 'amber',
      active: activeTab === 'pending_mine' && activeAgeing !== 'overdue',
      context:
        summary.pending > 0
          ? `${formatCompactCurrency(pendingValue)} awaiting decision`
          : 'Queue is clear',
      trend:
        pendingWeek > 0
          ? { direction: 'up', label: `${pendingWeek} this week`, tone: 'neutral' }
          : { direction: 'flat', label: 'No new this week', tone: 'neutral' },
      sparkline: buildSparklineFromCounts(
        dailyCounts(pendingRows, (r) => r.status === 'pending'),
      ),
      updatedAt: now,
      onClick: () => onSelect({ tab: 'pending_mine', ageing: '' }),
    },
    {
      id: 'overdue',
      label: 'Overdue (8+ days)',
      value: summary.overdue,
      icon: AlertTriangle,
      accent: 'red',
      active: activeTab === 'pending_mine' && activeAgeing === 'overdue',
      context:
        summary.overdue > 0
          ? `${formatCompactCurrency(overdueValue)} stuck in queue`
          : 'No aged pending items',
      sparkline: buildSparklineFromCounts(dailyCounts(pendingRows, isApprovalOverdue)),
      updatedAt: now,
      onClick: () =>
        onSelect({
          tab: 'pending_mine',
          ageing: activeAgeing === 'overdue' ? '' : 'overdue',
        }),
    },
    {
      id: 'approved',
      label: 'Approved by Me',
      value: summary.approved,
      icon: CheckCircle2,
      accent: 'green',
      active: activeTab === 'approved_by_me',
      context:
        totalMine > 0
          ? `${percentOf(summary.approved, totalMine)} of my decisions`
          : 'No approvals yet',
      updatedAt: now,
      onClick: () => onSelect({ tab: 'approved_by_me', ageing: '' }),
    },
    {
      id: 'rejected',
      label: 'Rejected by Me',
      value: summary.rejected,
      icon: XCircle,
      accent: 'slate',
      active: activeTab === 'rejected_by_me',
      context:
        totalMine > 0
          ? `${percentOf(summary.rejected, totalMine)} of my decisions`
          : 'No rejections yet',
      updatedAt: now,
      onClick: () => onSelect({ tab: 'rejected_by_me', ageing: '' }),
    },
  ]
}
