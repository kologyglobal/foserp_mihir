import type { LucideIcon } from 'lucide-react'
import { PremiumKpiCard } from '../premium/PremiumKpiCard'
import type { PremiumAccent } from '../premium/types'
import { TrafficLight } from './TrafficLight'

type Accent = PremiumAccent

interface KPIWidgetProps {
  label: string
  value: string | number
  helper?: string
  icon?: LucideIcon
  accent?: Accent
  traffic?: 'green' | 'amber' | 'red'
  trend?: string
  onClick?: () => void
  className?: string
  href?: string
  lastUpdated?: string
}

/** @deprecated Prefer PremiumKpiCard — retained for workspace compatibility */
export function KPIWidget({
  label,
  value,
  helper,
  icon,
  accent = 'blue',
  traffic,
  trend,
  onClick,
  className,
  href,
  lastUpdated,
}: KPIWidgetProps) {
  const trendUp = traffic !== 'red'
  return (
    <div className={className}>
      <PremiumKpiCard
        label={label}
        value={value}
        helper={helper}
        icon={icon}
        accent={accent}
        trend={trend ?? (traffic ? (traffic === 'green' ? 'Healthy' : traffic === 'amber' ? 'Attention' : 'Critical') : undefined)}
        trendUp={trendUp}
        onClick={onClick}
        href={href}
        lastUpdated={lastUpdated}
      />
      {traffic && (
        <div className="sr-only">
          <TrafficLight status={traffic} />
        </div>
      )}
    </div>
  )
}
