import { FactBox, type FactBoxField } from '@/components/design-system/FactBox'

interface HrSmartContextProps {
  title?: string
  fields: FactBoxField[]
  className?: string
}

/** Right-rail factbox for Employee 360 — key facts at a glance while scrolling tab content. */
export function HrSmartContext({ title = 'Key Facts', fields, className }: HrSmartContextProps) {
  return <FactBox title={title} fields={fields} className={className} />
}
