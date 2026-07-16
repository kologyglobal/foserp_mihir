import { cn } from '../../utils/cn'
import { EnterpriseKpiCard } from '../../design-system/enterprise/EnterpriseKpiCard'
import { dynamicsToneToAccent } from '../../design-system/enterprise/enterpriseKpiUtils'
import type { EnterpriseKpiItem } from '../../design-system/enterprise/enterpriseKpiTypes'

export type DynamicsKpiTone = 'primary' | 'success' | 'warning' | 'critical' | 'neutral'

export function DynamicsKpiTile({
  label,
  value,
  helper,
  context,
  href,
  tone = 'primary',
  onClick,
  active,
  trend,
  sparkline,
  icon,
  updatedAt,
  id,
}: {
  label: string
  value: string | number
  helper?: string
  context?: string
  href?: string
  tone?: DynamicsKpiTone
  onClick?: () => void
  active?: boolean
  trend?: EnterpriseKpiItem['trend']
  sparkline?: number[]
  icon?: EnterpriseKpiItem['icon']
  updatedAt?: EnterpriseKpiItem['updatedAt']
  id?: string
}) {
  const item: EnterpriseKpiItem = {
    id: id ?? label,
    label,
    value,
    helper,
    context,
    href,
    onClick,
    active,
    trend,
    sparkline,
    icon,
    updatedAt,
    accent: dynamicsToneToAccent(tone),
  }

  return <EnterpriseKpiCard item={item} />
}

export function DynamicsKpiRow({
  children,
  columns,
  className,
}: {
  children: React.ReactNode
  columns?: number
  className?: string
}) {
  return (
    <div
      className={cn('ent-kpi-strip', className)}
      style={columns ? ({ '--ent-kpi-columns': columns } as React.CSSProperties) : undefined}
      role="group"
      aria-label="Summary metrics"
    >
      {children}
    </div>
  )
}

export function dynamicsKpiItem(props: {
  id?: string
  label: string
  value: string | number
  helper?: string
  context?: string
  href?: string
  tone?: DynamicsKpiTone
  onClick?: () => void
  active?: boolean
  trend?: EnterpriseKpiItem['trend']
  sparkline?: number[]
  icon?: EnterpriseKpiItem['icon']
  updatedAt?: EnterpriseKpiItem['updatedAt']
}): EnterpriseKpiItem {
  return {
    id: props.id ?? props.label,
    label: props.label,
    value: props.value,
    helper: props.helper,
    context: props.context,
    href: props.href,
    onClick: props.onClick,
    active: props.active,
    trend: props.trend,
    sparkline: props.sparkline,
    icon: props.icon,
    updatedAt: props.updatedAt,
    accent: dynamicsToneToAccent(props.tone),
  }
}
