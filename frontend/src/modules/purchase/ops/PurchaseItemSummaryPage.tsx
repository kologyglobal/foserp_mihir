import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listItemPurchaseSummaries } from '@/services/inventory'
import type { ItemPurchaseSummary } from '@/types/operationalStockViews'
import { formatNumber } from '@/utils/formatters/currency'

type Row = ItemPurchaseSummary & { itemCode: string; itemName: string }

export function PurchaseItemSummaryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setRows(await listItemPurchaseSummaries(search || undefined))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Purchase"
      title="Purchase Item Summary"
      description="Ordered vs received vs pending by item — from open POs and GRNs (not a merged ledger)."
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Item Summary' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/purchase/ops/item-summary"
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
      filterBar={(
        <div className="ops-filter-bar">
          <input
            className="erp-input h-8 min-w-[14rem] text-[12px]"
            placeholder="Search item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setToken((n) => n + 1)
            }}
          />
          <button type="button" className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]" onClick={() => setToken((n) => n + 1)}>
            Apply
          </button>
        </div>
      )}
    >
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Package} title="No purchase activity" description="Items appear after POs or GRNs reference them." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-erp-border bg-white">
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Rejected</th>
                <th className="text-right">Returned</th>
                <th className="text-right">Invoice pending</th>
                <th className="text-right">Open POs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId}>
                  <td>
                    <Link to={`/inventory/stock/${r.itemId}`} className="block hover:underline">
                      <div className="font-mono text-[11px] text-erp-muted">{r.itemCode}</div>
                      <div className="text-[13px] font-medium text-[#0078d4]">{r.itemName}</div>
                    </Link>
                  </td>
                  <td className="text-right font-mono">{formatNumber(r.totalOrdered)}</td>
                  <td className="text-right font-mono">{formatNumber(r.totalReceived)}</td>
                  <td className="text-right font-mono">{formatNumber(r.pendingQty)}</td>
                  <td className="text-right font-mono">{formatNumber(r.rejectedQty)}</td>
                  <td className="text-right font-mono">{formatNumber(r.returnedQty)}</td>
                  <td className="text-right font-mono">{formatNumber(r.invoicePendingQty)}</td>
                  <td className="text-right font-mono">{r.outstandingPoCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
