import { useCallback, useEffect, useState } from 'react'
import { Truck, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listVendorOpsSummaries } from '@/services/inventory'
import type { VendorOpsSummary } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'

export function VendorOpsSummaryPage() {
  const [rows, setRows] = useState<VendorOpsSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setRows(await listVendorOpsSummaries())
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
      badge="Purchase"
      title="Vendor Operations"
      description="Vendor-wise orders, GRNs, supply qty, and delayed open lines — summary only."
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Vendor Ops' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/purchase/ops/vendors"
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
        />
      )}
    >
      {loading ? <LoadingState variant="dashboard" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Truck} title="No vendor activity" description="Vendors appear after POs or GRNs." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="ops-summary-grid">
          {rows.map((v) => (
            <div key={v.vendorId} className="ops-summary-card">
              <div className="mb-2">
                <div className="font-mono text-[11px] text-erp-muted">{v.vendorCode || v.vendorId}</div>
                <div className="text-[14px] font-semibold">{v.vendorName}</div>
              </div>
              <div className="ops-summary-card__metrics">
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Orders</span>
                  <span className="ops-summary-card__metric-value font-mono">{v.totalOrders}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">GRNs</span>
                  <span className="ops-summary-card__metric-value font-mono">{v.totalGrns}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Qty supplied</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(v.totalQtySupplied)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Avg rate</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatCurrency(v.averageRate)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Last supply</span>
                  <span className="ops-summary-card__metric-value">
                    {v.lastSupplyDate ? formatDate(v.lastSupplyDate) : '—'}
                  </span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Delayed lines</span>
                  <span className="ops-summary-card__metric-value font-mono">{v.delayedDeliveries}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Rejected qty</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(v.rejectedQty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
