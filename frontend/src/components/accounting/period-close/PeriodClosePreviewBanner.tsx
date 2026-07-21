import { AlertTriangle, Info } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'

/** Honesty banner — demo preview vs Phase 1 API wiring */
export function PeriodClosePreviewBanner({ dense }: { dense?: boolean }) {
  const api = isApiMode()
  const box = dense
    ? 'flex items-start gap-2 rounded border px-2.5 py-1.5 text-[11px]'
    : 'flex items-start gap-2 rounded border px-3 py-2 text-[12px]'

  if (api) {
    return (
      <div role="status" className={`${box} border-sky-200 bg-sky-50 text-sky-950`}>
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
        <p>
          <span className="font-semibold">Period Close Phase 1 (API).</span> Dashboard, checklist, and period locking
          use real <code className="text-[10px]">finance.period.*</code> close/reopen and readiness from shipped
          finance (AP close gate, unposted journals, bank recon). Accruals, year-end, FA/GST/inventory module close
          screens remain demo scaffolding.
        </p>
      </div>
    )
  }

  return (
    <div role="status" className={`${box} border-amber-200 bg-amber-50 text-amber-950`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
      <p>
        <span className="font-semibold">Frontend period-close preview based on demo data.</span> No modules were
        actually locked, and no ledger, inventory, or tax balances were updated. Soft/hard locks, reopen, accruals,
        FX, and year-end actions are simulated until you switch to API mode for Phase 1 period close.
      </p>
    </div>
  )
}
