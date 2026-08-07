import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Package, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listItemReceiptSummaries } from '@/services/inventory'
import type { ItemReceiptSummary } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

type Row = ItemReceiptSummary & { itemCode: string; itemName: string }

export function ReceiptSummaryRegisterPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [token, setToken] = useState(0)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setRows(await listItemReceiptSummaries(search || undefined))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, token])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Purchase"
      title="Receipt Summary"
      description="Item-level receipt KPIs. Expand for individual GRNs — never merged across documents."
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Receipt Summary' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/purchase/ops/receipts"
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
      {loading ? <LoadingState variant="dashboard" /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState icon={Package} title="No receipts" description="GRNs will appear here after goods receipt." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="ops-summary-grid">
          {rows.map((r) => {
            const open = openIds.has(r.itemId)
            return (
              <div key={r.itemId} className="ops-summary-card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-erp-muted">{r.itemCode}</div>
                    <div className="text-[14px] font-semibold">{r.itemName}</div>
                  </div>
                  <Link
                    to={`/inventory/stock/${r.itemId}`}
                    className="shrink-0 text-[12px] font-semibold text-[#0078d4] hover:underline"
                  >
                    Item 360
                  </Link>
                </div>
                <div className="ops-summary-card__metrics mb-2">
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">Receipt lines</span>
                    <span className="ops-summary-card__metric-value font-mono">{r.totalReceipts}</span>
                  </div>
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">Qty</span>
                    <span className="ops-summary-card__metric-value font-mono">{formatNumber(r.totalQtyReceived)}</span>
                  </div>
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">Avg rate</span>
                    <span className="ops-summary-card__metric-value font-mono">{formatCurrency(r.averagePurchaseRate)}</span>
                  </div>
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">Last date</span>
                    <span className="ops-summary-card__metric-value">
                      {r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : '-'}
                    </span>
                  </div>
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">Vendors</span>
                    <span className="ops-summary-card__metric-value font-mono">{r.vendorCount}</span>
                  </div>
                  <div className="ops-summary-card__metric">
                    <span className="ops-summary-card__metric-label">GRNs</span>
                    <span className="ops-summary-card__metric-value font-mono">{r.grnCount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0078d4]"
                  onClick={() => toggle(r.itemId)}
                >
                  <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
                  {open ? 'Hide GRNs' : 'Show GRNs (unmerged)'}
                </button>
                {open ? (
                  <ul className="mt-2 divide-y divide-erp-border border-t border-erp-border pt-2 text-[12px]">
                    {r.grns.map((g, idx) => (
                      <li key={`${g.grnId}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <div>
                          <span className="font-mono font-semibold">{g.grnNumber}</span>
                          <span className="mx-2 text-erp-muted">{formatDate(g.receiptDate)}</span>
                          <span>{g.vendorName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {formatNumber(g.qty)} @ {formatCurrency(g.rate)}
                          </span>
                          <Link to={g.href} className="font-semibold text-[#0078d4] hover:underline">
                            Open
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
