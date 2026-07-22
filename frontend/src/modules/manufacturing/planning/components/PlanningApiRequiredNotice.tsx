import { CloudOff } from 'lucide-react'
import { Link } from 'react-router-dom'

/** API-mode-required notice for Phase 6A1 screens (no client-side planning simulation) — mirrors treasury bankbook notice pattern. */
export function PlanningApiRequiredNotice({ description }: { description?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-8 text-center">
      <CloudOff className="h-8 w-8 text-erp-muted" />
      <div>
        <p className="text-[14px] font-semibold text-erp-text">API mode required</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-erp-muted">
          {description ??
            'Production Planning is calculated server-side from live demand and is only available when this workspace is connected to the API '}
          <code className="rounded bg-erp-surface px-1 py-0.5 text-[12px]">VITE_USE_API=true</code>.
        </p>
      </div>
      <Link to="/manufacturing/today" className="text-[13px] font-semibold text-erp-primary hover:underline">
        Back to Manufacturing
      </Link>
    </div>
  )
}
