import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Trash2, Copy, ChevronLeft, ChevronRight,
  Columns3, Printer, Upload, Download, FileSpreadsheet,
} from 'lucide-react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { EnterpriseRegisterTableShell } from '../../../design-system/list-page/EnterpriseRegisterTableShell'
import { CrmFilterDrawer } from '../../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '../../../components/crm/CrmListFilterBar'
import { ErpDataGrid } from '../../../components/erp/ErpDataGrid'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '../../../components/forms/Inputs'
import type { CrmFilterField } from '../../../types/crmListFilters'
import {
  ErpCardSection,
  ErpFormStatusStrip,
} from '../../../components/erp/card-form'
import { ErpFormShell } from '../../../components/erp/ErpFormShell'
import { ErpButton, ErpButtonGroup } from '../../../components/erp/ErpButton'
import { useCrmFilterDrawer } from '../../../hooks/useCrmFilterDrawer'
import { ColorPickerField, ColorSwatch, normalizeHexColor } from '../../../components/forms/ColorPickerField'
import { ErpRichTextEditor, ErpRichTextRead } from '../../../components/forms/ErpRichTextEditor'
import { formatMasterMultiSelectValue, MasterMultiSelectField } from '../../../components/forms/MasterMultiSelectField'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { TableLink } from '../../../components/ui/AppLink'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '../../../components/masters/MasterLayouts'
import {
  CRM_LINKED_MASTERS,
  getCrmLinkedMaster,
} from '../../../config/crmMastersCatalog'
import {
  type MasterRegisterScope,
  useMasterRegisterScope,
} from '../../../utils/masterRegisterScope'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import type { CrmMasterEntry, CrmMasterFieldDef, CrmMasterKind } from '../../../types/crmMasters'
import {
  countMasterUsage,
  exportMastersCsv,
  exportMastersExcelTsv,
  getMasterUsageLinks,
  printMasterTable,
  crmMasterBasicExtraFields,
  crmMasterConfigurationFields,
  crmMasterShowsNotes,
  crmMasterShowsDescription,
  crmMasterBasicSectionLabel,
  crmMasterConfigurationSectionLabel,
} from '../../../utils/crmMasterUtils'
import { crmBreadcrumbs } from '../../../utils/crmNavigation'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import { CrmMasterContextPanel } from '@/components/crm/masters/CrmMasterContextPanel'
import { CrmMasterImportDialog } from '../../../components/crm/CrmMasterImportDialog'
import { cn } from '../../../utils/cn'
import { downloadCrmMasterImportTemplate } from '../../../utils/crmMasterImport'
import { EnterpriseIdCell, EnterpriseNumericCell, EnterpriseRowActionsMenu, entNumericMeta } from '../../../design-system/enterprise'
import { buildCrmMasterRowActions } from './crmMasterRowActions'
import { buildMasterAuditListColumns } from '../../../components/masters/MasterAuditListColumns'
import { useMasterCodeSeries } from '../../../hooks/useMasterCodeSeries'
import { crmKindToEntityType, MASTER_CODE_HELPER_TEXT } from '../../../config/masterCodeSeriesConfig'
import {
  resolveCrmMasterWrite,
  resolveCrmMasterDelete,
  resolveCrmMasterActivate,
  resolveCrmMasterDeactivate,
  writeCrmMasterEntry,
} from '../../../services/bridges/crmMasterApiBridge'
import { resolveStoreAction, type StoreActionResult } from '../../../store/storeAction'

const PAGE_SIZES = [10, 25, 50, 100] as const
type SortKey = 'sortOrder' | 'code' | 'name' | 'status' | 'updatedAt'

const MASTER_STATUS_FILTER_FIELDS: CrmFilterField[] = [
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
]

function scopeBreadcrumbs(scope: MasterRegisterScope, ...tail: { label: string; to?: string }[]) {
  return [
    { label: scope.hubLabel, to: scope.hubPath },
    ...tail,
  ]
}

function masterBreadcrumbs(scope: MasterRegisterScope, title: string) {
  return scopeBreadcrumbs(scope, { label: title })
}

