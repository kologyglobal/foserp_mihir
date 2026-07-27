import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  Copy,
  LayoutDashboard,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { Select } from '../../components/forms/Inputs'
import { SaaSPageShell } from '../../components/saas/SaaSPageShell'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { notify } from '../../store/toastStore'
import { useExecutiveDashboardStore } from '../../store/executiveDashboardStore'
import type { DashboardTemplateKey, WidgetModule, WidgetVisualization } from '../../types/executiveDashboard'
import { DASHBOARD_TEMPLATE_OPTIONS, getWidgetDefinition } from './executiveWidgetCatalog'
import { ExecutiveWidgetCard } from './ExecutiveWidgetCard'
import { cn } from '../../utils/cn'
import './ceo-dashboard.css'

const MODULES: Array<WidgetModule | 'ALL'> = [
  'ALL', 'CRM', 'SALES', 'PURCHASE', 'INVENTORY', 'MANUFACTURING', 'QUALITY', 'DISPATCH', 'FINANCE', 'EXECUTIVE',
]

export function CeoDashboardPage() {
  const hydrate = useExecutiveDashboardStore((s) => s.hydrate)
  const dashboards = useExecutiveDashboardStore((s) => s.dashboards)
  const catalog = useExecutiveDashboardStore((s) => s.catalog)
  const editing = useExecutiveDashboardStore((s) => s.editing)
  const setEditing = useExecutiveDashboardStore((s) => s.setEditing)
  const globalFilters = useExecutiveDashboardStore((s) => s.globalFilters)
  const setGlobalFilters = useExecutiveDashboardStore((s) => s.setGlobalFilters)
  const setActiveDashboard = useExecutiveDashboardStore((s) => s.setActiveDashboard)
  const createDashboard = useExecutiveDashboardStore((s) => s.createDashboard)
  const renameDashboard = useExecutiveDashboardStore((s) => s.renameDashboard)
  const duplicateDashboard = useExecutiveDashboardStore((s) => s.duplicateDashboard)
  const setDefault = useExecutiveDashboardStore((s) => s.setDefault)
  const deleteDashboard = useExecutiveDashboardStore((s) => s.deleteDashboard)
  const saveActiveLayout = useExecutiveDashboardStore((s) => s.saveActiveLayout)
  const addWidget = useExecutiveDashboardStore((s) => s.addWidget)
  const removeWidget = useExecutiveDashboardStore((s) => s.removeWidget)
  const updateWidgetLayout = useExecutiveDashboardStore((s) => s.updateWidgetLayout)
  const updateWidgetConfig = useExecutiveDashboardStore((s) => s.updateWidgetConfig)
  const loading = useExecutiveDashboardStore((s) => s.loading)
  const error = useExecutiveDashboardStore((s) => s.error)
  const getActive = useExecutiveDashboardStore((s) => s.getActive)

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [configWidgetId, setConfigWidgetId] = useState<string | null>(null)
  const [gridWidth, setGridWidth] = useState(1200)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const el = document.getElementById('ceo-dash-grid-host')
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setGridWidth(Math.floor(w))
    })
    ro.observe(el)
    setGridWidth(el.clientWidth || 1200)
    return () => ro.disconnect()
  }, [loading, editing])

  const active = getActive()
  const widgets = active?.widgets ?? []

  const layout: Layout[] = useMemo(
    () => widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 })),
    [widgets],
  )

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      if (!editing) return
      updateWidgetLayout(next.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })))
    },
    [editing, updateWidgetLayout],
  )

  async function handleSave() {
    if (!active) return
    try {
      await saveActiveLayout(active.widgets)
      notify.success('Dashboard saved')
    } catch {
      notify.error('Could not save dashboard')
    }
  }

  async function handleCreate(name: string, template: DashboardTemplateKey) {
    const id = await createDashboard(name, template)
    setCreateOpen(false)
    if (id) notify.success('Dashboard created')
  }

  const configWidget = widgets.find((w) => w.id === configWidgetId)

  return (
    <SaaSPageShell>
      <div className="ceo-dash">
        <header className="ceo-dash__hero">
          <div>
            <p className="ceo-dash__eyebrow">Executive</p>
            <h1 className="ceo-dash__title">{active?.name ?? 'CEO Dashboard'}</h1>
            <p className="ceo-dash__subtitle">
              Plug-and-play executive cockpit — pick widgets from any ERP module, arrange, and save.
            </p>
          </div>
          <div className="ceo-dash__hero-actions">
            <Select
              value={active?.id ?? ''}
              onChange={(e) => setActiveDashboard(e.target.value)}
              aria-label="Select dashboard"
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.isDefault ? ' ★' : ''}
                </option>
              ))}
            </Select>
            <Select
              value={globalFilters.datePreset}
              onChange={(e) => setGlobalFilters({ datePreset: e.target.value as typeof globalFilters.datePreset })}
              aria-label="Date range"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_fy">This FY</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
        </header>

        <ErpCommandBar
          sticky={false}
          primaryAction={
            editing
              ? { id: 'save', label: 'Save Dashboard', icon: Save, onClick: () => void handleSave() }
              : { id: 'customize', label: 'Customize Dashboard', icon: Pencil, onClick: () => setEditing(true) }
          }
          secondaryActions={[
            ...(editing
              ? [
                  { id: 'add', label: 'Add Widget', icon: Plus, onClick: () => setLibraryOpen(true) },
                  { id: 'cancel', label: 'Done', icon: X, onClick: () => setEditing(false) },
                ]
              : [
                  { id: 'new', label: 'New Dashboard', icon: Plus, onClick: () => setCreateOpen(true) },
                ]),
            {
              id: 'dup',
              label: 'Duplicate',
              icon: Copy,
              onClick: () => active && void duplicateDashboard(active.id).then(() => notify.success('Duplicated')),
            },
            {
              id: 'default',
              label: 'Set Default',
              icon: Star,
              onClick: () => active && void setDefault(active.id).then(() => notify.success('Default set')),
            },
          ]}
          moreActions={[
            {
              id: 'rename',
              label: 'Rename',
              onClick: () => {
                if (!active) return
                const name = window.prompt('Dashboard name', active.name)
                if (name?.trim()) void renameDashboard(active.id, name.trim())
              },
            },
            {
              id: 'reset',
              label: 'Reset to CEO Overview',
              icon: RotateCcw,
              onClick: () => {
                if (!active) return
                void createDashboard(`${active.name} Reset`, 'ceo_overview')
              },
            },
            {
              id: 'delete',
              label: 'Delete Dashboard',
              icon: Trash2,
              onClick: () => {
                if (!active) return
                if (window.confirm(`Delete “${active.name}”?`)) void deleteDashboard(active.id)
              },
            },
          ]}
        />

        {error ? <p className="ceo-dash__error">{error}</p> : null}
        {loading ? <p className="ceo-dash__muted">Loading dashboard…</p> : null}

        {!loading && active && widgets.length === 0 ? (
          <div className="ceo-dash__empty">
            <LayoutDashboard className="h-8 w-8 opacity-40" />
            <p>No widgets yet</p>
            <ErpButton variant="primary" icon={Plus} onClick={() => { setEditing(true); setLibraryOpen(true) }}>
              Add Widget
            </ErpButton>
          </div>
        ) : null}

        <div id="ceo-dash-grid-host" className="ceo-dash__grid-host">
          {active && widgets.length > 0 ? (
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={56}
              width={gridWidth}
              isDraggable={editing}
              isResizable={editing}
              compactType="vertical"
              onLayoutChange={onLayoutChange}
              draggableHandle=".ceo-widget__header"
            >
              {widgets.map((w) => (
                <div key={w.id} className="ceo-dash__grid-item">
                  <ExecutiveWidgetCard
                    widget={w}
                    globalFilters={globalFilters}
                    editing={editing}
                    onRemove={() => removeWidget(w.id)}
                    onConfigure={() => setConfigWidgetId(w.id)}
                  />
                </div>
              ))}
            </GridLayout>
          ) : null}
        </div>
      </div>

      {libraryOpen ? (
        <WidgetLibraryDrawer
          catalog={catalog}
          onClose={() => setLibraryOpen(false)}
          onAdd={(key) => {
            addWidget(key)
            notify.success('Widget added')
          }}
        />
      ) : null}

      {createOpen ? (
        <CreateDashboardDialog
          onClose={() => setCreateOpen(false)}
          onCreate={(name, template) => void handleCreate(name, template)}
        />
      ) : null}

      {configWidget ? (
        <WidgetConfigDialog
          visualization={configWidget.visualization}
          options={getWidgetDefinition(configWidget.widgetKey)?.supportedVisualizations ?? ['KPI']}
          onClose={() => setConfigWidgetId(null)}
          onSave={(visualization) => {
            updateWidgetConfig(configWidget.id, { visualization })
            setConfigWidgetId(null)
          }}
        />
      ) : null}
    </SaaSPageShell>
  )
}

