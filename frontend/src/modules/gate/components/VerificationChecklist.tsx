import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { OutwardChecklistKey } from '../types/gate.types'

export const OUTWARD_CHECKLIST_ITEMS: Array<{ key: OutwardChecklistKey; label: string }> = [
  { key: 'sourceApproved', label: 'Source document approved' },
  { key: 'vehicleMatches', label: 'Vehicle number matches' },
  { key: 'driverVerified', label: 'Driver verified' },
  { key: 'packageCountMatches', label: 'Package count matches' },
  { key: 'materialMatches', label: 'Material description matches' },
  { key: 'documentAvailable', label: 'Invoice or challan available' },
  { key: 'sealRecorded', label: 'Seal recorded' },
  { key: 'securityCheckDone', label: 'Security check completed' },
]

/** Large touch-friendly outward release checklist */
export function VerificationChecklist({
  values,
  onToggle,
  disabled,
}: {
  values: Record<OutwardChecklistKey, boolean>
  onToggle: (key: OutwardChecklistKey, next: boolean) => void
  disabled?: boolean
}) {
  const done = OUTWARD_CHECKLIST_ITEMS.filter((item) => values[item.key]).length
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-erp-text">Verification checklist</h3>
        <span
          className={cn(
            'text-[12px] font-semibold tabular-nums',
            done === OUTWARD_CHECKLIST_ITEMS.length ? 'text-emerald-700' : 'text-erp-muted',
          )}
        >
          {done}/{OUTWARD_CHECKLIST_ITEMS.length} completed
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {OUTWARD_CHECKLIST_ITEMS.map((item) => {
          const checked = values[item.key]
          return (
            <li key={item.key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(item.key, !checked)}
                className={cn(
                  'flex min-h-[44px] w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  checked
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-erp-border bg-white text-erp-text hover:border-erp-primary/50',
                )}
                aria-pressed={checked}
              >
                {checked ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-erp-muted" aria-hidden />
                )}
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
