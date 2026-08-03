import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface HrInfoField {
  label: string
  value: ReactNode
}

interface HrInfoSectionProps {
  title: string
  fields: HrInfoField[]
  actions?: ReactNode
  className?: string
}

/** Titled card with a compact 2-column definition list — used across Employee 360 overview tabs. */
export function HrInfoSection({ title, fields, actions, className }: HrInfoSectionProps) {
  return (
    <section className={cn('hr-info-section', className)}>
      <div className="hr-info-section__header">
        <h3 className="hr-info-section__title">{title}</h3>
        {actions}
      </div>
      <dl className="hr-info-section__grid">
        {fields.map((f) => (
          <div key={f.label} className="hr-info-section__row">
            <dt className="hr-info-section__label">{f.label}</dt>
            <dd className="hr-info-section__value">{f.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