function masterFormBreadcrumbs(scope: MasterRegisterScope, catalogTitle: string, currentLabel: string) {
  return scopeBreadcrumbs(
    scope,
    { label: catalogTitle, to: scope.basePath },
    { label: currentLabel },
  )
}

export function CrmLinkedMasterPage() {
  const { pathname } = useLocation()
  const linkedSlug = ['companies', 'contacts', 'quotation-templates'].find((s) => pathname.includes(`/masters/${s}`))
  const linked = linkedSlug ? getCrmLinkedMaster(linkedSlug) : undefined
  if (!linked) {
    return (
      <OperationalPageShell title="Master not found" breadcrumbs={crmBreadcrumbs({ label: 'CRM Masters', to: '/crm/masters' }, { label: 'Not Found' })}>
        <p className="text-sm text-erp-muted">Unknown CRM master.</p>
        <Link to="/crm/masters" className="mt-2 inline-block text-sm font-semibold text-erp-primary">Back to CRM Masters</Link>
      </OperationalPageShell>
    )
  }

  // Linked masters have a real register — open it directly (list or create), skip the gateway page
  const wantsNew = /\/new\/?$/.test(pathname)
  return <Navigate to={wantsNew ? linked.newRoute : linked.listRoute} replace />
}

export function CrmMasterListPage({ fixedSlug }: { fixedSlug?: string } = {}) {
  const scope = useMasterRegisterScope(fixedSlug)
  const slug = scope?.slug
  const navigate = useNavigate()
  const catalog = scope?.catalog
  const kind = scope?.kind ?? null
  const basePath = scope?.basePath ?? ''
  const entries = useCrmMasterStore((s) => (kind ? s.getByKind(kind, false) : []))
  const deactivateEntry = useCrmMasterStore((s) => s.deactivateEntry)
  const duplicateEntry = useCrmMasterStore((s) => s.duplicateEntry)
  const deleteEntry = useCrmMasterStore((s) => s.deleteEntry)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sortOrder')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showCols, setShowCols] = useState({ code: true, name: true, status: true, usage: true, sortOrder: true, updated: true })
  const [savedView, setSavedView] = useState('All Records')
  const [importOpen, setImportOpen] = useState(false)

  function pushToast(msg: string, variant: 'success' | 'error' = 'success') {
    if (variant === 'success') notify.success(msg)
    else notify.error(msg)
  }

  const filtered = useMemo(() => {
    let list = entries.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || (e.description?.toLowerCase().includes(q))
    })
    list = [...list].sort((a, b) => {
      const av = sortKey === 'updatedAt' ? a.updatedAt : String(a[sortKey as keyof CrmMasterEntry] ?? '')
      const bv = sortKey === 'updatedAt' ? b.updatedAt : String(b[sortKey as keyof CrmMasterEntry] ?? '')
      return av < bv ? -1 : av > bv ? 1 : 0
    })
    return list
  }, [entries, search, statusFilter, sortKey])

  const filterDrawer = useCrmFilterDrawer({
    values: { search, status: statusFilter },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status)
    },
    fields: MASTER_STATUS_FILTER_FIELDS,
    defaults: { search: '', status: '' },
    chipLabelResolver: (key, value) => (key === 'status' ? value.charAt(0).toUpperCase() + value.slice(1) : undefined),
  })

  const clearMasterFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSortKey('sortOrder')
    setPage(1)
  }, [filterDrawer])

  const hasActiveMasterFilters = useMemo(
    () => Boolean(search.trim() || statusFilter),
    [search, statusFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSafe, pageSize])

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection])

  const mutateDeactivate = useCallback(
    (entryId: string) => {
      if (!kind) return { ok: false as const, error: 'Missing master kind' }
      return resolveCrmMasterDeactivate(kind, entryId, () => deactivateEntry(entryId))
    },
    [kind, deactivateEntry],
  )

  const mutateDelete = useCallback(
    (entryId: string) => {
      if (!kind) return { ok: false as const, error: 'Missing master kind' }
      return resolveCrmMasterDelete(kind, entryId, () => deleteEntry(entryId))
    },
    [kind, deleteEntry],
  )

  const handleBulkDeactivate = useCallback(() => {
    void (async () => {
      let n = 0
      for (const id of selectedIds) {
        const r = await resolveStoreAction(mutateDeactivate(id))
        if (r.ok) n += 1
      }
      pushToast(`Deactivated ${n} record(s)`)
      setRowSelection({})
    })()
  }, [selectedIds, mutateDeactivate])

  if (!catalog || !kind || !scope) {
    const linked = slug ? getCrmLinkedMaster(slug) : undefined
    if (linked) return <CrmLinkedMasterPage />
    return (
      <OperationalPageShell title="Master not found" breadcrumbs={[{ label: 'Not Found' }]}>
        <Link to="/masters" className="text-sm font-semibold text-erp-primary">Back to Master Data</Link>
      </OperationalPageShell>
    )
  }

  function openMasterImport() {
    if (!slug) return
    downloadCrmMasterImportTemplate(slug)
    setImportOpen(true)
    pushToast('Import template downloaded — fill it and upload in the dialog')
  }

  function handleExportCsv() {
    const csv = exportMastersCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-masters.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportExcel() {
    const tsv = exportMastersExcelTsv(filtered)
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-masters.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = useMemo<ColumnDef<CrmMasterEntry>[]>(() => {
    const cols: ColumnDef<CrmMasterEntry>[] = []
    if (showCols.code) {
      cols.push({
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => <TableLink to={`${basePath}/${row.original.id}`}><EnterpriseIdCell id={row.original.code} /></TableLink>,
      })
    }
    if (showCols.name) cols.push({ accessorKey: 'name', header: 'Name' })
    if (showCols.status) {
      cols.push({
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      })
    }
    if (showCols.sortOrder) {
      cols.push({
        accessorKey: 'sortOrder',
        header: 'Seq',
        meta: entNumericMeta('Seq'),
        cell: ({ getValue }) => <EnterpriseNumericCell value={getValue() as number} />,
      })
    }
    if (showCols.usage) {
      cols.push({
        id: 'usage',
        header: 'In Use',
        meta: entNumericMeta('In Use'),
        cell: ({ row }) => {
          const n = countMasterUsage(row.original)
          return n > 0 ? <EnterpriseNumericCell value={n} className="text-amber-700 font-semibold" /> : '—'
        },
      })
    }
    if (showCols.updated) {
      cols.push(...buildMasterAuditListColumns<CrmMasterEntry>())
    }
    cols.push({
      id: 'actions',
      header: '',
      meta: { align: 'center', columnLabel: 'Actions' },
      cell: ({ row }) => {
        const e = row.original
        return (
          <div onClick={(ev) => ev.stopPropagation()}>
            <EnterpriseRowActionsMenu
              actions={buildCrmMasterRowActions(e, {
                basePath,
                navigate,
                duplicateEntry,
                deactivateEntry: mutateDeactivate,
                deleteEntry: mutateDelete,
                onFeedback: (msg, variant = 'success') => pushToast(msg, variant),
              })}
            />
          </div>
        )
      },
    })
    return cols
  }, [navigate, basePath, duplicateEntry, mutateDeactivate, mutateDelete])

  return (
    <OperationalPageShell
      variant="dynamics"
      badge={scope.badge}
      title={catalog.title}
      description={catalog.purpose ?? catalog.description}
      breadcrumbs={masterBreadcrumbs(scope, catalog.title)}
      autoBreadcrumbs={false}
      favoritePath={basePath}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new-master',
            label: 'New',
            icon: Plus,
            onClick: () => navigate(`${basePath}/new`),
          }}
          secondaryActions={[
            { id: 'import', label: 'Import', icon: Upload, onClick: openMasterImport },
            { id: 'export-csv', label: 'Export CSV', icon: Download, onClick: handleExportCsv },
            { id: 'export-excel', label: 'Export Excel', icon: FileSpreadsheet, onClick: handleExportExcel },
            { id: 'print', label: 'Print', icon: Printer, onClick: () => printMasterTable(catalog.title, filtered) },
            { id: 'hub', label: scope.hubLabel, onClick: () => navigate(scope.hubPath) },
          ]}
        />
      )}
      insights={[
        { label: 'Total', value: entries.length, accent: 'blue' },
        { label: 'Active', value: entries.filter((e) => e.status === 'active').length, accent: 'green' },
        { label: 'Inactive', value: entries.filter((e) => e.status === 'inactive').length, accent: 'slate' },
        { label: 'Filtered', value: filtered.length, accent: 'amber' },
      ]}
    >
      <CrmMasterImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        catalog={catalog}
        kind={kind}
        slug={slug!}
        existingEntries={entries}
        onImported={({ imported, skipped }) => {
          pushToast(`Imported ${imported} record(s), skipped ${skipped}`)
        }}
      />

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-primary/20 bg-erp-primary-soft px-3 py-2">
          <span className="text-[12px] font-semibold text-erp-primary">{selectedIds.length} selected</span>
          <ErpButton size="sm" variant="secondary" onClick={handleBulkDeactivate}>Deactivate</ErpButton>
          <ErpButton size="sm" variant="ghost" onClick={() => setRowSelection({})}>Clear</ErpButton>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <EnterpriseRegisterTableShell className="min-w-0">
          <ErpDataGrid
            data={paged}
            columns={columns}
            stickyFirstColumn
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={(r) => r.id}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${catalog.title.toLowerCase()}…`}
            showCompactSearch={false}
            emptyMessage={hasActiveMasterFilters ? `No ${catalog.title.toLowerCase()} records match current filters.` : `No ${catalog.title.toLowerCase()} records.`}
            emptyAction={
              hasActiveMasterFilters ? (
                <button type="button" className="text-[13px] font-semibold text-erp-primary" onClick={clearMasterFilters}>
                  Clear Filters
                </button>
              ) : undefined
            }
            registerBar={(
              <CrmListFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={`Search ${catalog.title.toLowerCase()}…`}
                activeFilterCount={filterDrawer.activeCount}
                onOpenFilters={filterDrawer.openDrawer}
                chips={filterDrawer.chips}
                onRemoveChip={filterDrawer.removeChip}
                onClearAll={clearMasterFilters}
                savedView={savedView}
                onSavedViewChange={setSavedView}
                savedViews={['All Records', 'Active Only', 'Inactive Only']}
                sort={(
                  <CrmListSortSelect
                    value={sortKey}
                    onChange={(v) => setSortKey(v as SortKey)}
                    aria-label="Sort master records"
                    options={[
                      { value: 'sortOrder', label: 'Sort: Sequence' },
                      { value: 'name', label: 'Sort: Name' },
                      { value: 'code', label: 'Sort: Code' },
                      { value: 'status', label: 'Sort: Status' },
                      { value: 'updatedAt', label: 'Sort: Last Modified' },
                    ]}
                  />
                )}
                afterFilters={(
                  <div className="flex items-center gap-1 text-[12px] text-erp-muted">
                    <Columns3 className="h-4 w-4" />
                    <label className="flex items-center gap-1"><input type="checkbox" checked={showCols.code} onChange={(e) => setShowCols((s) => ({ ...s, code: e.target.checked }))} /> Code</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={showCols.name} onChange={(e) => setShowCols((s) => ({ ...s, name: e.target.checked }))} /> Name</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={showCols.usage} onChange={(e) => setShowCols((s) => ({ ...s, usage: e.target.checked }))} /> In Use</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={showCols.updated} onChange={(e) => setShowCols((s) => ({ ...s, updated: e.target.checked }))} /> Updated</label>
                  </div>
                )}
                className="crm-list-filter-bar--embedded"
              />
            )}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-erp-border px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 text-[12px] text-erp-muted">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="h-8 w-20 text-[12px]">
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <span>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="erp-leads-actions__btn" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-[12px] font-medium">Page {pageSafe} / {totalPages}</span>
              <button type="button" className="erp-leads-actions__btn" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </EnterpriseRegisterTableShell>
        <CrmMasterContextPanel catalog={catalog} />
      </div>
      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={MASTER_STATUS_FILTER_FIELDS}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
    </OperationalPageShell>
  )
}

function masterFieldDetailValue(field: CrmMasterFieldDef, raw: string | number | boolean | null | undefined) {
  const text = String(raw ?? '—')
  if (field.type === 'color') {
    const hex = normalizeHexColor(String(raw ?? ''))
    if (!hex) return '—'
    return (
      <span className="inline-flex items-center gap-2">
        <ColorSwatch color={hex} size="sm" />
        <span className="font-mono text-[12px]">{hex}</span>
      </span>
    )
  }
  if (field.type === 'multiselect' && field.options) {
    return formatMasterMultiSelectValue(raw, field.options)
  }
  return text
}

function masterFieldIsWide(field: CrmMasterFieldDef) {
  return field.type === 'textarea' || field.type === 'color' || field.type === 'multiselect' || field.type === 'richtext'
}

function renderCatalogField(
  field: CrmMasterFieldDef,
  value: string,
  onChange: (v: string) => void,
) {
  if (field.type === 'boolean') {
    return (
      <div key={field.key} className="flex items-end md:col-span-2">
        <MasterFieldInput field={field} value={value} onChange={onChange} compact />
      </div>
    )
  }
  return (
    <MasterFormField key={field.key} label={field.label} required={field.required} wide={masterFieldIsWide(field)}>
      <MasterFieldInput field={field} value={value} onChange={onChange} compact />
    </MasterFormField>
  )
}
function MasterFormField({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={cn('block text-sm', wide && 'md:col-span-2')}>
      <span className="font-medium text-erp-text">
        {label}
        {required ? <span className="text-erp-danger"> *</span> : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function MasterFieldInput({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: CrmMasterFieldDef
  value: string
  onChange: (v: string) => void
  compact?: boolean
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
        {field.label}
      </label>
    )
  }
  if (field.type === 'textarea') {
    return <Textarea rows={compact ? 2 : 3} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'select' && field.options) {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    )
  }
  if (field.type === 'color') {
    return <ColorPickerField value={value} onChange={onChange} />
  }
  if (field.type === 'multiselect' && field.options) {
    return <MasterMultiSelectField value={value} onChange={onChange} options={field.options} />
  }
  if (field.type === 'richtext') {
    return <ErpRichTextEditor value={value} onChange={onChange} minHeight={compact ? 120 : 220} />
  }
  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}


export function CrmMasterFormPage({ fixedSlug }: { fixedSlug?: string } = {}) {
  const { id } = useParams()
  const scope = useMasterRegisterScope(fixedSlug)
  const slug = scope?.slug
  const basePath = scope?.basePath ?? ''
  const navigate = useNavigate()
  const catalog = scope?.catalog
  const kind = scope?.kind ?? null
  const existing = useCrmMasterStore((s) => (id ? s.getEntry(id) : undefined))
  const entries = useCrmMasterStore((s) => (kind ? s.getByKind(kind, false) : []))
  const addEntry = useCrmMasterStore((s) => s.addEntry)
  const updateEntry = useCrmMasterStore((s) => s.updateEntry)
  const isEdit = Boolean(id && existing)
  const series = useMasterCodeSeries(kind ? crmKindToEntityType(kind) : 'territory', {
    isEdit,
    existingCode: existing?.code,
  })

  const draftKey = `crm-master-draft-${slug}-${id ?? 'new'}`
  const [code, setCode] = useState(existing?.code ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'active')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {}
    if (existing) {
      Object.entries(existing.attributes).forEach(([k, v]) => { base[k] = String(v ?? '') })
    }
    return base
  })
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isEdit && !existing?.systemControlled && series.code && series.code !== code) {
      setCode(series.code)
    }
  }, [series.code, isEdit, existing?.systemControlled, code])

  const configFields = useMemo(
    () => (catalog ? crmMasterConfigurationFields(catalog) : []),
    [catalog],
  )
  const basicExtraFields = useMemo(
    () => (catalog ? crmMasterBasicExtraFields(catalog) : []),
    [catalog],
  )
  const showNotesSection = catalog ? crmMasterShowsNotes(catalog) : true
  const showDescriptionSection = catalog ? crmMasterShowsDescription(catalog) : true
  const usesRichDescription = catalog?.descriptionFormat === 'richtext'

  function validate() {
    const errs: string[] = []
    if (!code.trim()) errs.push('Code is required.')
    if (!name.trim()) errs.push('Name is required.')
    catalog?.fields.filter((f) => f.required && !['code', 'name', 'status'].includes(f.key)).forEach((f) => {
      const val = f.key === 'description' ? description : attrs[f.key]
      if (!String(val ?? '').trim()) errs.push(`${f.label} is required.`)
    })
    return errs
  }

  function buildAttributes() {
    const out: Record<string, string | number | boolean | null> = {}
    catalog?.fields.forEach((f) => {
      if (['code', 'name', 'status', 'description', 'notes'].includes(f.key)) return
      const raw = attrs[f.key] ?? ''
      if (f.type === 'number') out[f.key] = raw === '' ? null : Number(raw)
      else if (f.type === 'boolean') out[f.key] = raw === 'true'
      else out[f.key] = raw || null
    })
    return out
  }

  function persistDraft() {
    localStorage.setItem(draftKey, JSON.stringify({ code, name, status, description, notes, attrs }))
  }

  function persistRecord(mode: 'save' | 'new' | 'close') {
    if (!kind || !catalog) return
    const errs = validate()
    if (errs.length) {
      setErrors(errs)
      return
    }
    if (!existing?.systemControlled) {
      const validation = series.validateBeforeSave(code.trim(), {
        checkDuplicate: (c) => entries.some((e) => e.code === c && e.id !== id),
      })
      if (!validation.ok) {
        setErrors([validation.message ?? 'Invalid code'])
        return
      }
    }
    setErrors([])
    setIsSubmitting(true)
    const payload = {
      kind: kind as CrmMasterKind,
      code: code.trim(),
      name: name.trim(),
      status: status as 'active' | 'inactive',
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      attributes: buildAttributes(),
    }
    void (async () => {
      const r = await resolveStoreAction(
        resolveCrmMasterWrite(
          () => (isEdit && id ? updateEntry(id, payload) : addEntry(payload)),
          () => writeCrmMasterEntry(payload, isEdit ? id : undefined),
        ),
      )
      setIsSubmitting(false)
      if (!r.ok) {
        setErrors([r.error ?? 'Save failed'])
        return
      }
      if (!isEdit && !existing?.systemControlled) {
        series.confirmSaved(code.trim())
      }
      notifyMasterSaved(catalog.title.replace(/ Master$/i, '') || 'Record', !isEdit)
      localStorage.removeItem(draftKey)
      if (mode === 'new') navigate(`${basePath}/new`)
      else if (mode === 'close') navigate(isEdit && id ? `${basePath}/${id}` : basePath)
      else navigate(basePath)
    })()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    persistRecord('save')
  }

  if (!catalog || !kind || !scope) return <CrmMasterListPage fixedSlug={fixedSlug} />

  const pageTitle = isEdit ? `Edit ${catalog.title}` : `New ${catalog.title}`

  return (
    <ErpFormShell
      title={pageTitle}
      subtitle={catalog.purpose ?? catalog.description}
      backTo={basePath}
      backLabel={catalog.title}
      breadcrumbs={masterFormBreadcrumbs(scope, catalog.title, isEdit ? 'Edit' : 'New')}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      validationErrors={errors}
      className="crm-master-form-compact"
      footerHint={errors.length > 0 ? 'Fix highlighted fields before saving.' : 'All fields on one screen — save when ready.'}
      footerActions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" onClick={() => { series.releaseOnCancel(); navigate(basePath) }}>Cancel</ErpButton>
          <ErpButton type="button" variant="secondary" disabled={isSubmitting} onClick={persistDraft}>Save Draft</ErpButton>
          <ErpButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : (isEdit ? 'Save Changes' : `Create ${catalog.title}`)}
          </ErpButton>
          <ErpButton type="button" variant="secondary" disabled={isSubmitting} onClick={() => persistRecord('new')}>Save &amp; New</ErpButton>
          <ErpButton type="button" variant="secondary" disabled={isSubmitting} onClick={() => persistRecord('close')}>Save &amp; Close</ErpButton>
        </ErpButtonGroup>
      )}
    >
      <ErpFormStatusStrip
        items={[
          { label: 'Status', value: status === 'active' ? 'Active' : 'Inactive', tone: status === 'active' ? 'success' : 'warning' },
          { label: 'Master', value: catalog.title, tone: 'info' },
          ...(isEdit && existing ? [{ label: 'Code', value: existing.code, tone: 'neutral' as const }] : []),
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <ErpCardSection
          title="Master Entry"
          subtitle="Enter all details on this screen."
          dense
          defaultOpen
        >
          <MasterFormField label="Code" required>
            <Input
              className={cn('font-mono', (series.readOnly || existing?.systemControlled) && 'bg-erp-surface-alt/60')}
              value={code}
              disabled={existing?.systemControlled || isEdit}
              readOnly={!existing?.systemControlled && !isEdit && !series.canManual}
              onChange={(e) => {
                if (series.readOnly || existing?.systemControlled) return
                setCode(e.target.value)
              }}
            />
            {!isEdit && !series.canManual && !series.error ? (
              <p className="mt-1 text-[12px] text-erp-muted">{MASTER_CODE_HELPER_TEXT}</p>
            ) : null}
            {series.error ? (
              <p className="mt-1 text-[12px] text-erp-danger">{series.error}</p>
            ) : null}
          </MasterFormField>
          <MasterFormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </MasterFormField>
          <MasterFormField label="Status" required>
            <Select wrapClassName="w-full" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </MasterFormField>
          {basicExtraFields.map((field) => renderCatalogField(field, attrs[field.key] ?? '', (v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))))}
          {configFields.map((field) => renderCatalogField(field, attrs[field.key] ?? '', (v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))))}
          {showDescriptionSection ? (
            <MasterFormField label="Description" wide>
              {usesRichDescription ? (
                <ErpRichTextEditor value={description} onChange={setDescription} minHeight={120} />
              ) : (
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              )}
            </MasterFormField>
          ) : null}
          {showNotesSection ? (
            <MasterFormField label="Notes" wide>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for administrators" />
            </MasterFormField>
          ) : null}
        </ErpCardSection>
        <CrmMasterContextPanel catalog={catalog} entry={existing} />
      </div>
    </ErpFormShell>
  )
}

export function CrmMasterDetailPage({ fixedSlug }: { fixedSlug?: string } = {}) {
  const { id } = useParams()
  const scope = useMasterRegisterScope(fixedSlug)
  const basePath = scope?.basePath ?? ''
  const navigate = useNavigate()
  const catalog = scope?.catalog
  const kind = scope?.kind ?? null
  const entry = useCrmMasterStore((s) => (id ? s.getEntry(id) : undefined))
  const deactivateEntry = useCrmMasterStore((s) => s.deactivateEntry)
  const activateEntry = useCrmMasterStore((s) => s.activateEntry)
  const deleteEntry = useCrmMasterStore((s) => s.deleteEntry)
  const duplicateEntry = useCrmMasterStore((s) => s.duplicateEntry)

  async function runMasterMutation(
    fn: () => StoreActionResult | Promise<StoreActionResult>,
  ): Promise<StoreActionResult> {
    return resolveStoreAction(fn())
  }

  function pushToast(msg: string, variant: 'success' | 'error' = 'success') {
    if (variant === 'success') notify.success(msg)
    else notify.error(msg)
  }

  if (!catalog || !entry || !scope) {
    return (
      <OperationalPageShell title="Record not found" breadcrumbs={[{ label: 'Not Found' }]}>
        <Link to={basePath || '/masters'} className="text-sm font-semibold text-erp-primary">Back to list</Link>
      </OperationalPageShell>
    )
  }

  const usage = countMasterUsage(entry)
  const usageLinks = getMasterUsageLinks(entry)
  const basicExtraFields = crmMasterBasicExtraFields(catalog)
  const configFields = crmMasterConfigurationFields(catalog)
  const showNotesSection = crmMasterShowsNotes(catalog)
  const showDescriptionSection = crmMasterShowsDescription(catalog)
  const usesRichDescription = catalog.descriptionFormat === 'richtext'
  const basicSectionLabel = crmMasterBasicSectionLabel(catalog)
  const configurationSectionLabel = crmMasterConfigurationSectionLabel(catalog)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
      <DetailLayout
        backTo={basePath}
        backLabel={catalog.title}
        title={entry.name}
        subtitle={entry.code}
        breadcrumbs={masterBreadcrumbs(scope, entry.name)}
        editTo={`${basePath}/${entry.id}/edit`}
        headerActions={(
          <ErpButtonGroup>
            <ErpButton variant="secondary" icon={Copy} onClick={() => {
              const r = duplicateEntry(entry.id)
              if (r.ok && r.id) navigate(`${basePath}/${r.id}/edit`)
              else pushToast(r.error ?? 'Duplicate failed', 'error')
            }}>Duplicate</ErpButton>
            {entry.status === 'active' && !entry.systemControlled ? (
              <ErpButton variant="secondary" onClick={() => {
                if (!kind) return
                void runMasterMutation(() =>
                  resolveCrmMasterDeactivate(kind, entry.id, () => deactivateEntry(entry.id)),
                ).then((r) => pushToast(r.ok ? 'Deactivated' : (r.error ?? 'Failed'), r.ok ? 'success' : 'error'))
              }}>Deactivate</ErpButton>
            ) : entry.status === 'inactive' ? (
              <ErpButton variant="secondary" onClick={() => {
                if (!kind) return
                void runMasterMutation(() =>
                  resolveCrmMasterActivate(kind, entry.id, () => activateEntry(entry.id)),
                ).then((r) => pushToast(r.ok ? 'Activated' : (r.error ?? 'Failed'), r.ok ? 'success' : 'error'))
              }}>Activate</ErpButton>
            ) : null}
            <ErpButton variant="ghost" icon={Trash2} onClick={() => {
              if (!kind) return
              void runMasterMutation(() =>
                resolveCrmMasterDelete(kind, entry.id, () => deleteEntry(entry.id)),
              ).then((r) => {
                if (r.ok) {
                  notify.success('Record deleted')
                  navigate(basePath)
                }
                else pushToast(r.error ?? 'Delete blocked', 'error')
              })
            }}>Delete</ErpButton>
          </ErpButtonGroup>
        )}
        badges={<StatusBadge status={entry.status} />}
      >
        <DetailSection title={basicSectionLabel}>
          <DetailGrid>
            <DetailField label="Code" value={entry.code} />
            <DetailField label="Name" value={entry.name} />
            <DetailField label="Status" value={entry.status} />
            <DetailField label="Sequence" value={entry.sortOrder} />
            {basicExtraFields.map((field) => (
              <DetailField
                key={field.key}
                label={field.label}
                value={masterFieldDetailValue(field, entry.attributes[field.key])}
              />
            ))}
            {showDescriptionSection ? (
              <DetailField
                label="Description"
                value={
                  usesRichDescription && entry.description
                    ? <ErpRichTextRead html={entry.description} />
                    : (entry.description ?? '—')
                }
              />
            ) : null}
            {showNotesSection ? <DetailField label="Notes" value={entry.notes ?? '—'} /> : null}
          </DetailGrid>
        </DetailSection>
        {configFields.length > 0 ? (
        <DetailSection title={configurationSectionLabel}>
          <DetailGrid>
            {configFields.map((field) => (
              <DetailField
                key={field.key}
                label={field.label}
                value={masterFieldDetailValue(field, entry.attributes[field.key])}
              />
            ))}
          </DetailGrid>
        </DetailSection>
        ) : null}
        {usageLinks.length > 0 ? (
          <DetailSection title="Used In (Live)">
            <ul className="space-y-1">
              {usageLinks.map((l) => (
                <li key={l.route}>
                  <Link to={l.route} className="text-[13px] font-medium text-erp-primary hover:underline">
                    {l.label} — {l.count} record(s)
                  </Link>
                </li>
              ))}
            </ul>
          </DetailSection>
        ) : null}
        {usage > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
            This master value is referenced in {usage} CRM record(s). Deactivate instead of delete when retiring values.
          </div>
        ) : null}
      </DetailLayout>
      <CrmMasterContextPanel catalog={catalog} entry={entry} />
    </div>
  )
}

export { CRM_LINKED_MASTERS }
