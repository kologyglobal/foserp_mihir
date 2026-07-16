import { KpiCard } from '../list-page/KpiCard'
import type { Enterprise360KpiItem } from './types'

export function Enterprise360KpiStrip({ items }: { items: Enterprise360KpiItem[] }) {
  if (!items.length) return null

  return (
    <div className="ent-360-kpi-strip" role="list" aria-label="Business KPIs">
      {items.map((item) => (
        <KpiCard
          key={item.id}
          item={{
            id: item.id,
            label: item.label,
            value: item.value,
            context: item.hint,
            accent: item.accent,
            onClick: item.onClick,
            href: item.href,
          }}
        />
      ))}
    </div>
  )
}
