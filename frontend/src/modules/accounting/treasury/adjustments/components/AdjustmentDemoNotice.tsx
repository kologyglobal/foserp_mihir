import { Link } from 'react-router-dom'
import { CloudOff } from 'lucide-react'

/**
 * Treasury adjustments post directly to the GL and have no safe demo-only simulation — showing a
 * fabricated posting result in Zustand demo mode would be misleading. This banner explains the
 * API-mode requirement instead of inventing fake GL entries (per Phase 5B3 constraints).
 */
export function AdjustmentDemoNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-8 text-center">
      <CloudOff className="h-8 w-8 text-erp-muted" />
      <div>
        <p className="text-[14px] font-semibold text-erp-text">API mode required</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-erp-muted">
          Bank transactions (treasury adjustments) post real GL entries and are only available when this workspace is connected to the
          Finance API (<code className="rounded bg-erp-surface px-1 py-0.5 text-[12px]">VITE_USE_API=true</code>). Demo mode does not
          simulate GL posting for this module.
        </p>
      </div>
      <Link to="/accounting/bank-cash" className="text-[13px] font-semibold text-erp-primary hover:underline">
        Back to Bank &amp; Cash overview
      </Link>
    </div>
  )
}
