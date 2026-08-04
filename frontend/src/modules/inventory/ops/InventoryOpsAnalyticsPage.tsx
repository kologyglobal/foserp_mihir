import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getOperationalAnalytics } from '@/services/inventory'
import type { OperationalAnalytics } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'

function Widget({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="ops-summary-card">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">{title}</div>
      {children}
    </div>
  )
}

export function InventoryOpsAnalyticsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<OperationalAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setData(await getOperationalAnalytics())
    } catch {
      setData(null)
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
      title="Operations Analytics"
      description="Summary widgets from balanced stock + purchase/GRN documents (documents remain unmerged)."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Ops Analytics' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/ops/analytics"
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
      {!loading && !data ? (
        <EmptyState icon={BarChart3} title="No analytics data" description="Post POs, GRNs, or stock to populate widgets." />
      ) : null}
      {!loading && data ? (
        <div className="ops-summary-grid">
          <Widget title="Top purchased items">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.topPurchasedItems.map((r) => (
                  <tr
                    key={r.itemId}
                    className="cursor-pointer hover:bg-erp-bg-subtle"
                    onClick={() => navigate(`/inventory/stock/${r.itemId}`)}
                  >
                    <td>
                      <span className="font-mono text-[11px]">{r.itemCode}</span> {r.itemName}
                    </td>
                    <td className="text-right font-mono">{formatNumber(r.qty)}</td>
                    <td className="text-right font-mono">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="Most received items">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">GRNs</th>
                </tr>
              </thead>
              <tbody>
                {data.mostReceivedItems.map((r) => (
                  <tr
                    key={r.itemId}
                    className="cursor-pointer hover:bg-erp-bg-subtle"
                    onClick={() => navigate(`/inventory/stock/${r.itemId}`)}
                  >
                    <td>
                      <span className="font-mono text-[11px]">{r.itemCode}</span> {r.itemName}
                    </td>
                    <td className="text-right font-mono">{formatNumber(r.qty)}</td>
                    <td className="text-right font-mono">{r.grnCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="Vendor-wise receipts">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">GRNs</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorWiseReceipts.map((r) => (
                  <tr key={r.vendorId}>
                    <td>{r.vendorName}</td>
                    <td className="text-right font-mono">{formatNumber(r.qty)}</td>
                    <td className="text-right font-mono">{r.grnCount}</td>
                    <td className="text-right font-mono">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="Warehouse stock">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.warehouseStock.map((r) => (
                  <tr
                    key={r.warehouseId}
                    className="cursor-pointer hover:bg-erp-bg-subtle"
                    onClick={() => navigate(`/inventory/stock?warehouseId=${encodeURIComponent(r.warehouseId)}`)}
                  >
                    <td>{r.warehouseName}</td>
                    <td className="text-right font-mono">{formatNumber(r.onHand)}</td>
                    <td className="text-right font-mono">{formatCurrency(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="Purchase trend (by month)">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">POs</th>
                  <th className="text-right">Ordered qty</th>
                </tr>
              </thead>
              <tbody>
                {data.purchaseTrend.map((r) => (
                  <tr key={r.period}>
                    <td className="font-mono text-[12px]">{r.period}</td>
                    <td className="text-right font-mono">{r.poCount}</td>
                    <td className="text-right font-mono">{formatNumber(r.orderedQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="GRN trend (by month)">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">GRNs</th>
                  <th className="text-right">Received qty</th>
                </tr>
              </thead>
              <tbody>
                {data.grnTrend.map((r) => (
                  <tr key={r.period}>
                    <td className="font-mono text-[12px]">{r.period}</td>
                    <td className="text-right font-mono">{r.grnCount}</td>
                    <td className="text-right font-mono">{formatNumber(r.receivedQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>

          <Widget title="Receipt frequency (per month)">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Receipts / mo</th>
                </tr>
              </thead>
              <tbody>
                {data.receiptFrequency.map((r) => (
                  <tr
                    key={r.itemId}
                    className="cursor-pointer hover:bg-erp-bg-subtle"
                    onClick={() => navigate(`/inventory/stock/${r.itemId}`)}
                  >
                    <td className="font-mono text-[12px]">{r.itemCode}</td>
                    <td className="text-right font-mono">{r.receiptsPerMonth.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Widget>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
