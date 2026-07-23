import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { durationSince, minutesBetween } from '../utils/gateStatus'

/** Live duration since entry — ticks every minute while the page is open. */
export function InsideDuration({
  from,
  to,
  warnAfterMinutes,
  className,
}: {
  from?: string | null
  to?: string | null
  /** Highlight in amber/red once the open duration exceeds this many minutes */
  warnAfterMinutes?: number
  className?: string
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!from || to) return
    const timer = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(timer)
  }, [from, to])

  if (!from) return <span className={cn('text-erp-muted', className)}>—</span>
  const minutes = minutesBetween(from, to)
  const over = warnAfterMinutes != null && !to && minutes > warnAfterMinutes
  return (
    <span className={cn('tabular-nums', over ? 'font-semibold text-amber-700' : 'text-erp-text', className)}>
      {durationSince(from, to)}
    </span>
  )
}

/** Prominent overdue flag for returnable passes and expiring contractor cards */
export function OverdueIndicator({ label = 'Overdue', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200',
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
