import { isApiMode } from '@/config/apiConfig'

/** Banner for budgeting surfaces not in Phase 1 API scope. */
export function BudgetingPhase1NaBanner() {
  if (!isApiMode()) return null
  return (
    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
      Phase 1 N/A — this screen remains demo-only. Use Overview, Versions, Annual Budget, or Budget vs Actual for
      live API data.
    </div>
  )
}
