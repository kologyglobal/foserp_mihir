import { TabStrip, type TabItem } from '../../ui/TabStrip'
import type { ErpCardTab } from './types'
import { cn } from '../../../utils/cn'

interface ErpCardTabsProps {
  tabs: ErpCardTab[]
  active: string
  onChange: (tabId: string) => void
  className?: string
}

/** Business Central–style tab navigation for card forms */
export function ErpCardTabs({ tabs, active, onChange, className }: ErpCardTabsProps) {
  const visible = tabs.filter((t) => !t.hidden)
  if (visible.length === 0) return null

  const items: TabItem[] = visible.map(({ id, label, icon, count }) => ({
    id,
    label,
    icon,
    count,
  }))

  return (
    <div className={cn('erp-card-form-tabs', className)}>
      <TabStrip tabs={items} active={active} onChange={onChange} />
    </div>
  )
}
