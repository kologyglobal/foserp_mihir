import { cn } from '../../utils/cn'

export function DynamicsTabs({
  items,
  activePath,
  onChange,
}: {
  items: { label: string; path: string }[]
  activePath: string
  onChange: (path: string) => void
}) {
  return (
    <div className="dyn-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={`${item.path}-${item.label}`}
          type="button"
          role="tab"
          aria-selected={activePath === item.path}
          className={cn('dyn-tab', activePath === item.path && 'dyn-tab-active')}
          onClick={() => onChange(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
