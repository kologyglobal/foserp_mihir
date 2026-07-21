import { AlertTriangle, CircleDollarSign, Clock, Package, ShoppingCart, UserX } from 'lucide-react'
import { EnterpriseKpiStrip, type EnterpriseKpiItem } from '@/design-system/enterprise'
import type { PlanningSheetSummary } from '@/services/purchase'
import { formatCurrency } from '@/utils/formatters/currency'
import type { CrmFilterValues } from '@/types/crmListFilters'

export type PlanningSummaryFilterKey =
  | 'pending'
  | 'critical'
  | 'overdue'
  | 'vendorPending'
  | 'poPending'
  | 'poCreated'
  | 'value'

type Props = {
  summary: PlanningSheetSummary
  activeKey: PlanningSummaryFilterKey | null
  onSelect: (key: PlanningSummaryFilterKey | null, patch: CrmFilterValues) => void
}

export function filtersForSummaryCard(key: PlanningSummaryFilterKey): CrmFilterValues {
  switch (key) {
    case 'pending':
      return { status: 'draft', overdue: false, priority: '' }
    case 'critical':
      return { priority: 'critical', overdue: false }
    case 'overdue':
      return { overdue: true, status: '' }
    case 'vendorPending':
      return { vendorPending: true, overdue: false }
    case 'poPending':
      return { status: 'po_pending', overdue: false, vendorPending: false }
    case 'poCreated':
      return { status: 'po_created', overdue: false, vendorPending: false }
    case 'value':
      return { overdue: false, vendorPending: false }
    default:
      return {}
  }
}

export function PurchasePlanningSummaryCards({ summary, activeKey, onSelect }: Props) {
  const toggle = (key: PlanningSummaryFilterKey) => {
    if (activeKey === key) {
      onSelect(null, {
        status: '',
        priority: '',
        overdue: false,
        vendorPending: false,
      })
      return
    }
    onSelect(key, filtersForSummaryCard(key))
  }

  const items: EnterpriseKpiItem[] = [
    {
      id: 'pending',
      label: 'Pending Planning',
      value: summary.totalPendingPlanning,
      icon: Package,
      accent: 'slate',
      active: activeKey === 'pending',
      onClick: () => toggle('pending'),
    },
    {
      id: 'critical',
      label: 'Critical Items',
      value: summary.criticalItems,
      icon: AlertTriangle,
      accent: 'red',
      active: activeKey === 'critical',
      onClick: () => toggle('critical'),
    },
    {
      id: 'overdue',
      label: 'Overdue Items',
      value: summary.overdueItems,
      icon: Clock,
      accent: 'amber',
      active: activeKey === 'overdue',
      onClick: () => toggle('overdue'),
    },
    {
      id: 'vendorPending',
      label: 'Vendor Selection Pending',
      value: summary.vendorSelectionPending,
      icon: UserX,
      accent: 'amber',
      active: activeKey === 'vendorPending',
      onClick: () => toggle('vendorPending'),
    },
    {
      id: 'poPending',
      label: 'PO Pending',
      value: summary.poPending,
      icon: ShoppingCart,
      accent: 'blue',
      active: activeKey === 'poPending',
      onClick: () => toggle('poPending'),
    },
    {
      id: 'poCreated',
      label: 'PO Created',
      value: summary.poCreated,
      icon: ShoppingCart,
      accent: 'green',
      active: activeKey === 'poCreated',
      onClick: () => toggle('poCreated'),
    },
    {
      id: 'value',
      label: 'Estimated Purchase Value',
      value: formatCurrency(summary.totalEstimatedPurchaseValue),
      icon: CircleDollarSign,
      accent: 'blue',
      active: activeKey === 'value',
      onClick: () => toggle('value'),
    },
  ]

  return <EnterpriseKpiStrip items={items} columns={7} className="mb-3" />
}
