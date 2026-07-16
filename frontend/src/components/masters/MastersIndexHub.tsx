import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LayoutGrid, Pin, Search, Table2 } from 'lucide-react'
import type { MasterSetupGroup } from '../../config/mastersSetupCatalog'
import {
  MASTER_INDEX_CATEGORY_ALL,
  MASTER_INDEX_CATEGORY_PINNED,
  type MasterIndexCategoryFilter,
  type MasterIndexRow,
  masterIndexCategoryCounts,
} from '../../utils/masterIndexSearch'
import { resolveMasterLinkIconByPath } from '../../utils/masterLinkIcons'
import { cn } from '../../utils/cn'

const ACCENT_DOT: Record<string, string> = {
  blue: 'masters-index-dot-blue',
  green: 'masters-index-dot-green',
  amber: 'masters-index-dot-amber',
  purple: 'masters-index-dot-purple',
  indigo: 'masters-index-dot-indigo',
  cyan: 'masters-index-dot-cyan',
  rose: 'masters-index-dot-rose',
  slate: 'masters-index-dot-slate',
}

export function MastersIndexSidebar({
  groups,
  rows,
  pinnedPaths,
  activeCategory,
  onCategoryChange,
}: {
  groups: MasterSetupGroup[]
  rows: MasterIndexRow[]
  pinnedPaths: string[]
  activeCategory: MasterIndexCategoryFilter
  onCategoryChange: (id: MasterIndexCategoryFilter) => void
}) {
  const counts = useMemo(() => masterIndexCategoryCounts(rows, pinnedPaths), [rows, pinnedPaths])

  const navItem = (id: MasterIndexCategoryFilter, label: string, count: number, icon?: React.ReactNode) => (
    <button
      key={id}
      type="button"
      className={cn('masters-index-nav-item', activeCategory === id && 'masters-index-nav-item-active')}
      onClick={() => onCategoryChange(id)}
    >
      {icon ? <span className="masters-index-nav-icon">{icon}</span> : null}
      <span className="masters-index-nav-label">{label}</span>
      <span className="masters-index-nav-count">{count}</span>
    </button>
  )

  return (
    <nav className="masters-index-sidebar" aria-label="Master categories">
      <div className="masters-index-sidebar-section">
        <p className="masters-index-sidebar-heading">Browse</p>
        {navItem(MASTER_INDEX_CATEGORY_ALL, 'All registers', counts.get(MASTER_INDEX_CATEGORY_ALL) ?? 0, <LayoutGrid className="h-4 w-4" aria-hidden />)}
        {navItem(MASTER_INDEX_CATEGORY_PINNED, 'Pinned', counts.get(MASTER_INDEX_CATEGORY_PINNED) ?? 0, <Pin className="h-4 w-4" aria-hidden />)}
      </div>
      <div className="masters-index-sidebar-section">
        <p className="masters-index-sidebar-heading">Categories</p>
        {groups.map((group) => {
          const count = counts.get(group.id) ?? 0
          if (count === 0) return null
          const GroupIcon = group.icon
          return navItem(
            group.id,
            group.title,
            count,
            <GroupIcon className="h-4 w-4" aria-hidden />,
          )
        })}
      </div>
    </nav>
  )
}

export function MastersIndexTable({
  rows,
  onTogglePin,
  pinnedPaths,
  compact,
}: {
  rows: MasterIndexRow[]
  pinnedPaths: string[]
  onTogglePin: (path: string) => void
  compact?: boolean
}) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return (
      <div className="masters-index-empty">
        <Search className="h-8 w-8 text-erp-muted" aria-hidden />
        <p>No masters match your filters.</p>
      </div>
    )
  }

  return (
    <div className={cn('masters-index-table-wrap', compact && 'masters-index-table-wrap-compact')}>
      <table className="masters-index-table">
        <thead>
          <tr>
            <th className="masters-index-th-pin" aria-label="Pin" />
            <th>Master register</th>
            <th>Category</th>
            {!compact ? <th>Description</th> : null}
            <th className="masters-index-th-num">Records</th>
            <th className="masters-index-th-action" aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pinned = pinnedPaths.includes(row.path)
            const Icon = resolveMasterLinkIconByPath(row.path, row.slug)
            return (
              <tr
                key={row.id}
                className="masters-index-row"
                tabIndex={0}
                role="link"
                onClick={() => navigate(row.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(row.path)
                }}
              >
                <td className="masters-index-td-pin" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={cn('masters-index-pin', pinned && 'masters-index-pin-active')}
                    aria-label={pinned ? 'Unpin' : 'Pin master'}
                    onClick={() => onTogglePin(row.path)}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                </td>
                <td>
                  <div className="masters-index-link">
                    <span className={cn('masters-index-row-icon', ACCENT_DOT[row.groupAccent])}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="masters-index-link-text">
                      <span className="masters-index-link-label">{row.label}</span>
                      {row.status === 'placeholder' ? (
                        <span className="masters-index-badge-planned">Planned</span>
                      ) : null}
                      {row.subsection ? (
                        <span className="masters-index-link-meta">{row.subsection}</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={cn('masters-index-category-pill', ACCENT_DOT[row.groupAccent])}>{row.groupTitle}</span>
                </td>
                {!compact ? (
                  <td className="masters-index-desc">{row.description || '—'}</td>
                ) : null}
                <td className="masters-index-td-num">
                  {typeof row.count === 'number' ? (
                    <span className="masters-index-count">{row.count.toLocaleString()}</span>
                  ) : (
                    <span className="masters-index-count-muted">—</span>
                  )}
                </td>
                <td className="masters-index-td-action">
                  <span className="masters-index-open" aria-hidden>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MastersIndexGroupedSections({
  sections,
  pinnedPaths,
  onTogglePin,
}: {
  sections: { groupTitle: string; groupId: string; rows: MasterIndexRow[] }[]
  pinnedPaths: string[]
  onTogglePin: (path: string) => void
}) {
  return (
    <div className="masters-index-grouped">
      {sections.map((section) => (
        <section key={section.groupId} id={`masters-cat-${section.groupId}`} className="masters-index-group">
          <header className="masters-index-group-header">
            <h2 className="masters-index-group-title">{section.groupTitle}</h2>
            <span className="masters-index-group-count">{section.rows.length} registers</span>
          </header>
          <MastersIndexTable
            rows={section.rows}
            pinnedPaths={pinnedPaths}
            onTogglePin={onTogglePin}
            compact
          />
        </section>
      ))}
    </div>
  )
}

export type MastersIndexViewMode = 'index' | 'grid'

export function MastersIndexViewToggle({
  mode,
  onChange,
}: {
  mode: MastersIndexViewMode
  onChange: (mode: MastersIndexViewMode) => void
}) {
  return (
    <div className="masters-index-view-toggle" role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'index'}
        className={cn('masters-index-view-btn', mode === 'index' && 'masters-index-view-btn-active')}
        onClick={() => onChange('index')}
      >
        <Table2 className="h-4 w-4" aria-hidden />
        Index
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'grid'}
        className={cn('masters-index-view-btn', mode === 'grid' && 'masters-index-view-btn-active')}
        onClick={() => onChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        Tiles
      </button>
    </div>
  )
}

export function MastersIndexChip({
  label,
  href,
  sublabel,
}: {
  label: string
  href: string
  sublabel?: string
}) {
  return (
    <Link to={href} className="masters-index-chip">
      <span className="masters-index-chip-label">{label}</span>
      {sublabel ? <span className="masters-index-chip-sub">{sublabel}</span> : null}
    </Link>
  )
}
