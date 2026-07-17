import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Eye, Pencil, Plus, Trash2, Copy, ChevronLeft, ChevronRight,
  Columns3, Printer, Upload, Download, FileSpreadsheet,
  ArrowLeft, ClipboardList, FileText, Save, Settings2, X,
} from 'lucide-react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { CrmListFilterBar, CrmListSortSelect } from '../../../components/crm/CrmListFilterBar'
import { ErpDataGrid } from '../../../components/erp/ErpDataGrid'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { ErpButton, ErpButtonGroup } from '../../../components/erp/ErpButton'
import {
  ErpAdditionalInfoPanel,
  ErpAdditionalInfoToggle,
  ErpCardSection,
  ErpFieldRow,
  ErpQuickEntrySection,
  ErpStickySaveBar,
  ErpViewField,
  useErpAdditionalInfo,
} from '../../../components/erp/card-form'
import { ErpCardCommandBar } from '../../../components/erp/card-form/ErpCardCommandBar'
import { Input, Select, Textarea } from '../../../components/forms/Inputs'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { TableLink } from '../../../components/ui/AppLink'
import { DetailLayout, DetailSection } from '../../../components/masters/MasterLayouts'
import {
  getPurchaseLinkedMaster,
  getPurchaseMasterCatalog,
  slugToPurchaseKind,
} from '../../../config/purchaseMastersCatalog'
import { usePurchaseMasterStore } from '../../../store/purchaseMasterStore'
import type { PurchaseMasterEntry, PurchaseMasterFieldDef } from '../../../types/purchaseMasters'
import {
  countPurchaseMasterUsage,
  exportMastersCsv,
  parseMastersCsv,
  printMasterTable,
} from '../../../utils/purchaseMasterUtils'
import { purchaseBreadcrumbs } from '../../../utils/purchaseNavigation'
import { formatDate } from '../../../utils/dates/format'
import { getSessionUser } from '../../../utils/permissions'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PurchaseMasterContextPanel } from '@/components/purchase/masters/PurchaseMasterContextPanel'
import {
  PurchaseFormSectionNav,
  purchaseSectionId,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import { buildMasterAuditListColumns } from '../../../components/masters/MasterAuditListColumns'
type SortKey = 'sortOrder' | 'code' | 'name' | 'status' | 'updatedAt'

function masterBreadcrumbs(title: string) {
  return [
    ...purchaseBreadcrumbs('Masters'),
    { label: title },
  ]
}

function fieldLabel(key: string, catalog?: ReturnType<typeof getPurchaseMasterCatalog>) {
  return catalog?.fields.find((f) => f.key === key)?.label ?? key.replace(/([A-Z])/g, ' $1')
}

export function PurchaseLinkedMasterPage() {
  const { pathname, search, hash } = useLocation()
  const match = pathname.match(/^\/purchase\/masters\/([^/]+)(.*)$/)
  const slug = match?.[1]
  const rest = match?.[2] ?? ''
  const linked = slug ? getPurchaseLinkedMaster(slug) : undefined

  if (!linked) {
    return (
      <OperationalPageShell title="Master not found" breadcrumbs={masterBreadcrumbs('Not Found')}>
        <Link to="/purchase/masters" className="text-sm font-semibold text-erp-primary">Back to Purchase Masters</Link>
      </OperationalPageShell>
    )
  }

  const suffix = `${search}${hash}`
  // Create → canonical newRoute; detail/edit/list → rewrite under listRoute base
  if (rest === '/new' || rest.startsWith('/new/')) {
    return <Navigate to={`${linked.newRoute}${suffix}`} replace />
  }
  if (rest) {
    const base = linked.listRoute.replace(/\/$/, '')
    return <Navigate to={`${base}${rest}${suffix}`} replace />
  }
  return <Navigate to={`${linked.listRoute}${suffix}`} replace />
}

export function PurchaseMasterListPage() {
  const { kind: slug } = useParams()
  const navigate = useNavigate()
  const catalog = slug ? getPurchaseMasterCatalog(slug) : undefined
  const kind = slug ? slugToPurchaseKind(slug) : null
  const entries = usePurchaseMasterStore((s) => (kind ? s.getByKind(kind, false) : []))
  const deactivateEntry = usePurchaseMasterStore((s) => s.deactivateEntry)
  const duplicateEntry = usePurchaseMasterStore((s) => s.duplicateEntry)
  const importEntries = usePurchaseMasterStore((s) => s.importEntries)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sortOrder')
  const [page, setPage] = useState(1)
  const [pageSize] = useState<number>(25)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showCols, setShowCols] = useState({ code: true, name: true, status: true, usage: true, sortOrder: true })
  const fileRef = useRef<HTMLInputElement>(null)

  function pushToast(msg: string, variant: 'success' | 'error' = 'success') {
    if (variant === 'success') notify.success(msg)
    else notify.error(msg)
  }

  const filtered = useMemo(() => {
    let list = entries.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q)
    })
    return [...list].sort((a, b) => {
      const av = sortKey === 'updatedAt' ? a.updatedAt : String(a[sortKey as keyof PurchaseMasterEntry] ?? '')
      const bv = sortKey === 'updatedAt' ? b.updatedAt : String(b[sortKey as keyof PurchaseMasterEntry] ?? '')
      return av < bv ? -1 : av > bv ? 1 : 0
    })
  }, [entries, search, statusFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSafe, pageSize])

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection])

  const handleBulkDeactivate = useCallback(() => {
    let n = 0
    for (const id of selectedIds) {
      if (deactivateEntry(id).ok) n += 1
    }
    pushToast(`Deactivated ${n} record(s)`)
    setRowSelection({})
  }, [selectedIds, deactivateEntry])

  const columns = useMemo<ColumnDef<PurchaseMasterEntry>[]>(() => [
    ...(showCols.code ? [{
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }: { row: { original: PurchaseMasterEntry } }) => (
        <TableLink to={`/purchase/masters/${slug}/${row.original.id}`}>{row.original.code}</TableLink>
      ),
    }] : []),
    ...(showCols.name ? [{ accessorKey: 'name', header: 'Name' }] : []),
    ...(showCols.status ? [{
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: { original: PurchaseMasterEntry } }) => <StatusBadge status={row.original.status} />,
    }] : []),
    ...(showCols.sortOrder ? [{ accessorKey: 'sortOrder', header: 'Seq' }] : []),
    ...(showCols.usage ? [{
      id: 'usage',
      header: 'In Use',
      cell: ({ row }: { row: { original: PurchaseMasterEntry } }) => {
        const n = countPurchaseMasterUsage(row.original)
        return n > 0 ? <span className="font-semibold text-amber-700">{n}</span> : '—'
      },
    }] : []),
    ...buildMasterAuditListColumns<PurchaseMasterEntry>(),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: PurchaseMasterEntry } }) => {
        const e = row.original
        return (
          <div className="flex justify-end gap-0.5">
            <button type="button" className="erp-leads-actions__btn" title="View" onClick={() => navigate(`/purchase/masters/${slug}/${e.id}`)}><Eye className="h-4 w-4" /></button>
            <button type="button" className="erp-leads-actions__btn" title="Edit" onClick={() => navigate(`/purchase/masters/${slug}/${e.id}/edit`)}><Pencil className="h-4 w-4" /></button>
            <button type="button" className="erp-leads-actions__btn" title="Duplicate" onClick={() => {
              const r = duplicateEntry(e.id)
              if (r.ok && r.id) navigate(`/purchase/masters/${slug}/${r.id}/edit`)
            }}><Copy className="h-4 w-4" /></button>
          </div>
        )
      },
    },
  ], [navigate, slug, showCols, duplicateEntry])

  if (!catalog || !kind) {
    if (slug && getPurchaseLinkedMaster(slug)) return <PurchaseLinkedMasterPage />
    return (
      <OperationalPageShell title="Master not found" breadcrumbs={masterBreadcrumbs('Not Found')}>
        <Link to="/purchase/masters" className="text-sm font-semibold text-erp-primary">Back to Purchase Masters</Link>
      </OperationalPageShell>
    )
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

  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseMastersCsv(String(reader.result ?? ''))
      const r = importEntries(kind!, rows)
      pushToast(`Imported ${r.imported} record(s), skipped ${r.skipped}`)
    }
    reader.readAsText(file)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Purchase Master"
      title={catalog.title}
      description={catalog.purpose ?? catalog.description}
      breadcrumbs={masterBreadcrumbs(catalog.title)}
      favoritePath={`/purchase/masters/${slug}`}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{ id: 'new', label: 'New', icon: Plus, onClick: () => navigate(`/purchase/masters/${slug}/new`) }}
          secondaryActions={[
            ...(catalog.importExport ? [{ id: 'import', label: 'Import', icon: Upload, onClick: () => fileRef.current?.click() }] : []),
            { id: 'export-csv', label: 'Export CSV', icon: Download, onClick: handleExportCsv },
            { id: 'export-excel', label: 'Export Excel', icon: FileSpreadsheet, onClick: () => printMasterTable(catalog.title, filtered) },
            { id: 'print', label: 'Print', icon: Printer, onClick: () => printMasterTable(catalog.title, filtered) },
            { id: 'hub', label: 'Purchase Masters', onClick: () => navigate('/purchase/masters') },
          ]}
        />
      )}
      insights={[
        { label: 'Total', value: entries.length, accent: 'blue' },
        { label: 'Active', value: entries.filter((e) => e.status === 'active').length, accent: 'green' },
        { label: 'Filtered', value: filtered.length, accent: 'amber' },
      ]}
      filterBar={(
        <CrmListFilterBar
          className="crm-list-filter-bar--purchase"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Search ${catalog.title.toLowerCase()}…`}
          showCommandPaletteHint={false}
          onClearAll={() => {
            setSearch('')
            setStatusFilter('')
          }}
          chips={[
            ...(statusFilter
              ? [{ id: 'status', label: statusFilter === 'active' ? 'Active' : 'Inactive' }]
              : []),
          ]}
          onRemoveChip={(id) => {
            if (id === 'status') setStatusFilter('')
          }}
          sort={
            <CrmListSortSelect
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label="Filter by status"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          }
          trailing={
            <>
              <CrmListSortSelect
                value={sortKey}
                onChange={(v) => setSortKey(v as SortKey)}
                aria-label="Sort masters"
                options={[
                  { value: 'sortOrder', label: 'Sort: Sequence' },
                  { value: 'name', label: 'Sort: Name' },
                  { value: 'code', label: 'Sort: Code' },
                ]}
              />
              <div className="flex items-center gap-1 text-[12px] text-erp-muted">
                <Columns3 className="h-4 w-4" />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={showCols.usage}
                    onChange={(e) => setShowCols((s) => ({ ...s, usage: e.target.checked }))}
                  />{' '}
                  In Use
                </label>
              </div>
            </>
          }
        />
      )}
    >
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) handleImportFile(f)
        e.target.value = ''
      }} />

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex gap-2 rounded-lg border border-erp-primary/20 bg-erp-primary-soft px-3 py-2">
          <span className="text-[12px] font-semibold text-erp-primary">{selectedIds.length} selected</span>
          <ErpButton size="sm" variant="secondary" onClick={handleBulkDeactivate}>Deactivate</ErpButton>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div>
          <ErpDataGrid
            data={paged}
            columns={columns}
            stickyFirstColumn
            selectable
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={(r) => r.id}
            emptyMessage={`No ${catalog.title.toLowerCase()} records.`}
          />
          <div className="mt-3 flex items-center justify-between border-t border-erp-border pt-3 text-[12px] text-erp-muted">
            <span>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button type="button" className="erp-leads-actions__btn" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2">Page {pageSafe} / {totalPages}</span>
              <button type="button" className="erp-leads-actions__btn" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <PurchaseMasterContextPanel catalog={catalog} />
      </div>
    </OperationalPageShell>
  )
}

function MasterFieldInput({ field, value, onChange }: { field: PurchaseMasterFieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
        {field.label}
      </label>
    )
  }
  if (field.type === 'textarea') return <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
  if (field.type === 'select' && field.options) {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    )
  }
  return <Input type={field.type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
}

export function PurchaseMasterFormPage() {
  const { kind: slug, id } = useParams()
  const navigate = useNavigate()
  const catalog = slug ? getPurchaseMasterCatalog(slug) : undefined
  const kind = slug ? slugToPurchaseKind(slug) : null
  const existing = usePurchaseMasterStore((s) => (id ? s.getEntry(id) : undefined))
  const addEntry = usePurchaseMasterStore((s) => s.addEntry)
  const updateEntry = usePurchaseMasterStore((s) => s.updateEntry)
  const isEdit = Boolean(id && existing)
  const session = getSessionUser()
  const listPath = `/purchase/masters/${slug ?? ''}`

  const [code, setCode] = useState(existing?.code ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'active')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {}
    if (existing) Object.entries(existing.attributes).forEach(([k, v]) => { base[k] = String(v ?? '') })
    return base
  })
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState('quick')
  const {
    open: showAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo()

  if (!catalog || !kind) return <PurchaseMasterListPage />

  const configFields = catalog.fields.filter((f) => !['code', 'name', 'status', 'description', 'notes'].includes(f.key))
  const quickDone = Boolean(code.trim() && name.trim())
  const additionalSectionCount = (configFields.length > 0 ? 1 : 0) + 1

  function buildAttributes() {
    const out: Record<string, string | number | boolean | null> = {}
    catalog!.fields.forEach((f) => {
      if (['code', 'name', 'status', 'description', 'notes'].includes(f.key)) return
      const raw = attrs[f.key] ?? ''
      if (f.type === 'number') out[f.key] = raw === '' ? null : Number(raw)
      else if (f.type === 'boolean') out[f.key] = raw === 'true'
      else out[f.key] = raw || null
    })
    return out
  }

  function persist() {
    const errs: string[] = []
    if (!code.trim()) errs.push('Code is required.')
    if (!name.trim()) errs.push('Name is required.')
    setErrors(errs)
    if (errs.length) return
    setIsSubmitting(true)
    const payload = {
      kind: kind!,
      code: code.trim(),
      name: name.trim(),
      status: status as 'active' | 'inactive',
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      attributes: buildAttributes(),
    }
    const r = isEdit && id ? updateEntry(id, payload) : addEntry(payload)
    setIsSubmitting(false)
    if (!r.ok) { setErrors([r.error ?? 'Save failed']); return }
    notifyMasterSaved(catalog!.title.replace(/ Master$/i, '') || 'Record', !isEdit)
    navigate(listPath)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    persist()
  }

  const documentStrip = [
    { label: 'Master', value: catalog.title, highlight: true },
    { label: 'Code', value: code.trim() || '—' },
    { label: 'Status', value: status === 'active' ? 'Active' : 'Inactive', highlight: status === 'active' },
    { label: 'Created by', value: existing?.createdBy ?? session.name },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        {
          id: 'save',
          label: isEdit ? 'Save Changes' : 'Save',
          icon: Save,
          onClick: persist,
          primary: true,
          disabled: isSubmitting || !quickDone,
        },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate(listPath) },
      ]}
    />
  )

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      isSubmitting={isSubmitting}
      submitLabel={isEdit ? 'Save Changes' : 'Save'}
      submitDisabled={!quickDone}
      cancelTo={listPath}
      onSave={persist}
      hint={(
        <span className="text-[12px] text-erp-muted">
          {quickDone ? 'Ready to save' : 'Code and name required'}
          {configFields.length > 0 ? ' · Configuration in Additional Information' : ''}
        </span>
      )}
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate(listPath)}>
            Cancel
          </ErpButton>
          <ErpButton type="submit" variant="primary" icon={Save} disabled={isSubmitting || !quickDone}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save'}
          </ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  return (
    <PurchaseCardFormShell
      title={isEdit ? `Edit ${catalog.title}` : `New ${catalog.title}`}
      description={catalog.purpose ?? catalog.description}
      recordNo={isEdit ? (existing?.code ?? 'Edit') : 'New'}
      recordTitle={name.trim() || catalog.title}
      status={status === 'active' ? 'Active' : 'Inactive'}
      statusTone={status === 'active' ? 'success' : 'warning'}
      owner={existing?.createdBy ?? session.name}
      createdDate={formatDate(existing?.createdAt ?? new Date().toISOString())}
      createdBy={existing?.createdBy ?? session.name}
      modifiedDate={existing?.updatedAt ? formatDate(existing.updatedAt) : undefined}
      modifiedBy={existing?.modifiedBy}
      favoritePath={isEdit ? `${listPath}/${id}/edit` : `${listPath}/new`}
      breadcrumbs={[
        { label: 'Masters', to: '/purchase/masters' },
        { label: catalog.title, to: listPath },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      commandBar={commandBar}
      documentStrip={documentStrip}
      validationErrors={errors}
      className="enterprise-workspace--crm-smart-overview"
      factBox={<PurchaseMasterContextPanel catalog={catalog} entry={existing} pendingCreatedBy={session.name} />}
      footer={footer}
      collapsibleFactBox
      stickyFooter={false}
      onSubmit={handleSubmit}
      onSaveShortcut={persist}
    >
      <PurchaseFormSectionNav
        sections={[
          { id: 'quick', label: 'Quick Entry', icon: ClipboardList, done: quickDone },
          ...(configFields.length > 0
            ? [{ id: 'config', label: 'Configuration', icon: Settings2, done: configFields.every((f) => !f.required || Boolean(attrs[f.key]?.trim())) }]
            : []),
          { id: 'notes', label: 'Notes', icon: FileText },
        ]}
        activeId={activeSection}
        onSelect={setActiveSection}
      />

      <div id={purchaseSectionId('quick')}>
        <ErpQuickEntrySection
          id={purchaseSectionId('quick-fields')}
          subtitle="Code, name, and status — expand Additional Information for configuration and notes."
        >
          <ErpFieldRow label="Code" required>
            <Input
              className="erp-input"
              value={code}
              disabled={existing?.systemControlled}
              onChange={(e) => setCode(e.target.value)}
              autoFocus={!isEdit}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Name" required>
            <Input className="erp-input" value={name} onChange={(e) => setName(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Status">
            <Select
              wrapClassName="w-full"
              className="erp-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </ErpFieldRow>
        </ErpQuickEntrySection>
      </div>

      <ErpAdditionalInfoToggle
        open={showAdditionalDetails}
        onToggle={toggleAdditionalDetails}
        panelId={additionalPanelId}
        sectionCount={additionalSectionCount}
        summary={configFields.length > 0 ? 'Configuration fields, description, and notes' : 'Description and notes'}
      />
      <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
        {configFields.length > 0 ? (
          <ErpCardSection
            id={purchaseSectionId('config')}
            title="Configuration"
            subtitle="Master-specific attributes used on purchase documents"
            icon={Settings2}
            accent="blue"
            collapsible
            defaultOpen
          >
            {configFields.map((field) => (
              <ErpFieldRow
                key={field.key}
                label={field.type === 'boolean' ? '' : field.label}
                required={field.required}
                colSpan={field.type === 'textarea' ? 2 : 1}
              >
                <MasterFieldInput
                  field={field}
                  value={attrs[field.key] ?? ''}
                  onChange={(v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))}
                />
              </ErpFieldRow>
            ))}
          </ErpCardSection>
        ) : null}
        <ErpCardSection
          id={purchaseSectionId('notes')}
          title="Description & notes"
          subtitle="Optional narrative for this master value"
          icon={FileText}
          accent="slate"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Description" colSpan={2}>
            <Textarea className="erp-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Notes" colSpan={2}>
            <Textarea
              className="erp-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
            />
          </ErpFieldRow>
        </ErpCardSection>
      </ErpAdditionalInfoPanel>
    </PurchaseCardFormShell>
  )
}

export function PurchaseMasterDetailPage() {
  const { kind: slug, id } = useParams()
  const navigate = useNavigate()
  const catalog = slug ? getPurchaseMasterCatalog(slug) : undefined
  const entry = usePurchaseMasterStore((s) => (id ? s.getEntry(id) : undefined))
  const deactivateEntry = usePurchaseMasterStore((s) => s.deactivateEntry)
  const activateEntry = usePurchaseMasterStore((s) => s.activateEntry)
  const deleteEntry = usePurchaseMasterStore((s) => s.deleteEntry)
  const duplicateEntry = usePurchaseMasterStore((s) => s.duplicateEntry)

  if (!catalog || !entry) {
    return (
      <OperationalPageShell title="Record not found" breadcrumbs={masterBreadcrumbs('Not Found')}>
        <Link to={`/purchase/masters/${slug ?? ''}`} className="text-sm font-semibold text-erp-primary">Back to list</Link>
      </OperationalPageShell>
    )
  }

  const usage = countPurchaseMasterUsage(entry)

  return (
    <OperationalPageShell
      title={entry.name}
      description={entry.code}
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={masterBreadcrumbs(entry.name)}
      favoritePath={`/purchase/masters/${slug}/${entry.id}`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <DetailLayout
          backTo={`/purchase/masters/${slug}`}
          backLabel={catalog.title}
          title={entry.name}
          subtitle={entry.code}
          editTo={`/purchase/masters/${slug}/${entry.id}/edit`}
          headerActions={(
            <ErpButtonGroup>
              <ErpButton variant="secondary" icon={Copy} onClick={() => {
                const r = duplicateEntry(entry.id)
                if (r.ok && r.id) {
                  notify.success('Record duplicated')
                  navigate(`/purchase/masters/${slug}/${r.id}/edit`)
                } else {
                  notify.error(r.error ?? 'Duplicate failed')
                }
              }}>Duplicate</ErpButton>
              {entry.status === 'active' && !entry.systemControlled ? (
                <ErpButton variant="secondary" onClick={() => {
                  deactivateEntry(entry.id)
                  notify.success('Deactivated')
                }}>Deactivate</ErpButton>
              ) : entry.status === 'inactive' ? (
                <ErpButton variant="secondary" onClick={() => {
                  activateEntry(entry.id)
                  notify.success('Activated')
                }}>Activate</ErpButton>
              ) : null}
              <ErpButton variant="ghost" icon={Trash2} onClick={() => {
                const r = deleteEntry(entry.id)
                if (r.ok) {
                  notify.success('Record deleted')
                  navigate(`/purchase/masters/${slug}`)
                } else {
                  notify.error(r.error ?? 'Delete blocked')
                }
              }}>Delete</ErpButton>
            </ErpButtonGroup>
          )}
          badges={<StatusBadge status={entry.status} />}
        >
          <DetailSection title="Basic Information">
            <div className="erp-card-section__grid erp-card-section__grid--cols-2">
              <ErpViewField label="Code" value={entry.code} />
              <ErpViewField label="Status" value={entry.status} />
              <ErpViewField label="Created on" value={new Date(entry.createdAt).toLocaleString('en-IN')} />
              <ErpViewField label="Created by" value={entry.createdBy ?? undefined} />
              <ErpViewField
                label="Last modified"
                value={`${new Date(entry.updatedAt).toLocaleString('en-IN')}${entry.modifiedBy ? ` · ${entry.modifiedBy}` : ''}`}
              />
              <ErpViewField label="Description" value={entry.description ?? undefined} colSpan={2} />
            </div>
          </DetailSection>
          <DetailSection title="Configuration">
            <div className="erp-card-section__grid erp-card-section__grid--cols-2">
              {Object.entries(entry.attributes).map(([k, v]) => (
                <ErpViewField key={k} label={fieldLabel(k, catalog)} value={v == null || v === '' ? undefined : String(v)} />
              ))}
            </div>
          </DetailSection>
          {usage > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
              Referenced in {usage} purchase document(s). Deactivate instead of delete when retiring.
            </div>
          ) : null}
        </DetailLayout>
        <PurchaseMasterContextPanel catalog={catalog} entry={entry} />
      </div>
    </OperationalPageShell>
  )
}