function WidgetLibraryDrawer({
  catalog,
  onClose,
  onAdd,
}: {
  catalog: ReturnType<typeof useExecutiveDashboardStore.getState>['catalog']
  onClose: () => void
  onAdd: (key: string) => void
}) {
  const [q, setQ] = useState('')
  const [module, setModule] = useState<WidgetModule | 'ALL'>('ALL')
  const filtered = catalog.filter((w) => {
    if (module !== 'ALL' && w.module !== module) return false
    if (!q.trim()) return true
    const hay = `${w.name} ${w.description ?? ''} ${w.key}`.toLowerCase()
    return hay.includes(q.trim().toLowerCase())
  })

  return (
    <div className="ceo-drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="ceo-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Widget library">
        <div className="ceo-drawer__head">
          <div>
            <h2 className="text-base font-semibold">Widget Library</h2>
            <p className="text-xs text-[var(--saas-muted)]">Pick KPIs and reports from any ERP module</p>
          </div>
          <button type="button" className="ceo-widget__icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="ceo-drawer__search">
          <Search className="h-4 w-4 opacity-50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widgets…" />
        </div>
        <div className="ceo-drawer__tabs">
          {MODULES.map((m) => (
            <button
              key={m}
              type="button"
              className={cn('ceo-drawer__tab', module === m && 'ceo-drawer__tab--active')}
              onClick={() => setModule(m)}
            >
              {m === 'ALL' ? 'All' : m.charAt(0) + m.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <ul className="ceo-drawer__list">
          {filtered.map((w) => (
            <li key={w.key}>
              <button type="button" className="ceo-drawer__item" onClick={() => onAdd(w.key)}>
                <span>
                  <span className="block text-sm font-semibold">{w.name}</span>
                  <span className="block text-[11px] text-[var(--saas-muted)]">{w.module} · {w.description ?? w.key}</span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-[var(--saas-primary)]" />
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="px-3 py-8 text-center text-sm text-[var(--saas-muted)]">No widgets match</li> : null}
        </ul>
      </aside>
    </div>
  )
}

function CreateDashboardDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, template: DashboardTemplateKey) => void
}) {
  const [name, setName] = useState('My Dashboard')
  const [template, setTemplate] = useState<DashboardTemplateKey>('ceo_overview')
  return (
    <div className="ceo-drawer-backdrop" onClick={onClose} role="presentation">
      <div className="ceo-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2 className="text-base font-semibold">New dashboard</h2>
        <label className="mt-4 block text-xs font-medium text-[var(--saas-muted)]">Name</label>
        <input className="ceo-input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="mt-3 block text-xs font-medium text-[var(--saas-muted)]">Template</label>
        <Select value={template} onChange={(e) => setTemplate(e.target.value as DashboardTemplateKey)}>
          {DASHBOARD_TEMPLATE_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </Select>
        <p className="mt-2 text-[11px] text-[var(--saas-muted)]">
          {DASHBOARD_TEMPLATE_OPTIONS.find((t) => t.key === template)?.description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <ErpButton variant="ghost" onClick={onClose}>Cancel</ErpButton>
          <ErpButton variant="primary" onClick={() => onCreate(name.trim() || 'Dashboard', template)}>Create</ErpButton>
        </div>
      </div>
    </div>
  )
}

function WidgetConfigDialog({
  visualization,
  options,
  onClose,
  onSave,
}: {
  visualization: WidgetVisualization
  options: WidgetVisualization[]
  onClose: () => void
  onSave: (v: WidgetVisualization) => void
}) {
  const [viz, setViz] = useState(visualization)
  return (
    <div className="ceo-drawer-backdrop" onClick={onClose} role="presentation">
      <div className="ceo-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2 className="text-base font-semibold">Configure widget</h2>
        <label className="mt-4 block text-xs font-medium text-[var(--saas-muted)]">Visualization</label>
        <Select value={viz} onChange={(e) => setViz(e.target.value as WidgetVisualization)}>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
        <div className="mt-5 flex justify-end gap-2">
          <ErpButton variant="ghost" onClick={onClose}>Cancel</ErpButton>
          <ErpButton variant="primary" onClick={() => onSave(viz)}>Apply</ErpButton>
        </div>
      </div>
    </div>
  )
}
