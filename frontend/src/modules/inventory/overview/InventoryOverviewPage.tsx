import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  Package,
  ShieldOff,
  SlidersHorizontal,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsDashboardGrid, DynamicsDashboardPanel } from '@/components/dynamics'
import { getInventoryDashboard } from '@/services/inventory'
import type { InventoryDashboardData } from '@/types/inventoryDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

type LoadState = 'loading' | 'ready' | 'error'

export function InventoryOverviewPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<InventoryDashboardData | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!perms.canView) return
    let cancelled = false
    setLoadState('loading')
    setData(null)
    getInventoryDashboard()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [perms.canView, reloadToken])

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Store"
        title="Store Home"
        breadcrumbs={[{ label: 'Store', to: '/inventory' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={ShieldOff}
          title="Access denied"
          description="Ask your admin for Inventory view access (inventory.view)."
        />
      </OperationalPageShell>
    )
  }

  const accentMap = {
    primary: 'blue',
    success: 'green',
    warning: 'amber',
    danger: 'red',
    neutral: 'slate',
  } as const

  const kpiItems = data?.kpis.map((k) => ({
    id: k.id,
    label: k.label,
    value: k.value,
    accent: accentMap[k.tone] ?? 'slate',
    onClick: () => navigate(k.href),
  })) ?? []

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Store Home"
      description="See stock health at a glance, then receive, issue, or clear today’s production requests."
      breadcrumbs={[{ label: 'Store', to: '/inventory' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'today', label: 'Today’s Work', onClick: () => navigate('/inventory/store-workbench') }}
          secondaryActions={[
            { id: 'stock', label: 'Check Stock', onClick: () => navigate('/inventory/stock') },
            {
              id: 'retry',
              label: 'Refresh',
              onClick: () => setReloadToken((n) => n + 1),
            },
          ]}
        />
      )}
      kpiStrip={loadState === 'ready' && data ? kpiItems : undefined}
    >
      {loadState === 'loading' ? <LoadingState variant="dashboard" /> : null}
      {loadState === 'error' ? (
        <EmptyState
          icon={Package}
          title="Could not load Store Home"
          description="Check that you are online and signed in, then try again."
          action={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              onClick={() => setReloadToken((n) => n + 1)}
            >
              Retry
            </button>
          )}
        />
      ) : null}
      {loadState === 'ready' && data ? (
        <>
          <div className="mb-4 rounded-lg border border-[#c7e0f4] bg-[#f3f9fd] px-4 py-3 text-[13px] text-[#242424]">
            <p className="font-semibold">How store works (start here)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#605e5c]">
              <li>
                <button type="button" className="font-medium text-[#0078d4] underline" onClick={() => navigate('/purchase/grn')}>
                  Receive against PO
                </button>
                {' '}(Purchase GRN) — stock is updated automatically.
              </li>
              <li>
                <button type="button" className="font-medium text-[#0078d4] underline" onClick={() => navigate('/inventory/store-workbench')}>
                  Issue / reserve for production
                </button>
                {' '}from Today’s Work.
              </li>
              <li>
                <button type="button" className="font-medium text-[#0078d4] underline" onClick={() => navigate('/inventory/stock')}>
                  Check available stock
                </button>
                {' '}before issuing.
              </li>
            </ol>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { label: 'Receive vs PO (GRN)', icon: ArrowDownToLine, href: '/purchase/grn' },
              { label: 'Direct Receive', icon: ArrowDownToLine, href: '/inventory/movements/receipts/new' },
              { label: 'Issue Stock', icon: ArrowUpFromLine, href: '/inventory/movements/issues/new' },
              { label: 'Move Warehouses', icon: ArrowLeftRight, href: '/inventory/movements/transfers' },
              { label: 'Adjust Stock', icon: SlidersHorizontal, href: '/inventory/movements/adjustments' },
              { label: 'Stock Count', icon: ClipboardList, href: '/inventory/stock-count' },
              { label: 'Today’s Work', icon: Package, href: '/inventory/store-workbench' },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                className="erp-btn erp-btn-secondary inline-flex h-9 items-center gap-2 px-3 text-[13px]"
                onClick={() => navigate(action.href)}
              >
                <action.icon className="h-4 w-4" aria-hidden />
                {action.label}
              </button>
            ))}
          </div>

          <DynamicsDashboardGrid>
            <DynamicsDashboardPanel title="What to do next" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Task</th><th className="text-right">Waiting</th></tr></thead>
                <tbody>
                  {data.pendingActions.map((row) => (
                    <tr key={row.id} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td>{row.label}</td>
                      <td className="text-right font-mono">{row.count > 0 ? row.count : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel title="Low and Out-of-Stock Items" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Item</th><th className="text-right">On Hand</th><th className="text-right">Reorder</th></tr></thead>
                <tbody>
                  {data.lowStockItems.slice(0, 8).map((row) => (
                    <tr key={`low-${row.itemId}`} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td><span className="font-mono text-xs">{row.itemCode}</span> {row.itemName}</td>
                      <td className="text-right font-mono">{row.onHand}</td>
                      <td className="text-right font-mono">{row.reorderLevel}</td>
                    </tr>
                  ))}
                  {data.outOfStockItems.slice(0, Math.max(0, 8 - data.lowStockItems.length)).map((row) => (
                    <tr key={`out-${row.itemId}`} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td><span className="font-mono text-xs">{row.itemCode}</span> {row.itemName}</td>
                      <td className="text-right font-mono">0</td>
                      <td className="text-right font-mono">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel title="Quality-Hold Stock" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Item</th><th className="text-right">Qty</th></tr></thead>
                <tbody>
                  {data.qualityHoldItems.length === 0 ? (
                    <tr><td colSpan={2} className="text-erp-muted">No quality-hold stock</td></tr>
                  ) : data.qualityHoldItems.map((row) => (
                    <tr key={row.itemId} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td><span className="font-mono text-xs">{row.itemCode}</span> {row.itemName}</td>
                      <td className="text-right font-mono">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel title="Recent Stock Movements" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Doc</th><th>Item</th><th>Type</th><th className="text-right">Qty</th><th>Date</th></tr></thead>
                <tbody>
                  {data.recentMovements.map((row) => (
                    <tr key={row.id} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td className="font-mono text-xs">{row.movementNo}</td>
                      <td>{row.itemCode}</td>
                      <td>{row.type}</td>
                      <td className="text-right font-mono">{row.qty}</td>
                      <td>{formatDate(row.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel title="Warehouse-Wise Stock" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Warehouse</th><th className="text-right">SKUs</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {data.warehouseStock.map((row) => (
                    <tr key={row.warehouseId} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td>{row.warehouseName}</td>
                      <td className="text-right font-mono">{row.skuCount}</td>
                      <td className="text-right font-mono">{formatCurrency(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel title="Inventory Value by Category" noPadding>
              <table className="erp-table w-full">
                <thead><tr><th>Category</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {data.categoryValue.map((row) => (
                    <tr key={row.categoryName} className="cursor-pointer hover:bg-erp-bg-subtle" onClick={() => navigate(row.href)}>
                      <td>{row.categoryName}</td>
                      <td className="text-right font-mono">{formatCurrency(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicsDashboardPanel>
          </DynamicsDashboardGrid>

          <p className="mt-4 text-xs text-erp-muted">
            <Package className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Demo mode — KPIs computed from stock ledger and master data.{' '}
            <Link to="/inventory/stock" className="text-erp-primary underline">View stock availability</Link>
          </p>
        </>
      ) : null}
    </OperationalPageShell>
  )
}
