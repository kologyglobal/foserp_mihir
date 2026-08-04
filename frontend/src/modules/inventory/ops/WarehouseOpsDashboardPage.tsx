import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, RefreshCw, Warehouse } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listWarehouseOpsSummaries } from '@/services/inventory'
import type { WarehouseOpsSummary } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'

export function WarehouseOpsDashboardPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WarehouseOpsSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setRows(await listWarehouseOpsSummaries())
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Warehouse Operations"
      description="Consolidated stock health by warehouse — balances only, not document registers."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Warehouse Ops' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/ops/warehouses"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => setToken((n) => n + 1),
          }}
          secondaryActions={[
            { id: 'stock', label: 'Consolidated Stock', onClick: () => navigate('/inventory/stock') },
          ]}
        />
      )}
    >
      {loading ? <LoadingState variant="dashboard" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Warehouse} title="No warehouse balances" description="Stock balances will appear after receipts or opening stock." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="ops-summary-grid">
          {rows.map((w) => (
            <button
              key={w.warehouseId}
              type="button"
              className="ops-summary-card text-left"
              onClick={() => navigate(`/inventory/stock?warehouseId=${encodeURIComponent(w.warehouseId)}`)}
            >
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#0078d4]" aria-hidden />
                <div>
                  <div className="text-[14px] font-semibold">{w.warehouseName}</div>
                  <div className="font-mono text-[11px] text-erp-muted">{w.warehouseCode}</div>
                </div>
              </div>
              <div className="ops-summary-card__metrics">
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Items</span>
                  <span className="ops-summary-card__metric-value font-mono">{w.totalItems}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">On hand qty</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(w.totalStockQty)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Value</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatCurrency(w.totalStockValue)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Incoming</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(w.incomingQty)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Reserved</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(w.reservedQty)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Low / negative</span>
                  <span className="ops-summary-card__metric-value font-mono">
                    {w.lowStockItems} / {w.negativeStockItems}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
