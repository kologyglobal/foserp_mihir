import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Settings2,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnterpriseQuickAction } from '../design-system/workspace/EnterpriseFormContextPanel'
import type {
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
} from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'
import { isApprovalOverdue } from './approvalKpiItems'

export interface ApprovalRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

export function buildApprovalRegisterOverview(
  rows: PurchaseApprovalQueueRow[],
): ApprovalRegisterOverviewRow[] {
  const pending = rows.filter((r) => r.status === 'pending')
  const approved = rows.filter((r) => r.status === 'approved').length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const overdue = pending.filter(isApprovalOverdue).length
  const prCount = rows.filter((r) => r.documentType === 'purchase_requisition').length
  const poCount = rows.filter((r) => r.documentType === 'purchase_order').length
  const pendingValue = pending.reduce((s, r) => s + r.amount, 0)
  const urgent = pending.filter((r) => r.priority === 'urgent' || r.priority === 'high').length

  return [
    { label: 'In view', value: rows.length },
    {
      label: 'Pending',
      value: pending.length,
      highlight: pending.length > 0,
    },
    {
      label: 'Overdue (8+ d)',
      value: overdue,
      highlight: overdue > 0,
    },
    { label: 'Approved', value: approved },
    { label: 'Rejected', value: rejected },
    { label: 'PR / PO', value: `${prCount} / ${poCount}` },
    {
      label: 'High / urgent',
      value: urgent,
      highlight: urgent > 0,
    },
    {
      label: 'Pending value',
      value: formatCompactCurrency(pendingValue),
      highlight: pendingValue > 0,
    },
  ]
}

export function buildApprovalRegisterSuggestions(input: {
  rows: PurchaseApprovalQueueRow[]
  activeTab: PurchaseApprovalQueueTab
  activeAgeing: string
  onSelectTab: (tab: PurchaseApprovalQueueTab) => void
  onShowOverdue: () => void
  onShowHistory: () => void
  onOpenSetup?: () => void
}): EnterpriseQuickAction[] {
  const { rows, activeTab, activeAgeing, onSelectTab, onShowOverdue, onShowHistory, onOpenSetup } =
    input
  const pending = rows.filter((r) => r.status === 'pending').length
  const overdue = rows.filter(isApprovalOverdue).length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const actions: EnterpriseQuickAction[] = []

  if (pending > 0 && activeTab !== 'pending_mine') {
    actions.push({
      id: 'pending-queue',
      label: `${pending} item${pending === 1 ? '' : 's'} pending my approval`,
      icon: Clock,
      primary: true,
      onClick: () => onSelectTab('pending_mine'),
    })
  }
  if (overdue > 0) {
    actions.push({
      id: 'overdue',
      label: `${overdue} overdue (8+ days)`,
      icon: AlertTriangle,
      primary: true,
      onClick: onShowOverdue,
    })
  } else if (activeAgeing === 'overdue') {
    actions.push({
      id: 'clear-overdue',
      label: 'Clear overdue filter',
      icon: CheckCircle2,
      onClick: () => onSelectTab('pending_mine'),
    })
  }
  if (rejected > 0 && activeTab !== 'rejected_by_me') {
    actions.push({
      id: 'rejected',
      label: `${rejected} rejected in this view`,
      icon: XCircle,
      onClick: () => onSelectTab('rejected_by_me'),
    })
  }
  if (activeTab !== 'all_history') {
    actions.push({
      id: 'history',
      label: 'Open all approval history',
      icon: History,
      onClick: onShowHistory,
    })
  }
  if (onOpenSetup) {
    actions.push({
      id: 'setup',
      label: 'Review approval matrix (Setup)',
      icon: Settings2,
      onClick: onOpenSetup,
    })
  }
  if (actions.length === 0) {
    actions.push({
      id: 'clear-queue',
      label: 'No bottlenecks in this view',
      icon: CheckCircle2,
      onClick: () => onSelectTab('pending_mine'),
    })
  }
  return actions
}
