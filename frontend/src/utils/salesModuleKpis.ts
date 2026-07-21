import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Factory,
  FileText,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import { KPI_ICON_PRESETS, percentOf } from '../design-system/enterprise/enterpriseKpiUtils'
import { formatCompactCurrency } from './formatters/currency'
const now = () => Date.now()

export function buildQuotationRegisterKpis(
  counts: { total: number; pending: number; approved: number; converted: number; pipelineValue: number },
  statusFilter: string,
  onStatusFilter: (status: string) => void,
): EnterpriseKpiItem[] {
  const { total, pending, approved, converted, pipelineValue } = counts

  // Cap to 4 — total count folded into pipeline context
  return [
    {
      id: 'pending',
      label: 'Pending Approval',
      value: pending,
      icon: Clock,
      accent: pending > 0 ? 'amber' : 'green',
      context: pending > 0 ? 'Needs sign-off' : 'All clear',
      active: statusFilter === 'pending_approval',
      trend: pending > 0 ? { direction: 'up', label: `${pending} awaiting`, tone: 'neutral' } : undefined,
      onClick: () => onStatusFilter(statusFilter === 'pending_approval' ? '' : 'pending_approval'),
      updatedAt: now(),
    },
    {
      id: 'approved',
      label: 'Approved',
      value: approved,
      icon: CheckCircle2,
      accent: 'green',
      context: percentOf(approved, total) + ' approved',
      active: statusFilter === 'approved',
      onClick: () => onStatusFilter(statusFilter === 'approved' ? '' : 'approved'),
      updatedAt: now(),
    },
    {
      id: 'converted',
      label: 'Converted',
      value: converted,
      icon: KPI_ICON_PRESETS.converted,
      accent: 'slate',
      context: 'To sales order',
      active: statusFilter === 'converted',
      onClick: () => onStatusFilter(statusFilter === 'converted' ? '' : 'converted'),
      updatedAt: now(),
    },
    {
      id: 'pipeline',
      label: 'Pipeline Value',
      value: formatCompactCurrency(pipelineValue),
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'amber',
      context: `${total} quotations`,
      updatedAt: now(),
    },
  ]
}

export function buildSalesOrderRegisterKpis(input: {
  total: number
  draftCount: number
  confirmedCount: number
  pendingSoCount?: number
  fromQuotation: number
  directOrders: number
  totalValue: number
  filters: { status: string; source: string }
  onFilter: (patch: { status?: string; source?: string }) => void
}): EnterpriseKpiItem[] {
  const {
    total,
    draftCount,
    confirmedCount,
    pendingSoCount = 0,
    fromQuotation,
    directOrders,
    totalValue,
    filters,
    onFilter,
  } = input

  // Cap to 4 — Pending SO (won quotes) promoted for handover visibility
  return [
    {
      id: 'total',
      label: 'Open Orders',
      value: total,
      icon: ShoppingCart,
      accent: 'blue',
      trend: pendingSoCount > 0
        ? { direction: 'up', label: `${pendingSoCount} pending SO`, tone: 'neutral' }
        : draftCount > 0
          ? { direction: 'up', label: `${draftCount} draft`, tone: 'neutral' }
          : undefined,
      context: `${confirmedCount} confirmed · ${draftCount} draft`,
      updatedAt: now(),
    },
    {
      id: 'pending_so',
      label: 'Pending SO',
      value: pendingSoCount,
      icon: FileText,
      accent: 'amber',
      trend: pendingSoCount > 0
        ? { direction: 'up', label: 'Won quotes awaiting SO', tone: 'neutral' }
        : undefined,
      context: 'Approved quotation → create SO',
      active: filters.status === 'pending_so',
      onClick: () => onFilter({ status: filters.status === 'pending_so' ? '' : 'pending_so' }),
      updatedAt: now(),
    },
    {
      id: 'confirmed',
      label: 'Confirmed SO',
      value: confirmedCount,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      trend: confirmedCount > 0 ? { direction: 'up', label: 'In fulfillment', tone: 'positive' } : undefined,
      context: percentOf(confirmedCount, Math.max(total - pendingSoCount, 0)) + ' of book',
      active: filters.status === 'confirmed',
      onClick: () => onFilter({ status: filters.status === 'confirmed' ? '' : 'confirmed' }),
      updatedAt: now(),
    },
    {
      id: 'value',
      label: 'Sales Value',
      value: formatCompactCurrency(totalValue),
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'amber',
      context: `${fromQuotation} from quote · ${directOrders} direct`,
      active: filters.source === 'direct',
      onClick: () => onFilter({ source: filters.source === 'direct' ? '' : 'direct' }),
      updatedAt: now(),
    },
  ]
}

