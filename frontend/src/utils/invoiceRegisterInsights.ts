import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus,
  FileWarning,
  Settings2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnterpriseQuickAction } from '../design-system/workspace/EnterpriseFormContextPanel'
import type { PurchaseInvoiceListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'
import {
  isInvoiceMismatchOrHold,
  isInvoiceNeedsAttention,
  isInvoiceReadyToPost,
} from './invoiceKpiItems'

export interface InvoiceRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

function toggleStatus(activeStatus: string, next: string) {
  return activeStatus === next ? '' : next
}

export function buildInvoiceRegisterOverview(
  rows: PurchaseInvoiceListRow[],
): InvoiceRegisterOverviewRow[] {
  const draft = rows.filter((r) => r.status === 'draft').length
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const mismatchOrHold = rows.filter(isInvoiceMismatchOrHold).length
  const needsAttention = rows.filter(isInvoiceNeedsAttention).length
  const readyToPost = rows.filter(isInvoiceReadyToPost).length
  const postedOrPaid = rows.filter((r) => r.status === 'posted' || r.status === 'paid').length
  const openValue = rows
    .filter((r) => r.status !== 'cancelled' && r.status !== 'paid')
    .reduce((s, r) => s + r.totalAmount, 0)

  return [
    { label: 'In view', value: rows.length },
    { label: 'Draft', value: draft },
    {
      label: 'Pending approval',
      value: pendingApproval,
      highlight: pendingApproval > 0,
    },
    {
      label: 'Mismatch / hold',
      value: mismatchOrHold,
      highlight: mismatchOrHold > 0,
    },
    {
      label: 'Needs attention',
      value: needsAttention,
      highlight: needsAttention > 0,
    },
    { label: 'Ready to post', value: readyToPost },
    { label: 'Posted / paid', value: postedOrPaid },
    {
      label: 'Open value',
      value: formatCompactCurrency(openValue),
      highlight: openValue > 0,
    },
  ]
}

export function buildInvoiceRegisterSuggestions(input: {
  rows: PurchaseInvoiceListRow[]
  activeStatus: string
  canCreate?: boolean
  onApplyStatus: (status: string) => void
  onCreate?: () => void
  onOpenSetup?: () => void
}): EnterpriseQuickAction[] {
  const { rows, activeStatus, canCreate, onApplyStatus, onCreate, onOpenSetup } = input
  const pendingApproval = rows.filter((r) => r.status === 'pending_approval').length
  const mismatchOrHold = rows.filter(isInvoiceMismatchOrHold).length
  const needsAttention = rows.filter(isInvoiceNeedsAttention).length
  const draft = rows.filter((r) => r.status === 'draft').length
  const readyToPost = rows.filter(isInvoiceReadyToPost).length
  const actions: EnterpriseQuickAction[] = []

  if (mismatchOrHold > 0) {
    actions.push({
      id: 'mismatch',
      label: `${mismatchOrHold} mismatch / on-hold invoice${mismatchOrHold === 1 ? '' : 's'}`,
      icon: AlertTriangle,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'mismatch_or_hold')),
    })
  }
  if (pendingApproval > 0) {
    actions.push({
      id: 'pending-approval',
      label: `${pendingApproval} pending approval`,
      icon: Clock,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'pending_approval')),
    })
  }
  if (needsAttention > 0 && mismatchOrHold === 0) {
    actions.push({
      id: 'needs-attention',
      label: `${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`,
      icon: FileWarning,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'needs_attention')),
    })
  }
  if (readyToPost > 0) {
    actions.push({
      id: 'ready-to-post',
      label: `${readyToPost} ready to post`,
      icon: CheckCircle2,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'ready_to_post')),
    })
  }
  if (draft > 0) {
    actions.push({
      id: 'draft',
      label: `${draft} draft invoice${draft === 1 ? '' : 's'} to verify`,
      icon: FileWarning,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'draft')),
    })
  }
  if (canCreate && onCreate) {
    actions.push({
      id: 'create',
      label: 'Create purchase invoice',
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
