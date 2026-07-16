import { cn } from '../../utils/cn'

export function TrafficLight({ status, label }: { status: 'green' | 'amber' | 'red'; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label ?? status}>
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full ring-2 ring-white',
          status === 'green' && 'erp-traffic-green',
          status === 'amber' && 'erp-traffic-amber',
          status === 'red' && 'erp-traffic-red',
        )}
      />
      {label && <span className="text-[11px] font-medium text-erp-muted">{label}</span>}
    </span>
  )
}
