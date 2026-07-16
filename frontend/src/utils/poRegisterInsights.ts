import {
  AlertTriangle,
  Clock,
  FilePlus,
  Package,
  Settings2,
  Truck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnterpriseQuickAction } from '../design-system/workspace/EnterpriseFormContextPanel'
import type { PurchaseOrderListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'
import { PO_RELEASED_OR_LATER_STATUSES } from './poKpiItems'

export interface PoRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isPoOverdue(row: PurchaseOrderListRow, today = todayIsoDate()) {
  if (['closed', 'cancelled', 'fully_received', 'invoiced'].includes(row.status)) return false
  if (!['released', 'partially_received', 'approved'].includes(row.status)) return false
  return row.expectedDeliveryDate < today
}

function isPendingDelivery(row: PurchaseOrderListRow) {
  return row.status === 'released' || row.status === 'partially_received'
}

function isOpenPo(row: PurchaseOrderListRow) {
  return !['closed', 'cancelled', 'fully_received', 'invoiced'].includes(row.status)
}

function isReleasedOrLater(row: PurchaseOrderListRow) {
  return (PO_RELEASED_OR_LATER_STATUSES as readonly string[]).includes(row.status)
}

function toggleStatus(activeStatus: string, next: string) {
  return activeStatus === next ? '' : next
}

export function buildPoRegisterOverview(rows: PurchaseOrderListRow[]): PoRegisterOverviewRow[] {
  const today = todayIsoDate()
  const draft = rows.filter((r) => r.status === 'draft').length
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const released = rows.filter(isReleasedOrLater).length
  const overdue = rows.filter((r) => isPoOverdue(r, today)).length
  const pendingDelivery = rows.filter(isPendingDelivery).length
  const openValue = rows.filter(isOpenPo).reduce((s, r) => s + r.totalAmount, 0)

  return [
    { label: 'In view', value: rows.length },
    { label: 'Draft', value: draft },
    {
      label: 'Pending approval',
      value: pendingApproval,
      highlight: pendingApproval > 0,
    },
    { label: 'Released+', value: released },
    {
      label: 'Overdue delivery',
      value: overdue,
      highlight: overdue > 0,
    },
    { label: 'Pending delivery', value: pendingDelivery },
    {
      label: 'Open value',
      value: formatCompactCurrency(openValue),
      highlight: openValue > 0,
    },
  ]
}

export function buildPoRegisterSuggestions(input: {
  rows: PurchaseOrderListRow[]
  activeStatus: string
  canCreate?: boolean
  onApplyStatus: (status: string) => void
  onCreate?: () => void
  onOpenSetup?: () => void
}): EnterpriseQuickAction[] {
  const { rows, activeStatus, canCreate, onApplyStatus, onCreate, onOpenSetup } = input
  const today = todayIsoDate()
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const overdue = rows.filter((r) => isPoOverdue(r, today)).length
  const pendingDelivery = rows.filter(isPendingDelivery).length
  const draft = rows.filter((r) => r.status === 'draft').length
  const actions: EnterpriseQuickAction[] = []

  if (pendingApproval > 0) {
    actions.push({
      id: 'pending-approval',
      label: `${pendingApproval} PO${pendingApproval === 1 ? '' : 's'} pending approval`,
      icon: Clock,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'pending_approval')),
    })
  }
  if (overdue > 0) {
    actions.push({
      id: 'overdue',
      label: `${overdue} overdue deliver${overdue === 1 ? 'y' : 'ies'}`,
      icon: AlertTriangle,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'overdue')),
    })
  }
  if (pendingDelivery > 0) {
    actions.push({
      id: 'pending-delivery',
      label: `${pendingDelivery} awaiting delivery / GRN`,
      icon: Truck,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'pending_delivery')),
    })
  }
  if (draft > 0) {
    actions.push({
      id: 'draft',
      label: `${draft} draft PO${draft === 1 ? '' : 's'} to submit`,
      icon: Package,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'draft')),
    })
  }
  if (canCreate && onCreate) {
    actions.push({
      id: 'create',
      label: 'Create purchase order',
      icon: FilePlus,
      primary: actions.length === 0,
      onClick: onCreate,
    })
  }
  if (onOpenSetup) {
    actions.push({
      id: 'setup',
      label: 'Open purchase setup',
      icon: Settings2,
      onClick: onOpenSetup,
    })
  }

  return actions.slice(0, 5)
}
