/**
 * Phase 1 — full stock detail for `/inventory/stock/:itemId` (domain mock service).
 * Replaces legacy Zustand ItemStockDetailPage for this route.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ExternalLink,
  Package,
  ShieldOff,
  SlidersHorizontal,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { StockDetailsDrawer } from '@/components/inventory/StockDetailsDrawer'
import { getItemById, getStockDetails } from '@/services/inventory'
import type { InventoryItem, StockDetailsData } from '@/types/inventoryDomain'
import { INVENTORY_ITEM_TYPE_LABELS, stockStatusLabel } from '@/utils/inventoryItemLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

type LoadState = 'loading' | 'ready' | 'error'

export function InventoryStockDetailPage() {
  const { itemId } = useParams()
  const [searchParams] = useSearchParams()
  const warehouseId = searchParams.get('warehouse') ?? undefined
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [stock, setStock] = useState<StockDetailsData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadToken, setReloadToken] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!perms.canViewStock || !itemId) return
    let cancelled = false
    setLoadState('loading')
    setItem(null)
    setStock(null)
    Promise.all([getItemById(itemId), getStockDetails(itemId, warehouseId)])
      .then(([i, s]) => {
        if (cancelled) return
        if (!i) {
          navigate('/inventory/stock')
          return
        }
        setItem(i)
        setStock(s)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [itemId, warehouseId, navigate, perms.canViewStock, reloadToken])

  if (!perms.canViewStock) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Stock Details"
        breadcrumbs={[
          { label: 'Inventory & Warehouse', to: '/inventory' },
          { label: 'Stock Availability', to: '/inventory/stock' },
          { label: 'Details' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={ShieldOff}
          title="Access denied"
          description="You do not have permission to view stock details (inventory.stock.view)."
        />
      </OperationalPageShell>
    )
  }

  if (loadState === 'loading') return <LoadingState variant="card" />

  if (loadState === 'error' || !item || !stock) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Stock Details"
        breadcrumbs={[
          { label: 'Inventory & Warehouse', to: '/inventory' },
          { label: 'Stock Availability', to: '/inventory/stock' },
          { label: 'Details' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={Package}
          title="Could not load stock details"
          description="Something went wrong while loading stock for this item. Try again."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                onClick={() => setReloadToken((n) => n + 1)}
              >
                Retry
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]"
                onClick={() => navigate('/inventory/stock')}
              >
                Back to Stock
              </button>
            </div>
          )}
        />
      </OperationalPageShell>
    )
  }

  const status = stockStatusLabel(stock.summary.onHand, stock.summary.available, item.reorderLevel)

  return (
    <>
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title={`${item.itemCode} — Stock`}
        description={`${item.itemName} · ${INVENTORY_ITEM_TYPE_LABELS[item.itemType]}`}
        breadcrumbs={[
          { label: 'Inventory & Warehouse', to: '/inventory' },
          { label: 'Stock Availability', to: '/inventory/stock' },
          { label: item.itemCode },
        ]}
        autoBreadcrumbs={false}
        favoritePath={`/inventory/stock/${itemId}`}
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'drawer',
              label: 'Stock Details',
              onClick: () => setDrawerOpen(true),
            }}
            secondaryActions={[
              {
                id: 'item',
                label: 'View Item',
                icon: ExternalLink,
                onClick: () => navigate(`/inventory/items/${item.id}`),
              },
              {
                id: 'receive',
                label: 'Receive Material',
                icon: ArrowDownToLine,
                onClick: () => navigate('/inventory/movements/receipts'),
              },
              {
                id: 'issue',
                label: 'Issue Material',
                icon: ArrowUpFromLine,
                onClick: () => navigate('/inventory/movements/issues'),
              },
              {
                id: 'transfer',
                label: 'Transfer Stock',
                icon: ArrowLeftRight,
                onClick: () => navigate('/inventory/movements/transfers'),
              },
              {
                id: 'adjust',
                label: 'Adjust Stock',
                icon: SlidersHorizontal,
                onClick: () => navigate('/inventory/movements/adjustments'),
              },
              ...(perms.canViewItemLedger
                ? [{ id: 'ledger', label: 'Item Ledger', onClick: () => navigate(`/inventory/items/${item.id}/ledger`) }]
                : []),
              {
                id: 'planning',
                label: 'View Planning',
                onClick: () => navigate('/inventory/planning'),
              },
            ]}
          />
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px]">
          <StatusDot label={status} tone={statusToneFromLabel(status)} />
          <span className="text-erp-muted">
            Available = On Hand − Reserved − Quality Hold − Blocked
          </span>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'On Hand', value: stock.summary.onHand },
            { label: 'Quality Hold', value: stock.summary.qualityHold },
            { label: 'Blocked', value: stock.summary.blocked },
            { label: 'Reserved', value: stock.summary.reserved },
            { label: 'Available', value: stock.summary.available },
            { label: 'Expected Receipt', value: stock.summary.expectedReceipt },
            { label: 'Planned Issue', value: stock.summary.plannedIssue },
            {
              label: 'Inventory Value',
              value: perms.canViewCost ? formatCurrency(stock.summary.stockValue) : '—',
              raw: true,
            },
          ].map((k) => (
            <div key={k.label} className="rounded border border-erp-border bg-erp-surface p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-erp-muted">{k.label}</div>
              <div className="mt-1 text-[16px] font-semibold tabular-nums text-erp-text">
                {'raw' in k && k.raw ? k.value : formatNumber(k.value as number)}
              </div>
            </div>
          ))}
        </div>

        <section className="rounded border border-erp-border bg-erp-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-erp-text">Warehouse balances</h2>
            <Link to="/inventory/stock" className="text-[12px] font-semibold text-erp-primary hover:underline">
              Back to Stock Availability
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-[12px]">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="text-right">On Hand</th>
                  <th className="text-right">QH</th>
                  <th className="text-right">Blocked</th>
                  <th className="text-right">Reserved</th>
                  <th className="text-right">Available</th>
                  {perms.canViewCost ? <th className="text-right">Value</th> : null}
                </tr>
              </thead>
              <tbody>
                {stock.warehouses.map((w) => (
                  <tr key={w.warehouseId}>
                    <td>{w.warehouseName}</td>
                    <td className="text-right font-mono">{formatNumber(w.onHand)}</td>
                    <td className="text-right font-mono">{formatNumber(w.qualityHold)}</td>
                    <td className="text-right font-mono">{formatNumber(w.blocked)}</td>
                    <td className="text-right font-mono">{formatNumber(w.reserved)}</td>
                    <td className="text-right font-mono">{formatNumber(w.available)}</td>
                    {perms.canViewCost ? (
                      <td className="text-right font-mono">{formatCurrency(w.stockValue)}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </OperationalPageShell>

      <StockDetailsDrawer
        itemId={drawerOpen ? item.id : null}
        warehouseId={warehouseId}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
