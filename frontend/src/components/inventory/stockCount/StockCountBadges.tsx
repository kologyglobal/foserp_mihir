import type { StockCountStatus } from '@/types/inventoryDomain'
import { STOCK_COUNT_STATUS_LABELS, stockCountStatusTone } from '@/utils/stockCountLabels'
import { cn } from '@/utils/cn'

const TONE_CLASS: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-900',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
}

export function StockCountStatusBadge({ status }: { status: StockCountStatus }) {
  const tone = stockCountStatusTone(status)
  return (
    <span className={cn('inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', TONE_CLASS[tone])}>
      {STOCK_COUNT_STATUS_LABELS[status]}
    </span>
  )
}

export function StockCountDemoBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
    >
      <strong>Demo mode:</strong> Stock counts use frozen snapshots. Adjustment preview and posting simulate impact only — no real ledger posting.
    </div>
  )
}
