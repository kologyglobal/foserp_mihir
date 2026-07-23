import {
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { OperationalPageShell } from '../design-system/OperationalPageShell'
import { type PageInsight } from '../design-system/PageInsightsStrip'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import type { MasterCatalogGroupId } from '../../config/mastersSetupCatalog'
import { getMasterGroupById } from '../../config/mastersSetupCatalog'
import { buildMasterBreadcrumbs } from '../../utils/masterNavigation'
import { MasterListCommandBar } from '../../modules/masters/shared/MasterListCommandBar'
import { MasterRegisterFilterBar } from './MasterRegisterFilterBar'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { cn } from '../../utils/cn'
import type { ErpCommandAction } from '../erp/ErpCommandBar'
import { MasterLifecycleDialog } from './MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import type { MaybePromise } from '../../store/storeAction'

interface FilterOption {
  value: string
  label: string
}

interface MasterListShellProps {
  title: string
  description: string
  createLabel: string
  createTo: string
  badge?: string
  masterGroupId?: MasterCatalogGroupId
  breadcrumbs?: { label: string; to?: string }[]
  favoritePath?: string
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  statusFilter?: string
  onStatusFilterChange?: (v: string) => void
  statusOptions?: FilterOption[]
  extraFilters?: ReactNode
  stats?: {
    label: string
    value: number | string
    icon?: LucideIcon
    accent?: 'blue' | 'red' | 'amber' | 'green' | 'purple' | 'slate' | 'cyan' | 'indigo'
    accentClassName?: string
    helper?: string
  }[]
  /** Override default ErpCommandBar */
  commandBar?: ReactNode
  onImport?: () => void
  onExport?: () => void
  extraCommandSecondary?: ErpCommandAction[]
  extraCommandMore?: ErpCommandAction[]
  resultCount?: number
  children: ReactNode
  /** Optional sidebar (usage tips, relationships) */
  sidebar?: ReactNode
}

const STAT_ACCENT_MAP: Record<
  NonNullable<NonNullable<MasterListShellProps['stats']>[number]['accent']>,
  PageInsight['accent']
> = {
  blue: 'blue',
  green: 'green',
  amber: 'amber',
  red: 'red',
  purple: 'blue',
  slate: 'slate',
  cyan: 'blue',
  indigo: 'blue',
}

const GROUP_ACCENT_CLASS: Record<string, string> = {
  blue: 'masters-module-chip-blue',
  green: 'masters-module-chip-green',
  amber: 'masters-module-chip-amber',
  purple: 'masters-module-chip-purple',
  indigo: 'masters-module-chip-indigo',
  cyan: 'masters-module-chip-cyan',
  rose: 'masters-module-chip-rose',
  slate: 'masters-module-chip-slate',
}

export function MasterListShell({
  title,
  description,
  createLabel,
  createTo,
  badge = 'Master Data',
  masterGroupId,
  breadcrumbs,
  favoritePath,
  search,
  onSearchChange,
  searchPlaceholder = 'Search records…',
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  extraFilters,
  stats,
  commandBar,
  onImport,
  onExport,
  extraCommandSecondary,
  extraCommandMore,
  resultCount,
  children,
  sidebar,
}: MasterListShellProps) {
  const [savedView, setSavedView] = useState('All Records')
  const group = masterGroupId ? getMasterGroupById(masterGroupId) : undefined
  const resolvedBreadcrumbs =
    breadcrumbs ?? (masterGroupId ? buildMasterBreadcrumbs(masterGroupId, title) : undefined)

  const insights = useMemo((): PageInsight[] | undefined => {
    if (!stats?.length) return undefined
    return stats.map((s) => ({
      label: s.label,
      value: s.value,
      helper: s.helper,
      accent: STAT_ACCENT_MAP[s.accent ?? 'blue'],
    }))
  }, [stats])

  const filterChips = useMemo(() => {
    const chips: { id: string; label: string }[] = []
    if (statusFilter && statusFilter !== 'all') {
      const label = statusOptions?.find((o) => o.value === statusFilter)?.label ?? statusFilter
      chips.push({ id: 'status', label })
    }
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` })
    return chips
  }, [statusFilter, statusOptions, search])

  function removeChip(id: string) {
    if (id === 'status') onStatusFilterChange?.('all')
    if (id === 'search') onSearchChange('')
  }

  function clearFilters() {
    onSearchChange('')
    onStatusFilterChange?.('all')
  }

  const resolvedCommandBar = commandBar ?? (
    <MasterListCommandBar
      createLabel={createLabel}
      createTo={createTo}
      onImport={onImport}
      onExport={onExport}
      extraSecondary={extraCommandSecondary}
      extraMore={extraCommandMore}
    />
  )

  const GroupIcon = group?.icon

  const registerBar = (
    <MasterRegisterFilterBar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      statusOptions={statusOptions}
      chips={filterChips}
      onRemoveChip={removeChip}
      onClearAll={filterChips.length > 0 ? clearFilters : undefined}
      resultCount={resultCount}
      savedView={savedView}
      onSavedViewChange={setSavedView}
      trailing={extraFilters}
    />
  )

  const tableChild =
    isValidElement(children)
      ? cloneElement(children as ReactElement<{ registerBar?: ReactNode }>, { registerBar })
      : children

  const tablePanel = (
    <EnterpriseRegisterTableShell>
      <div className="masters-register-grid">
        {tableChild}
      </div>
    </EnterpriseRegisterTableShell>
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge={badge}
      title={title}
      description={description}
      breadcrumbs={resolvedBreadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={favoritePath ?? createTo.replace(/\/new$/, '')}
      commandBar={resolvedCommandBar}
      insights={insights}
    >
      <div className="masters-register-page space-y-4">
        {group && GroupIcon ? (
          <div className="masters-inner-context">
            <span className={cn('masters-module-chip', GROUP_ACCENT_CLASS[group.accent])}>
              <GroupIcon className="h-3.5 w-3.5" aria-hidden />
              {group.title}
            </span>
            <span className="masters-inner-context-desc">{group.description}</span>
          </div>
        ) : null}

        {sidebar ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
            <div className="min-w-0">{tablePanel}</div>
            <aside className="masters-context-panel min-w-0">{sidebar}</aside>
          </div>
        ) : (
          tablePanel
        )}
      </div>
    </OperationalPageShell>
  )
}

export function RowActions({
  viewTo,
  editTo,
}: {
  viewTo: string
  editTo?: string
}) {
  const actions: RowActionItem[] = [
    { id: 'view', label: 'View', icon: Eye, to: viewTo },
  ]
  if (editTo) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, to: editTo })
  }

  return <EnterpriseRowActionsMenu actions={actions} />
}

export function CoreMasterRowActions({
  viewTo,
  editTo,
  recordId,
  recordLabel,
  isActive,
  deleteRecord,
  activateRecord,
  deactivateRecord,
}: {
  viewTo: string
  editTo?: string
  recordId: string
  recordLabel: string
  isActive: boolean
  deleteRecord: (id: string) => MaybePromise<void>
  activateRecord: (id: string) => MaybePromise<void>
  deactivateRecord: (id: string) => MaybePromise<void>
}) {
  const lifecycle = useMasterLifecycle({
    delete: deleteRecord,
    activate: activateRecord,
    deactivate: deactivateRecord,
  })

  const actions: RowActionItem[] = [
    { id: 'view', label: 'View', icon: Eye, to: viewTo },
  ]
  if (editTo) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, to: editTo })
  }
  if (isActive) {
    actions.push({
      id: 'deactivate',
      label: 'Deactivate',
      icon: PowerOff,
      onClick: () => lifecycle.open('deactivate', recordId, recordLabel),
    })
  } else {
    actions.push({
      id: 'activate',
      label: 'Activate',
      icon: Power,
      onClick: () => lifecycle.open('activate', recordId, recordLabel),
    })
  }
  actions.push({
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    danger: true,
    separator: true,
    onClick: () => lifecycle.open('delete', recordId, recordLabel),
  })

  return (
    <>
      <EnterpriseRowActionsMenu actions={actions} />
      <MasterLifecycleDialog
        open={Boolean(lifecycle.dialog)}
        action={lifecycle.dialog?.action ?? 'delete'}
        recordLabel={lifecycle.dialog?.label ?? recordLabel}
        error={lifecycle.error}
        pending={lifecycle.pending}
        onConfirm={() => void lifecycle.confirm()}
        onCancel={lifecycle.close}
      />
    </>
  )
}

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export function matchesStatusFilter(
  isActive: boolean,
  filter: string,
): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return isActive
  return !isActive
}

/** @deprecated Use MasterRegisterFilterBar via MasterListShell */
export function LegacyFilterRow() {
  return null
}
