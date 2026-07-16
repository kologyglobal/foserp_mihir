import { AlertTriangle } from 'lucide-react'

/** Always-visible honesty banner for period close preview screens */
export function PeriodClosePreviewBanner({ dense }: { dense?: boolean }) {
  return (
    <div
      role="status"
      className={
        dense
          ? 'flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-950'
          : 'flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950'
      }
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
      <p>
        <span className="font-semibold">Frontend period-close preview based on demo data.</span> No modules were
        actually locked, and no ledger, inventory, or tax balances were updated. Soft/hard locks, reopen, accruals,
        FX, and year-end actions are simulated until a backend close engine exists.
      </p>
    </div>
  )
}
