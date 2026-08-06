import { Package } from 'lucide-react'
import type { PoLinesEditorLine } from '@/components/purchase/PurchaseOrderLinesTable'
import { lineShowsLifecycleMetrics } from '@/utils/poCompactLineHelpers'

export type PoLineLifecycleStripProps = {
  lines: PoLinesEditorLine[]
  formatCurrency?: (n: number) => string
  /** Hide entirely when no receipt/invoice activity */
  forceHide?: boolean
}

/**
 * Optional read-only lifecycle strip for existing POs with receipt/invoice data.
 * Not shown on create drafts; full lifecycle remains on 360 / GRN / invoice.
 */
export function PoLineLifecycleStrip({
  lines,
  forceHide = false,
}: PoLineLifecycleStripProps) {
  if (forceHide) return null
  const active = lines.filter(lineShowsLifecycleMetrics)
  if (active.length === 0) return null

  const totals = active.reduce(
    (acc, l) => ({
      outstanding: acc.outstanding + (Number(l.outstandingQty ?? l.pendingQty) || 0),
      received: acc.received + (Number(l.receivedQty) || 0),
      invoiced: acc.invoiced + (Number(l.invoicedQty) || 0),
    }),
    { outstanding: 0, received: 0, invoiced: 0 },
  )

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[11px] text-erp-muted"
      role="status"
      aria-label="Line receipt and invoice progress"
    >
      <Package className="h-3.5 w-3.5 shrink-0 text-erp-muted" aria-hidden />
      <span className="font-medium text-erp-text">Receiving / invoicing (read-only)</span>
      <span className="tabular-nums">
        Outstanding qty <strong className="text-erp-text">{totals.outstanding}</strong>
      </span>
      <span className="tabular-nums">
        Received <strong className="text-erp-text">{totals.received}</strong>
      </span>
      <span className="tabular-nums">
        Invoiced <strong className="text-erp-text">{totals.invoiced}</strong>
      </span>
      <span className="ml-auto hidden sm:inline">
        Details stay on GRN / invoice / 360 — not editable here
      </span>
    </div>
  )
}
