import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus,
  Rocket,
  Settings2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnterpriseQuickAction } from '../design-system/workspace/EnterpriseFormContextPanel'
import type { PurchaseRequisitionListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export interface PrRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isConverted(row: PurchaseRequisitionListRow) {
  return row.status === 'converted_to_rfq' || row.status === 'converted_to_po'
}

function isOpenPr(row: PurchaseRequisitionListRow) {
  return !['cancelled', 'rejected', 'converted_to_rfq', 'converted_to_po'].includes(row.status)
}

function isOverdueNeedBy(row: PurchaseRequisitionListRow, today = todayIsoDate()) {
  if (!row.requiredBy || !isOpenPr(row)) return false
  return row.requiredBy < today
}

function toggleStatus(activeStatus: string, next: string) {
  return activeStatus === next ? '' : next
}

export function buildPrRegisterOverview(rows: PurchaseRequisitionListRow[]): PrRegisterOverviewRow[] {
  const today = todayIsoDate()
  const draft = rows.filter((r) => r.status === 'draft').length
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const approved = rows.filter((r) => r.status === 'approved').length
  const converted = rows.filter(isConverted).length
  const overdue = rows.filter((r) => isOverdueNeedBy(r, today)).length
  const openValue = rows.filter(isOpenPr).reduce((s, r) => s + r.estimatedValue, 0)

  return [
    { label: 'In view', value: rows.length },
    { label: 'Draft', value: draft },
    {
      label: 'Pending approval',
      value: pendingApproval,
      highlight: pendingApproval > 0,
    },
    {
      label: 'Approved',
      value: approved,
      highlight: approved > 0,
    },
    { label: 'Converted', value: converted },
    {
      label: 'Past need-by',
      value: overdue,
      highlight: overdue > 0,
    },
    {
      label: 'Open est. value',
      value: formatCompactCurrency(openValue),
      highlight: openValue > 0,
    },
  ]
}

export function buildPrRegisterSuggestions(input: {
  rows: PurchaseRequisitionListRow[]
  activeStatus: string
  canCreate?: boolean
  onApplyStatus: (status: string) => void
  onReviewOverdue?: () => void
  onCreate?: () => void
  onOpenSetup?: () => void
}): EnterpriseQuickAction[] {
  const { rows, activeStatus, canCreate, onApplyStatus, onReviewOverdue, onCreate, onOpenSetup } =
    input
  const today = todayIsoDate()
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const approved = rows.filter((r) => r.status === 'approved').length
  const draft = rows.filter((r) => r.status === 'draft').length
  const overdue = rows.filter((r) => isOverdueNeedBy(r, today)).length
  const actions: EnterpriseQuickAction[] = []

  if (pendingApproval > 0) {
    actions.push({
      id: 'pending-approval',
      label: `${pendingApproval} PR${pendingApproval === 1 ? '' : 's'} pending approval`,
      icon: Clock,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'pending_approval')),
    })
  }
  if (approved > 0) {
    actions.push({
      id: 'approved',
      label: `${approved} approved — convert to RFQ/PO`,
      icon: Rocket,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'approved')),
    })
  }
  if (overdue > 0 && onReviewOverdue) {
    actions.push({
      id: 'overdue-need-by',
      label: `${overdue} past required-by date`,
      icon: AlertTriangle,
      onClick: onReviewOverdue,
    })
  }
  if (draft > 0) {
    actions.push({
      id: 'draft',
      label: `${draft} draft PR${draft === 1 ? '' : 's'} to submit`,
      icon: CheckCircle2,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'draft')),
    })
  }
  if (canCreate && onCreate) {
    actions.push({
      id: 'create',
      label: 'Create requisition',
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
