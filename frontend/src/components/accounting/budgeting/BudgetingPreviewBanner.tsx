import { AlertTriangle } from 'lucide-react'

/** Always-visible honesty banner for budgeting preview screens */
export function BudgetingPreviewBanner({ dense }: { dense?: boolean }) {
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
        <span className="font-semibold">Budgeting preview — demo data.</span> No GL posting or live commitment
        engine. Actual / committed figures are illustrative until finance APIs and purchase commitment sync exist.
      </p>
    </div>
  )
}
