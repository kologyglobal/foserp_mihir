import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function FioriSection({
  title,
  subtitle,
  children,
  className,
  as: Tag = 'section',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
}) {
  return (
    <Tag className={cn('fiori-section', className)}>
      <div className="fiori-section__header">
        <div>
          <h2 className="fiori-section__title">{title}</h2>
          {subtitle ? <p className="fiori-section__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Tag>
  )
}
