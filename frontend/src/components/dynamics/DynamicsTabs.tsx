import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

export type DynamicsTabItem = {
  label: string
  path: string
  /** When set, tab is nested under a dropdown labeled with this group name */
  group?: string
}

type TabEntry =
  | { kind: 'link'; item: DynamicsTabItem }
  | { kind: 'group'; label: string; items: DynamicsTabItem[]; active: boolean }

function buildTabEntries(items: DynamicsTabItem[], activePath: string): TabEntry[] {
  const grouped = new Map<string, DynamicsTabItem[]>()
  const result: TabEntry[] = []
  const seenGroups = new Set<string>()

  for (const item of items) {
    if (item.group) {
      if (!grouped.has(item.group)) grouped.set(item.group, [])
      grouped.get(item.group)!.push(item)
    }
  }

  for (const item of items) {
    if (!item.group) {
      result.push({ kind: 'link', item })
      continue
    }
    if (seenGroups.has(item.group)) continue
    seenGroups.add(item.group)
    const groupItems = grouped.get(item.group) ?? []
    result.push({
      kind: 'group',
      label: item.group,
      items: groupItems,
      active: groupItems.some((g) => g.path === activePath),
    })
  }
  return result
}

function GroupDropdown({
  label,
  items,
  activePath,
  onChange,
  active,
}: {
  label: string
  items: DynamicsTabItem[]
  activePath: string
  onChange: (path: string) => void
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeChild = items.find((i) => i.path === activePath)

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(176, rect.width)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left,
      minWidth: width,
      zIndex: 10050,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReposition = () => {
      updatePosition()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <div className="dyn-tab-group">
      <button
        ref={triggerRef}
        type="button"
        role="tab"
        aria-selected={active}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn('dyn-tab dyn-tab-group-trigger', active && 'dyn-tab-active')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">
          {activeChild ? `${label} · ${activeChild.label}` : label}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition', open && 'rotate-180')} />
      </button>
      {open
        ? createPortal(
            <div ref={menuRef} className="dyn-tab-group-menu" role="menu" style={menuStyle}>
              {items.map((item) => (
                <button
                  key={`${item.path}-${item.label}`}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'dyn-tab-group-item',
                    item.path === activePath && 'dyn-tab-group-item-active',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(item.path)
                    setOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function DynamicsTabs({
  items,
  activePath,
  onChange,
}: {
  items: DynamicsTabItem[]
  activePath: string
  onChange: (path: string) => void
}) {
  const entries = useMemo(() => buildTabEntries(items, activePath), [items, activePath])

  return (
    <div className="dyn-tabs" role="tablist">
      {entries.map((entry) => {
        if (entry.kind === 'link') {
          return (
            <button
              key={`${entry.item.path}-${entry.item.label}`}
              type="button"
              role="tab"
              aria-selected={activePath === entry.item.path}
              className={cn('dyn-tab', activePath === entry.item.path && 'dyn-tab-active')}
              onClick={() => onChange(entry.item.path)}
            >
              {entry.item.label}
            </button>
          )
        }
        return (
          <GroupDropdown
            key={`group-${entry.label}`}
            label={entry.label}
            items={entry.items}
            activePath={activePath}
            onChange={onChange}
            active={entry.active}
          />
        )
      })}
    </div>
  )
}
