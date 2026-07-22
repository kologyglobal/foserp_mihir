import { Link } from 'react-router-dom'
import { CloudOff } from 'lucide-react'

export function SIDemoNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-8 text-center">
      <CloudOff className="h-8 w-8 text-erp-muted" />
      <div>
        <p className="text-[14px] font-semibold text-erp-text">API mode required</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-erp-muted">
          Standing instructions generate draft bank transactions that post real GL entries once approved and posted. This module is only
          available when connected to the Finance API (<code className="rounded bg-erp-surface px-1 py-0.5 text-[12px]">VITE_USE_API=true</code>
          ).
        </p>
      </div>
      <Link to="/accounting/bank-cash" className="text-[13px] font-semibold text-erp-primary hover:underline">
        Back to Bank &amp; Cash overview
      </Link>
    </div>
  )
}
