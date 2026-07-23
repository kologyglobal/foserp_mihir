import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { GateVehicleStatus } from '../types/gate.types'

const STEPS: Array<{ id: string; label: string; matches: GateVehicleStatus[] }> = [
  { id: 'expected', label: 'Expected', matches: ['expected'] },
  { id: 'at_gate', label: 'At Gate', matches: ['arrived', 'waiting'] },
  { id: 'inside', label: 'Inside', matches: ['allowed_inside'] },
  { id: 'load', label: 'Loading / Unloading', matches: ['loading', 'unloading'] },
  { id: 'ready', label: 'Ready for Exit', matches: ['ready_exit'] },
  { id: 'exited', label: 'Exited', matches: ['exited'] },
]

/** Progress tracker: Expected → At Gate → Inside → Loading/Unloading → Ready → Exited */
export function VehicleStatusTracker({ status }: { status: GateVehicleStatus }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
        This vehicle entry was {status === 'rejected' ? 'rejected' : 'cancelled'} — the lifecycle tracker does not apply.
      </p>
    )
  }
  const activeIndex = STEPS.findIndex((step) => step.matches.includes(status))
  return (
    <ol className="flex flex-wrap items-center gap-y-2 overflow-x-auto">
      {STEPS.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={step.id} className="flex items-center">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                done && 'bg-emerald-50 text-emerald-700',
                active && 'bg-erp-primary text-white',
                !done && !active && 'bg-erp-surface-alt text-erp-muted',
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : null}
              {step.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className={cn('mx-1.5 h-px w-4 sm:w-6', i < activeIndex ? 'bg-emerald-400' : 'bg-erp-border')} aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
