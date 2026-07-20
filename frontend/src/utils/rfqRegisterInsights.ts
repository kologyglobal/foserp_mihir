import {
  AlertTriangle,
  Clock,
  FilePlus,
  Send,
  Settings2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { EnterpriseQuickAction } from '../design-system/workspace/EnterpriseFormContextPanel'
import type { RfqListRow } from '../types/purchaseDomain'
import { formatCompactCurrency } from './formatters/currency'

export interface RfqRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isOpenRfq(row: RfqListRow) {
  return !['cancelled', 'closed'].includes(row.status)
}

function isOverdueBid(row: RfqListRow, today = todayIsoDate()) {
  if (!isOpenRfq(row) || !row.bidDueDate) return false
  return row.bidDueDate < today && row.status !== 'draft'
}

function toggleStatus(activeStatus: string, next: string) {
  return activeStatus === next ? '' : next
}

export function buildRfqRegisterOverview(rows: RfqListRow[]): RfqRegisterOverviewRow[] {
  const today = todayIsoDate()
  const draft = rows.filter((r) => r.status === 'draft').length
  const sent = rows.filter((r) => r.status === 'sent' || r.status === 'partially_quoted').length
  const quoted = rows.filter(
    (r) => r.status === 'quotation_received' || r.status === 'under_evaluation',
  ).length
  const overdue = rows.filter((r) => isOverdueBid(r, today)).length
  const openValue = rows.filter(isOpenRfq).reduce((s, r) => s + r.estimatedValue, 0)
  const awaitingResponse = rows.filter(
    (r) =>
      (r.status === 'sent' || r.status === 'partially_quoted') &&
      r.responsesReceived < r.vendorCount,
  ).length

  return [
    { label: 'In view', value: rows.length },
    { label: 'Draft', value: draft },
    {
      label: 'Sent / open',
      value: sent,
      highlight: sent > 0,
    },
    { label: 'Quoted+', value: quoted },
    {
      label: 'Past bid due',
      value: overdue,
      highlight: overdue > 0,
    },
    {
      label: 'Awaiting quotes',
      value: awaitingResponse,
      highlight: awaitingResponse > 0,
    },
    {
      label: 'Open est. value',
      value: formatCompactCurrency(openValue),
      highlight: openValue > 0,
    },
  ]
}

export function buildRfqRegisterSuggestions(input: {
  rows: RfqListRow[]
  activeStatus: string
  canCreate?: boolean
  onApplyStatus: (status: string) => void
  onCreate?: () => void
  onOpenSetup?: () => void
}): EnterpriseQuickAction[] {
  const { rows, activeStatus, canCreate, onApplyStatus, onCreate, onOpenSetup } = input
  const today = todayIsoDate()
  const draft = rows.filter((r) => r.status === 'draft').length
  const overdue = rows.filter((r) => isOverdueBid(r, today)).length
  const awaiting = rows.filter(
    (r) =>
      (r.status === 'sent' || r.status === 'partially_quoted') &&
      r.responsesReceived < r.vendorCount,
  ).length
  const actions: EnterpriseQuickAction[] = []

  if (draft > 0) {
    actions.push({
      id: 'draft',
      label: `${draft} draft RFQ${draft === 1 ? '' : 's'} to send`,
      icon: Send,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'draft')),
    })
  }
  if (overdue > 0) {
    actions.push({
      id: 'overdue',
      label: `${overdue} past bid due`,
      icon: AlertTriangle,
      primary: true,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'overdue')),
    })
  }
  if (awaiting > 0) {
    actions.push({
      id: 'awaiting',
      label: `${awaiting} awaiting vendor responses`,
      icon: Clock,
      onClick: () => onApplyStatus(toggleStatus(activeStatus, 'sent')),
    })
  }
  if (canCreate && onCreate) {
    actions.push({
      id: 'create',
      label: 'Create RFQ',
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