export function buildOrderStatusKpis(
  metrics: { orderBook: number; atRisk: number; pendingMrp: number; inProduction: number; dispatchReady: number },
  openOrderCount: number,
  filters: { stage: string | null; status: string; risk: string },
  onFilter: (patch: { stage?: string | null; status?: string; risk?: string }) => void,
): EnterpriseKpiItem[] {
  return [
    {
      id: 'open',
      label: 'Open Orders',
      value: openOrderCount,
      icon: ShoppingCart,
      accent: 'blue',
      context: formatCompactCurrency(metrics.orderBook) + ' order book',
      href: '/sales/orders',
      updatedAt: now(),
    },
    {
      id: 'at-risk',
      label: 'At Risk',
      value: metrics.atRisk,
      icon: AlertTriangle,
      accent: metrics.atRisk ? 'red' : 'green',
      context: metrics.atRisk ? 'Delivery risk flagged' : 'On track',
      active: filters.risk === 'at_risk',
      trend: metrics.atRisk > 0 ? { direction: 'down', label: 'Needs action', tone: 'negative' } : undefined,
      onClick: () => onFilter({ risk: filters.risk === 'at_risk' ? '' : 'at_risk' }),
      updatedAt: now(),
    },
    {
      id: 'mrp',
      label: 'Pending MRP',
      value: metrics.pendingMrp,
      icon: Factory,
      accent: metrics.pendingMrp ? 'amber' : 'green',
      context: 'Awaiting planning run',
      href: '/mrp/run',
      updatedAt: now(),
    },
    {
      id: 'production',
      label: 'In Production',
      value: metrics.inProduction,
      icon: KPI_ICON_PRESETS.pipeline,
      accent: 'blue',
      context: 'On shop floor',
      href: '/work-orders',
      updatedAt: now(),
    },
    {
      id: 'dispatch',
      label: 'Dispatch Ready',
      value: metrics.dispatchReady,
      icon: Truck,
      accent: 'slate',
      context: 'Ready to ship',
      href: '/dispatch/register',
      updatedAt: now(),
    },
  ]
}

export function buildProformaRegisterKpis(
  counts: { total: number; draft: number; issued: number; expired: number; totalValue: number },
  statusFilter: string,
  onStatusFilter: (status: string) => void,
): EnterpriseKpiItem[] {
  const { total, draft, issued, expired, totalValue } = counts

  return [
    {
      id: 'total',
      label: 'Total Proforma',
      value: total,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: 'Advance billing docs',
      updatedAt: now(),
    },
    {
      id: 'draft',
      label: 'Draft',
      value: draft,
      icon: FileText,
      accent: 'amber',
      context: 'Not yet issued',
      active: statusFilter === 'draft',
      onClick: () => onStatusFilter(statusFilter === 'draft' ? '' : 'draft'),
      updatedAt: now(),
    },
    {
      id: 'issued',
      label: 'Issued',
      value: issued,
      icon: CheckCircle2,
      accent: 'green',
      context: percentOf(issued, total) + ' issued',
      active: statusFilter === 'issued',
      onClick: () => onStatusFilter(statusFilter === 'issued' ? '' : 'issued'),
      updatedAt: now(),
    },
    {
      id: 'expired',
      label: 'Expired',
      value: expired,
      icon: AlertTriangle,
      accent: expired > 0 ? 'red' : 'slate',
      context: expired > 0 ? 'Renew or cancel' : 'None expired',
      updatedAt: now(),
    },
    {
      id: 'value',
      label: 'Open Value',
      value: formatCompactCurrency(totalValue),
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'slate',
      context: 'Excl. cancelled',
      updatedAt: now(),
    },
  ]
}

export function buildCustomerHubKpis(
  customers: { isCustomer?: boolean }[],
  activeCustomers: number,
  withOpenSo: number,
  totalPipeline: number,
): EnterpriseKpiItem[] {
  const total = customers.length
  const buyerCount = customers.filter((c) => c.isCustomer).length

  return [
    {
      id: 'accounts',
      label: 'Accounts',
      value: total,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: `${buyerCount} customers`,
      updatedAt: now(),
    },
    {
      id: 'active',
      label: 'Active Accounts',
      value: activeCustomers,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      context: percentOf(activeCustomers, total) + ' active',
      updatedAt: now(),
    },
    {
      id: 'open-so',
      label: 'With Open SO',
      value: withOpenSo,
      icon: ShoppingCart,
      accent: 'blue',
      context: 'Active order book',
      updatedAt: now(),
    },
    {
      id: 'pipeline',
      label: 'Pipeline Value',
      value: formatCompactCurrency(totalPipeline),
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'amber',
      context: 'CRM + open orders',
      updatedAt: now(),
    },
  ]
}
