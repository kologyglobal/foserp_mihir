import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getModuleSubNavForPath,
  subNavItemIsActive,
  type ModuleSubNavItem,
} from '@/config/moduleWorkspaceNav'
import { cn } from '@/utils/cn'

/**
 * Paths that already render their own Zoho-style left tree inside page shells.
 * Module rail stays hidden there to avoid a double sidebar.
 */
const NESTED_SHELL_PREFIXES = [
  '/accounting/tax-compliance',
  '/accounting/budgeting',
  '/accounting/period-close',
]

export function pathHasNestedModuleShell(pathname: string): boolean {
  return NESTED_SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function groupItems(items: ModuleSubNavItem[]): { group: string | null; items: ModuleSubNavItem[] }[] {
  const sections: { group: string | null; items: ModuleSubNavItem[] }[] = []
  for (const item of items) {
    const group = item.group?.trim() || null
    const last = sections[sections.length - 1]
    if (last && last.group === group) {
      last.items.push(item)
    } else {
      sections.push({ group, items: [item] })
    }
  }
  return sections
}

/**
 * Zoho-style vertical module submenu — pages under the active module
 * (e.g. Accounting › Dashboard, Chart of Accounts, Payables…).
 */
export function ModuleSubNavRail({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { pathname } = useLocation()
  const moduleSubNav = useMemo(() => getModuleSubNavForPath(pathname), [pathname])

  if (!moduleSubNav || moduleSubNav.items.length <= 1) return null
  if (pathHasNestedModuleShell(pathname)) return null

  const sections = groupItems(moduleSubNav.items)
  const isCollapsed = Boolean(collapsed)

  return (
    <aside
      className={cn(
        'zoho-module-rail',
        isCollapsed && 'zoho-module-rail--collapsed',
      )}
      aria-label={`${moduleSubNav.categoryTitle} menu`}
    >
      <div className="zoho-module-rail__head">
        {!isCollapsed ? (
          <p className="zoho-module-rail__title">{moduleSubNav.categoryTitle}</p>
        ) : (
          <span className="zoho-module-rail__title-mark" aria-hidden>
            {moduleSubNav.categoryTitle.charAt(0)}
          </span>
        )}
        {onToggleCollapsed ? (
          <button
            type="button"
            className="zoho-module-rail__toggle"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? 'Expand module menu' : 'Collapse module menu'}
            title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>

      {!isCollapsed ? (
        <nav className="zoho-module-rail__nav">
          {sections.map((section, sectionIndex) => (
            <RailSection
              key={section.group ?? `ungrouped-${sectionIndex}`}
              group={section.group}
              items={section.items}
              pathname={pathname}
              defaultOpen
            />
          ))}
        </nav>
      ) : (
        <nav className="zoho-module-rail__nav zoho-module-rail__nav--icons">
          {moduleSubNav.items.map((item) => (
            <RailLink key={`${item.path}-${item.label}`} item={item} pathname={pathname} iconOnly />
          ))}
        </nav>
      )}
    </aside>
  )
}

function RailSection({
  group,
  items,
  pathname,
  defaultOpen,
}: {
  group: string | null
  items: ModuleSubNavItem[]
  pathname: string
  defaultOpen?: boolean
}) {
  const anyActive = items.some((item) => subNavItemIsActive(pathname, item))
  const [open, setOpen] = useState(defaultOpen || anyActive)

  if (!group) {
    return (
      <div className="zoho-module-rail__section">
        {items.map((item) => (
          <RailLink key={`${item.path}-${item.label}`} item={item} pathname={pathname} />
        ))}
      </div>
    )
  }

  return (
    <div className="zoho-module-rail__section">
      <button
        type="button"
        className="zoho-module-rail__group"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{group}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 transition-transform', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {open ? (
        <div className="zoho-module-rail__group-items">
          {items.map((item) => (
            <RailLink key={`${item.path}-${item.label}`} item={item} pathname={pathname} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RailLink({
  item,
  pathname,
  iconOnly,
}: {
  item: ModuleSubNavItem
  pathname: string
  iconOnly?: boolean
}) {
  const active = subNavItemIsActive(pathname, item)
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end={Boolean(item.end)}
      title={item.label}
      className={cn(
        'zoho-module-rail__link',
        iconOnly && 'zoho-module-rail__link--icon-only',
        active && 'zoho-module-rail__link--active',
      )}
    >
      {Icon ? <Icon className="zoho-module-rail__icon" aria-hidden /> : null}
      {!iconOnly ? <span className="zoho-module-rail__label">{item.label}</span> : null}
    </NavLink>
  )
}
