import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  IndianRupee,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import {
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsFilterRow,
} from '../../components/dynamics'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import {
  PurchaseByCategoryChart,
  PurchaseMonthlyTrendChart,
  PurchaseTopVendorsChart,
} from '../../components/purchase/PurchaseDashboardCharts'
import { TableLink } from '../../components/ui/AppLink'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '../../design-system/enterprise/enterpriseKpiTypes'
import { getPurchaseDashboard, PurchaseServiceError } from '../../services/purchase'
import type { PurchaseDashboardData, PurchaseDashboardFilters } from '../../types/purchaseDomain'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import { notify } from '../../store/toastStore'

function financialYearStart(iso = new Date().toISOString().slice(0, 10)): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const fyStartYear = month >= 4 ? year : year - 1
  return `${fyStartYear}-04-01`
}

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const DASHBOARD_BREADCRUMBS = [
  { label: 'Home', to: '/home' },
  { label: 'Purchase' },
]

function StatusCountList({
  title,
  buckets,
}: {
  title: string
  buckets: PurchaseDashboardData['prStatus']
}) {
  const navigate = useNavigate()
  return (
    <DynamicsDashboardPanel title={title}>
      <ul className="divide-y divide-erp-border">
        {buckets.map((bucket) => (
          <li key={bucket.key}>
            <button
              type="button"
              onClick={() => navigate(bucket.href)}
              className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-[13px] hover:bg-erp-primary-soft/60"
            >
              <span className="text-erp-text">{bucket.label}</span>
              <span
                className={cn(
                  'min-w-[2rem] rounded-md px-2 py-0.5 text-center text-[12px] font-semibold tabular-nums',
                  bucket.count > 0 ? 'bg-erp-primary-soft text-erp-primary' : 'bg-erp-surface-alt text-erp-muted',
                )}
              >
                {bucket.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DynamicsDashboardPanel>
  )
}

function DashboardShell({
  commandBar,
  kpiStrip,
  children,
}: {
  commandBar: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  children: ReactNode
}) {
  return (
    <OperationalPageShell
      title="Purchase Dashboard"
      description="Monitor requisitions, orders, receipts, invoices and vendor performance"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={DASHBOARD_BREADCRUMBS}
      favoritePath="/purchase"
      pageGuide={null}
      commandBar={commandBar}
      kpiStrip={kpiStrip}
    >
      {children}
    </OperationalPageShell>
  )
}

export function PurchaseModuleDashboard() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<PurchaseDashboardFilters>({
    dateFrom: financialYearStart(),
    dateTo: new Date().toISOString().slice(0, 10),
    locationId: '',
  })
  const [data, setData] = useState<PurchaseDashboardData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const queryFilters = useMemo((): PurchaseDashboardFilters => {
    const next: PurchaseDashboardFilters = {}
    if (filters.dateFrom) next.dateFrom = filters.dateFrom
    if (filters.dateTo) next.dateTo = filters.dateTo
    if (filters.locationId) next.locationId = filters.locationId
    return next
  }, [filters])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getPurchaseDashboard(queryFilters)
      if (signal?.cancelled) return
      const empty =
        result.kpis.openRequisitions === 0 &&
        result.kpis.purchaseOrdersThisMonth === 0 &&
        result.kpis.openRfqs === 0 &&
        result.upcomingDeliveries.length === 0 &&
        result.recentActivity.length === 0
      setData(result)
      setLoadState(empty ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      const message =
        err instanceof PurchaseServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load purchase dashboard'
      setErrorMessage(message)
      setData(null)
      setLoadState('error')
    }
  }, [queryFilters])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const refresh = useCallback(() => {
    if (loadState === 'loading') return
    setRefreshToken((n) => n + 1)
    notify.info('Purchase dashboard refreshed')
  }, [loadState])

  const commandBar = (
    <ErpCommandBar
      inline
      sticky={false}
      primaryAction={{
        id: 'create-pr',
        label: 'Create Purchase Requisition',
        icon: Plus,
        onClick: () => navigate('/purchase/requisitions/new'),
      }}
      secondaryActions={[
        {
          id: 'refresh',
          label: 'Refresh',
          icon: RefreshCw,
          onClick: refresh,
        },
      ]}
    />
  )

  const filterBar = (
    <DynamicsFilterRow
      onClear={() =>
        setFilters({
          dateFrom: financialYearStart(),
          dateTo: new Date().toISOString().slice(0, 10),
          locationId: '',
        })
      }
    >
      <label className="flex items-center gap-1.5 text-[12px] text-erp-muted">
        From
        <input
          type="date"
          className="erp-input h-8 min-w-[9.5rem] text-[12px]"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-erp-muted">
        To
        <input
          type="date"
          className="erp-input h-8 min-w-[9.5rem] text-[12px]"
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-erp-muted">
        <MapPin className="h-3.5 w-3.5" />
        Location
        <select
          className="erp-input h-8 min-w-[11rem] text-[12px]"
          value={filters.locationId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value || undefined }))}
        >
          <option value="">All locations</option>
          {(data?.locations ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
    </DynamicsFilterRow>
  )

  if (loadState === 'loading' && !data) {
    return (
      <DashboardShell commandBar={commandBar}>
        {filterBar}
        <LoadingState variant="dashboard" rows={6} />
      </DashboardShell>
    )
  }

  if (loadState === 'error') {
    return (
      <DashboardShell commandBar={commandBar}>
        {filterBar}
        <EmptyState
          icon={AlertTriangle}
          title="Could not load dashboard"
          description={errorMessage ?? 'Unknown error'}
          action={
            <button
              type="button"
              className="erp-btn erp-btn--primary text-[13px]"
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              Retry
            </button>
          }
        />
      </DashboardShell>
    )
  }

  if (!data || loadState === 'empty') {
    return (
      <DashboardShell
        commandBar={commandBar}
        kpiStrip={[
          {
            id: 'empty-pr',
            label: 'Open Purchase Requisitions',
            value: 0,
            icon: ClipboardList,
            accent: 'blue',
            href: '/purchase/requisitions',
          },
        ]}
      >
        {filterBar}
        <EmptyState
          icon={ShoppingCart}
          title="No purchase activity for this filter"
          description="Widen the date range or clear the location filter. You can also create a purchase requisition to start the flow."
          action={
            <button
              type="button"
              className="erp-btn erp-btn--primary text-[13px]"
              onClick={() => navigate('/purchase/requisitions/new')}
            >
              Create Purchase Requisition
            </button>
          }
        />
      </DashboardShell>
    )
  }

  const { kpis, kpiHrefs } = data

  const kpiStrip: EnterpriseKpiItem[] = [
    {
      id: 'open-pr',
      label: 'Open Purchase Requisitions',
      value: kpis.openRequisitions,
      icon: ClipboardList,
      accent: 'blue',
      href: kpiHrefs.openRequisitions,
    },
    {
      id: 'pr-approval',
      label: 'Pending PR Approvals',
      value: kpis.pendingPrApprovals,
      icon: FileText,
      accent: kpis.pendingPrApprovals ? 'amber' : 'green',
      href: kpiHrefs.pendingPrApprovals,
    },
    {
      id: 'rfq',
      label: 'Open RFQs',
      value: kpis.openRfqs,
      icon: ShoppingCart,
      accent: 'blue',
      href: kpiHrefs.openRfqs,
    },
    {
      id: 'month-value',
      label: 'Monthly Purchase Value',
      value: formatCurrency(kpis.monthlyPurchaseValue),
      icon: IndianRupee,
      accent: 'slate',
      href: kpiHrefs.monthlyPurchaseValue,
    },
    {
      id: 'po-month',
      label: 'POs This Month',
      value: kpis.purchaseOrdersThisMonth,
      icon: Truck,
      accent: 'blue',
      href: kpiHrefs.purchaseOrdersThisMonth,
    },
    {
      id: 'pending-del',
      label: 'Pending Deliveries',
      value: kpis.pendingDeliveries,
      icon: Truck,
      accent: kpis.pendingDeliveries ? 'amber' : 'green',
      href: kpiHrefs.pendingDeliveries,
    },
    {
      id: 'pending-grn',
      label: 'Pending GRNs',
      value: kpis.pendingGrns,
      icon: PackageCheck,
      accent: kpis.pendingGrns ? 'amber' : 'slate',
      href: kpiHrefs.pendingGrns,
    },
    {
      id: 'pending-inv',
      label: 'Pending Invoices',
      value: kpis.pendingPurchaseInvoices,
      icon: FileText,
      accent: kpis.pendingPurchaseInvoices ? 'amber' : 'slate',
      href: kpiHrefs.pendingPurchaseInvoices,
    },
  ]

  return (
    <DashboardShell commandBar={commandBar} kpiStrip={kpiStrip}>
      {filterBar}

      <DynamicsDashboardPanel title="Pending Actions">
        {data.pendingActions.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-erp-success-fg">
            <CheckCircle2 className="h-4 w-4" />
            No pending approvals, inspections, mismatches or overdue deliveries.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.pendingActions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => navigate(action.href)}
                  className="flex w-full items-center justify-between rounded-md border border-erp-border px-3 py-2 text-left text-[13px] hover:border-erp-primary/40 hover:bg-erp-primary-soft"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4',
                        action.severity === 'critical'
                          ? 'text-erp-danger-fg'
                          : action.severity === 'warning'
                            ? 'text-erp-warning-fg'
                            : 'text-erp-primary',
                      )}
                    />
                    <span>
                      {action.label}
                      <span className="ml-2 font-semibold tabular-nums text-erp-text">{action.count}</span>
                    </span>
                  </span>
                  <span className="text-erp-primary">Open →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DynamicsDashboardPanel>

      <DynamicsDashboardGrid>
        <StatusCountList title="Purchase Requisition Status" buckets={data.prStatus} />
        <StatusCountList title="Purchase Order Status" buckets={data.poStatus} />
      </DynamicsDashboardGrid>

      <DynamicsDashboardPanel title="Upcoming Deliveries" noPadding>
        {data.upcomingDeliveries.length === 0 ? (
          <p className="dyn-empty-hint px-4 py-6">No open deliveries for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Expected Date</th>
                  <th className="num">Item Count</th>
                  <th className="num">PO Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingDeliveries.map((row) => (
                  <tr key={row.id} className={row.isOverdue ? 'bg-red-50/50' : undefined}>
                    <td>
                      <TableLink to={row.href}>{row.poNumber}</TableLink>
                    </td>
                    <td>{row.vendorName}</td>
                    <td>
                      {formatDate(row.expectedDate)}
                      {row.isOverdue ? (
                        <span className="ml-2 text-[11px] font-semibold text-red-600">OVERDUE</span>
                      ) : null}
                    </td>
                    <td className="num">{row.itemCount}</td>
                    <td className="num">{formatCurrency(row.poValue)}</td>
                    <td>{row.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DynamicsDashboardPanel>

      <DynamicsDashboardGrid>
        <PurchaseMonthlyTrendChart data={data.monthlyTrend} />
        <PurchaseByCategoryChart data={data.byCategory} />
      </DynamicsDashboardGrid>

      <DynamicsDashboardGrid>
        <PurchaseTopVendorsChart data={data.topVendors} />
        <DynamicsDashboardPanel title="Recent Purchase Activity" noPadding>
          {data.recentActivity.length === 0 ? (
            <p className="dyn-empty-hint px-4 py-6">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-erp-border">
              {data.recentActivity.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => navigate(row.href)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-erp-primary-soft/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-erp-text">{row.summary}</span>
                      <span className="text-[11px] capitalize text-erp-muted">
                        {row.kind.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-erp-muted">
                      {formatDate(row.at.slice(0, 10))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>

      <p className="text-[11px] text-erp-muted">
        Demo data via purchase service · {data.currency} · as of {new Date(data.asOf).toLocaleString('en-IN')}
      </p>
    </DashboardShell>
  )
}
