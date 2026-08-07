import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { getPurchaseOrderReceiptRollup } from '@/services/purchase/poReceiptRollupService'
import type { PoLineReceiptRollup, PurchaseOrderReceiptRollup } from '@/types/operationalStockViews'
import { GRN_DOMAIN_STATUS_LABELS } from '@/types/purchaseDomain'
import type { GrnDomainStatus } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

type Props = {
  purchaseOrderId: string
  /** Optional refresh key — bump after GRN create/post on this PO. */
  refreshToken?: number | string
  /** When parent already holds rollup data, skip internal fetch. */
  rollup?: PurchaseOrderReceiptRollup | null
}

function grnStatusLabel(status: string): string {
  const key = status as GrnDomainStatus
  return GRN_DOMAIN_STATUS_LABELS[key] ?? status
}

function LineRow({
  line,
  open,
  onToggle,
}: {
  line: PoLineReceiptRollup
  open: boolean
  onToggle: () => void
}) {
  const hasRejects = line.rejectedQty > 0
  return (
    <div className="ops-summary-card">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tabular-nums text-erp-muted">#{line.lineNo}</span>
            <span className="font-mono text-[11px] text-erp-muted">{line.itemCode}</span>
            {line.itemId ? (
              <Link
                to={`/inventory/stock/${line.itemId}`}
                className="shrink-0 text-[11px] font-semibold text-[#0078d4] hover:underline"
              >
                Item 360
              </Link>
            ) : null}
          </div>
          <div className="truncate text-[14px] font-semibold text-erp-text" title={line.itemName}>
            {line.itemName}
          </div>
          <div className="mt-0.5 text-[11px] text-erp-muted">
            {line.uom || '-'}
            {line.rate > 0 ? (
              <>
                {' · '}
                {formatCurrency(line.rate)}
                {line.amount > 0 ? (
                  <span className="text-erp-muted"> · Line {formatCurrency(line.amount)}</span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="text-right text-[11px] text-erp-muted">
          {line.grnCount > 0 ? (
            <span className="font-mono">
              {line.grnCount} GRN{line.grnCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span>No receipts</span>
          )}
        </div>
      </div>

      <div className="ops-summary-card__metrics mb-2">
        <div className="ops-summary-card__metric">
          <span className="ops-summary-card__metric-label">Ordered</span>
          <span className="ops-summary-card__metric-value font-mono">{formatNumber(line.orderedQty)}</span>
        </div>
        <div className="ops-summary-card__metric">
          <span className="ops-summary-card__metric-label">Received</span>
          <span className="ops-summary-card__metric-value font-mono">{formatNumber(line.receivedQty)}</span>
        </div>
        <div className="ops-summary-card__metric">
          <span className="ops-summary-card__metric-label">Pending</span>
          <span className="ops-summary-card__metric-value font-mono">{formatNumber(line.pendingQty)}</span>
        </div>
        {hasRejects ? (
          <div className="ops-summary-card__metric">
            <span className="ops-summary-card__metric-label">Rejected</span>
            <span className="ops-summary-card__metric-value font-mono text-red-700">
              {formatNumber(line.rejectedQty)}
            </span>
          </div>
        ) : null}
      </div>

      {line.grns.length > 0 ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0078d4]"
            onClick={onToggle}
            aria-expanded={open}
          >
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
            {open ? 'Hide GRNs' : 'Show GRNs (unmerged)'}
          </button>
          {open ? (
            <ul className="mt-2 divide-y divide-erp-border border-t border-erp-border pt-2 text-[12px]">
              {line.grns.map((g) => (
                <li
                  key={`${g.grnId}-${g.grnLineId}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold">{g.grnNumber}</span>
                    <span className="mx-2 text-erp-muted">{formatDate(g.receiptDate)}</span>
                    <span className="text-erp-muted">{g.vendorName}</span>
                    <span className="ml-2 rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] text-erp-muted">
                      {grnStatusLabel(g.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums">
                      {formatNumber(g.qty)}
                      {g.rejectedQty > 0 ? (
                        <span className="text-red-700"> / rej {formatNumber(g.rejectedQty)}</span>
                      ) : null}
                      {g.rate > 0 ? <> @ {formatCurrency(g.rate)}</> : null}
                    </span>
                    <Link to={g.href} className="font-semibold text-[#0078d4] hover:underline">
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * Expandable per-PO-line receipt rollup. Summary metrics only; GRNs stay individual documents.
 */
export function PoReceiptRollupPanel({ purchaseOrderId, refreshToken = 0, rollup: external }: Props) {
  const [rollup, setRollup] = useState<PurchaseOrderReceiptRollup | null>(external ?? null)
  const [loading, setLoading] = useState(external == null)
  const [error, setError] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (external != null) {
      setRollup(external)
      setLoading(false)
      setError(null)
      return
    }
    if (!purchaseOrderId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPurchaseOrderReceiptRollup(purchaseOrderId)
      setRollup(data)
    } catch {
      setRollup(null)
      setError('Could not load receipt rollup')
    } finally {
      setLoading(false)
    }
  }, [purchaseOrderId, refreshToken, external])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (external != null) setRollup(external)
  }, [external])

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading receipt rollup">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="ops-summary-card">
            <div className="erp-skeleton mb-2 h-4 w-40 rounded" />
            <div className="ops-summary-card__metrics">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="ops-summary-card__metric">
                  <div className="erp-skeleton h-3 w-12 rounded" />
                  <div className="erp-skeleton mt-1 h-4 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-[13px] text-erp-muted" role="alert">
        {error}
      </p>
    )
  }

  if (!rollup || rollup.lines.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No order lines"
        description="Receipt rollup appears once this PO has item lines."
      />
    )
  }

  const anyReceipts = rollup.lines.some((l) => l.grns.length > 0)

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-erp-muted">
        Operational totals per line from individual GRNs
        {rollup.grnDocumentCount > 0
          ? ` (${rollup.grnDocumentCount} receipt document${rollup.grnDocumentCount === 1 ? '' : 's'})`
          : ''}
        . Expand a line to open each GRN — documents are never merged.
      </p>
      {!anyReceipts ? (
        <p className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 px-3 py-2 text-[12px] text-erp-muted">
          No goods receipts against this order yet. Ordered and pending quantities reflect the PO lines.
        </p>
      ) : null}
      <div className="ops-summary-grid">
        {rollup.lines.map((line) => (
          <LineRow
            key={line.poLineId}
            line={line}
            open={openIds.has(line.poLineId)}
            onToggle={() => toggle(line.poLineId)}
          />
        ))}
      </div>
    </div>
  )
}
