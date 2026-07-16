import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'
import type { Enterprise360StickyField } from './types'

export function Enterprise360StickySummary({
  title,
  fields,
  className,
}: {
  title: string
  fields: Enterprise360StickyField[]
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!fields.length) return null

  return (
    <div className={cn('ent-360-sticky', visible && 'ent-360-sticky--visible', className)} role="complementary">
      <p className="ent-360-sticky__title">{title}</p>
      <div className="ent-360-sticky__grid">
        {fields.map((f) => (
          <div key={f.label} className={cn('ent-360-sticky__field', f.highlight && 'ent-360-sticky__field--highlight')}>
            <span className="ent-360-sticky__label">{f.label}</span>
            <span className="ent-360-sticky__value">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
