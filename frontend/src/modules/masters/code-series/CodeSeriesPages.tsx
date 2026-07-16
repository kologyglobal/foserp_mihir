import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Copy,
  Hash,
  History,
  RefreshCw,
  Settings2,
  Shield,
  Wand2,
} from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useCodeSeriesStore } from '../../../store/codeSeriesStore'
import {
  CODE_FORMAT_SEGMENT_LABELS,
  CODE_SERIES_ENTITY_LABELS,
  CODE_SERIES_MODULE_LABELS,
  RESET_FREQUENCY_LABELS,
  type CodeFormatSegment,
  type CodeSeries,
  type CodeSeriesEntityType,
  type CodeSeriesModule,
} from '../../../types/codeSeriesMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { defaultFormatSegments, previewFormat } from '../../../utils/codeSeriesFormat'
import { previewNextCode, validateUniqueActiveEntity, adminResetSeries } from '../../../services/codeSeriesService'
import { canCodeSeriesPermission, CODE_SERIES_PERMISSION_LABELS } from '../../../utils/codeSeriesPermissions'
import { getSessionUser } from '../../../utils/permissions'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const schema = z.object({
  seriesCode: z.string().min(1).max(20),
  seriesName: z.string().min(1),
  module: z.string().min(1),
  entityType: z.string().min(1),
  description: z.string(),
  isActive: z.boolean(),
  prefix: z.string().min(1),
  separator: z.string(),
  financialYearRequired: z.boolean(),
  yearFormat: z.enum(['YYYY', 'YY']),
  monthRequired: z.boolean(),
  branchRequired: z.boolean(),
  departmentRequired: z.boolean(),
  locationRequired: z.boolean(),
  runningNumberLength: z.coerce.number().min(1).max(10),
  startingNumber: z.coerce.number().min(1),
  currentNumber: z.coerce.number().min(0),
  incrementBy: z.coerce.number().min(1),
  suffix: z.string(),
  resetFrequency: z.enum(['never', 'daily', 'monthly', 'financial_year', 'calendar_year']),
  allowManualNumber: z.boolean(),
  allowOverride: z.boolean(),
  allowGap: z.boolean(),
  allowDuplicate: z.boolean(),
  lockAfterPosting: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.currentNumber < data.startingNumber - 1) {
    ctx.addIssue({ code: 'custom', message: 'Current number cannot be below starting number - 1', path: ['currentNumber'] })
  }
})

type FormData = z.infer<typeof schema>

const ENTITY_OPTIONS = Object.entries(CODE_SERIES_ENTITY_LABELS) as [CodeSeriesEntityType, string][]
const MODULE_OPTIONS = Object.entries(CODE_SERIES_MODULE_LABELS) as [CodeSeriesModule, string][]

export function CodeSeriesListPage() {
  const series = useCodeSeriesStore((s) => s.series)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      series.filter(
        (row) =>
          matchesStatusFilter(row.isActive, status) &&
          (row.seriesCode.toLowerCase().includes(search.toLowerCase()) ||
            row.seriesName.toLowerCase().includes(search.toLowerCase()) ||
            row.prefix.toLowerCase().includes(search.toLowerCase()) ||
            CODE_SERIES_ENTITY_LABELS[row.entityType].toLowerCase().includes(search.toLowerCase())),
      ),
    [series, search, status],
  )

  const columns: ColumnDef<CodeSeries, unknown>[] = [
    { accessorKey: 'seriesCode', header: 'Series Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.seriesCode}</span> },
    { accessorKey: 'seriesName', header: 'Series Name' },
    { id: 'module', header: 'Module', cell: ({ row }) => CODE_SERIES_MODULE_LABELS[row.original.module] },
    { id: 'entity', header: 'Entity Type', cell: ({ row }) => CODE_SERIES_ENTITY_LABELS[row.original.entityType] },
    { id: 'preview', header: 'Format Preview', cell: ({ row }) => <span className="font-mono text-xs">{previewFormat(row.original)}</span> },
    { accessorKey: 'currentNumber', header: 'Current No.' },
    { id: 'next', header: 'Next No.', cell: ({ row }) => {
      try {
        return <span className="font-mono text-xs">{previewNextCode(row.original.entityType)}</span>
      } catch {
        return '—'
      }
    } },
    { id: 'reset', header: 'Reset Rule', cell: ({ row }) => RESET_FREQUENCY_LABELS[row.original.resetFrequency] },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/code-series/${row.original.id}`} editTo={`/masters/code-series/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title="Code / Number Series"
      description="Centralized document and master code generation for the entire ERP"
      masterGroupId="administration"
      createLabel="New Code Series"
      createTo="/masters/code-series/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Series', value: series.length },
        { label: 'Active', value: series.filter((s) => s.isActive).length, accent: 'green' },
        { label: 'FY Reset', value: series.filter((s) => s.resetFrequency === 'financial_year').length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function CodeSeriesFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useCodeSeriesStore((s) => (id ? s.getSeries(id) : undefined))
  const addSeries = useCodeSeriesStore((s) => s.addSeries)
  const updateSeries = useCodeSeriesStore((s) => s.updateSeries)
  const duplicateSeries = useCodeSeriesStore((s) => s.duplicateSeries)
  const auditLog = useCodeSeriesStore((s) => s.auditLog)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [formatSegments, setFormatSegments] = useState<CodeFormatSegment[]>(
    existing?.formatSegments ?? defaultFormatSegments({ financialYearRequired: false, monthRequired: false, branchRequired: false }),
  )

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? { ...existing }
      : {
          seriesCode: '',
          seriesName: '',
          module: 'masters',
          entityType: 'item',
          description: '',
          isActive: true,
          prefix: '',
          separator: '-',
          financialYearRequired: false,
          yearFormat: 'YYYY',
          monthRequired: false,
          branchRequired: false,
          departmentRequired: false,
          locationRequired: false,
          runningNumberLength: 4,
          startingNumber: 1,
          currentNumber: 0,
          incrementBy: 1,
          suffix: '',
          resetFrequency: 'never',
          allowManualNumber: false,
          allowOverride: false,
          allowGap: false,
          allowDuplicate: false,
          lockAfterPosting: true,
        },
  })

  const watched = useWatch({ control })
  const previewSeries = useMemo((): CodeSeries => {
    const base: CodeSeries = existing ?? {
      id: 'preview',
      seriesCode: watched.seriesCode ?? '',
      seriesName: watched.seriesName ?? '',
      module: (watched.module as CodeSeriesModule) ?? 'masters',
      entityType: (watched.entityType as CodeSeriesEntityType) ?? 'item',
      description: watched.description ?? '',
      isActive: watched.isActive ?? true,
      prefix: watched.prefix ?? '',
      separator: watched.separator ?? '-',
      financialYearRequired: watched.financialYearRequired ?? false,
      yearFormat: watched.yearFormat ?? 'YYYY',
      monthRequired: watched.monthRequired ?? false,
      branchRequired: watched.branchRequired ?? false,
      departmentRequired: watched.departmentRequired ?? false,
      locationRequired: watched.locationRequired ?? false,
      runningNumberLength: watched.runningNumberLength ?? 4,
      startingNumber: watched.startingNumber ?? 1,
      currentNumber: watched.currentNumber ?? 0,
      incrementBy: watched.incrementBy ?? 1,
      suffix: watched.suffix ?? '',
      formatSegments,
      resetFrequency: watched.resetFrequency ?? 'never',
      allowManualNumber: watched.allowManualNumber ?? false,
      allowOverride: watched.allowOverride ?? false,
      allowGap: watched.allowGap ?? false,
      allowDuplicate: watched.allowDuplicate ?? false,
      lockAfterPosting: watched.lockAfterPosting ?? true,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      modifiedBy: 'admin',
      updatedAt: new Date().toISOString(),
    }
    return {
      ...base,
      ...watched,
      module: watched.module as CodeSeriesModule,
      entityType: watched.entityType as CodeSeriesEntityType,
      formatSegments,
    }
  }, [existing, watched, formatSegments])

  const livePreview = previewFormat(previewSeries)
  const nextPreview = previewFormat(previewSeries)

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit((data) => {
      if (data.isActive && !validateUniqueActiveEntity(data.entityType as CodeSeriesEntityType, id)) {
        window.alert('Another active series already exists for this entity type.')
        return
      }
      const user = getSessionUser().name
      const payload = {
        ...data,
        seriesCode: data.seriesCode.trim().toUpperCase(),
        prefix: data.prefix.trim().toUpperCase(),
        module: data.module as CodeSeriesModule,
        entityType: data.entityType as CodeSeriesEntityType,
        formatSegments,
        modifiedBy: user,
      }
      let recordId = id
      if (isEdit && id) updateSeries(id, payload, { by: user })
      else recordId = addSeries({ ...payload, createdBy: user, modifiedBy: user })
      if (mode === 'new') { navigate('/masters/code-series/new'); return }
      if (mode === 'close') { navigate('/masters/code-series'); return }
      if (!isEdit && recordId) navigate(`/masters/code-series/${recordId}/edit`, { replace: true })
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  const seriesAudit = auditLog.filter((a) => a.seriesId === id).slice(0, 8)

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.seriesCode : 'New Code Series'}
      subtitle={watched.seriesName || 'Centralized numbering configuration'}
      breadcrumbs={buildMasterBreadcrumbs('administration', isEdit ? 'Edit Code Series' : 'New Code Series')}
      documentStrip={[
        { label: 'Series', value: watched.seriesCode || '—', highlight: Boolean(watched.seriesCode) },
        { label: 'Entity', value: watched.entityType ? CODE_SERIES_ENTITY_LABELS[watched.entityType as CodeSeriesEntityType] : '—' },
        { label: 'Preview', value: livePreview },
        { label: 'Next', value: nextPreview },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/code-series"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/code-series')}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: Hash, done: Boolean(watched.seriesCode && watched.seriesName && watched.prefix) },
        { id: 'format', label: 'Format Builder', icon: Wand2, done: formatSegments.includes('running_number') },
        { id: 'reset', label: 'Reset Rules', icon: RefreshCw, done: Boolean(watched.resetFrequency) },
        { id: 'control', label: 'Manual Control', icon: Settings2, done: true },
        { id: 'permissions', label: 'Permissions', icon: Shield, done: true },
        { id: 'history', label: 'History', icon: History, done: seriesAudit.length > 0 },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Current', value: String(watched.currentNumber ?? 0), accent: 'blue' as const },
        { label: 'Next Preview', value: nextPreview, accent: 'violet' as const },
        { label: 'Reset', value: RESET_FREQUENCY_LABELS[watched.resetFrequency as keyof typeof RESET_FREQUENCY_LABELS] ?? '—', accent: 'amber' as const },
        { label: 'Active', value: watched.isActive ? 'Yes' : 'No', accent: watched.isActive ? ('green' as const) : ('amber' as const) },
      ]}
      factBoxTitle="Code series"
      factBoxSummary={[
        { label: 'Module', value: watched.module ? CODE_SERIES_MODULE_LABELS[watched.module as CodeSeriesModule] : '—' },
        { label: 'Last Used', value: existing?.lastUsedNumber ? String(existing.lastUsedNumber) : '—' },
        { label: 'Last Used Date', value: existing?.lastUsedDate ?? '—' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/code-series')}
        />
      )}
    >
      <form id="code-series-form" onSubmit={submit}>
        <ErpCardSection id="cs-general" title="General" subtitle="Series identity, module, and entity mapping." icon={Hash} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Series Code" required error={errors.seriesCode?.message}>
              <Input {...register('seriesCode')} disabled={isEdit} className="font-mono uppercase" />
            </FormField>
            <FormField label="Series Name" required error={errors.seriesName?.message}>
              <Input {...register('seriesName')} />
            </FormField>
            <FormField label="Module" required>
              <Select {...register('module')}>
                {MODULE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField label="Entity / Document Type" required>
              <Select {...register('entityType')}>
                {ENTITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField label="Description" className="md:col-span-2">
              <Input {...register('description')} />
            </FormField>
            <FormField label="Active">
              <Checkbox {...register('isActive')} label="Active series" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="cs-format" title="Format Builder" subtitle="Arrange prefix, year, branch, and running number segments." icon={Wand2} accent="violet" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Prefix" required error={errors.prefix?.message}>
              <Input {...register('prefix')} className="font-mono uppercase" />
            </FormField>
            <FormField label="Separator">
              <Input {...register('separator')} className="font-mono" maxLength={3} />
            </FormField>
            <FormField label="Running Number Length" required>
              <Input type="number" {...register('runningNumberLength')} />
            </FormField>
            <FormField label="Suffix">
              <Input {...register('suffix')} className="font-mono uppercase" />
            </FormField>
            <FormField label="Financial Year Required">
              <Checkbox {...register('financialYearRequired')} label="Include financial / calendar year" />
            </FormField>
            <FormField label="Month Required">
              <Checkbox {...register('monthRequired')} label="Include month token" />
            </FormField>
            <FormField label="Branch Required">
              <Checkbox {...register('branchRequired')} label="Include branch code in format" />
            </FormField>
            <FormField label="Year Format">
              <Select {...register('yearFormat')}>
                <option value="YYYY">YYYY</option>
                <option value="YY">YY</option>
              </Select>
            </FormField>
            <FormField label="Starting Number" required>
              <Input type="number" {...register('startingNumber')} />
            </FormField>
            <FormField label="Current Number" required error={errors.currentNumber?.message}>
              <Input type="number" {...register('currentNumber')} />
            </FormField>
            <FormField label="Increment By">
              <Input type="number" {...register('incrementBy')} />
            </FormField>
          </div>
          <div className="col-span-2 mt-4 rounded-md border border-erp-border bg-erp-surface-alt/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">Format segments</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(CODE_FORMAT_SEGMENT_LABELS) as CodeFormatSegment[]).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setFormatSegments((prev) => (prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]))}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${formatSegments.includes(seg) ? 'bg-erp-primary-soft text-erp-primary ring-erp-primary/30' : 'bg-erp-surface text-erp-muted ring-erp-border'}`}
                >
                  {CODE_FORMAT_SEGMENT_LABELS[seg]}
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-sm text-erp-text">Preview: {livePreview}</p>
            <p className="mt-1 font-mono text-xs text-erp-muted">Next: {nextPreview}</p>
          </div>
        </ErpCardSection>

        <ErpCardSection id="cs-reset" title="Reset Rules" subtitle="Counter reset frequency and schedule." icon={RefreshCw} accent="amber" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Reset Frequency">
              <Select {...register('resetFrequency')}>
                {Object.entries(RESET_FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Last Reset Date">
              <Input value={existing?.lastResetDate ?? '—'} readOnly />
            </FormField>
            <FormField label="Next Reset Date">
              <Input value={existing?.nextResetDate ?? '—'} readOnly />
            </FormField>
            {isEdit && canCodeSeriesPermission('codeSeries.reset') ? (
              <div className="md:col-span-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-erp-border px-3 py-2 text-sm text-erp-primary hover:bg-erp-surface-alt"
                  onClick={() => {
                    const reason = window.prompt('Reset reason (required):')
                    if (reason && id) adminResetSeries(id, reason)
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> Reset series counter
                </button>
              </div>
            ) : null}
          </div>
        </ErpCardSection>

        <ErpCardSection id="cs-control" title="Manual Control & Safety" subtitle="Override, gap, duplicate, and posting lock rules." icon={Settings2} accent="slate" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <Checkbox {...register('allowManualNumber')} label="Allow manual number entry" />
            <Checkbox {...register('allowOverride')} label="Allow override of auto number" />
            <Checkbox {...register('allowGap')} label="Allow gaps in numbering" />
            <Checkbox {...register('allowDuplicate')} label="Allow duplicate codes" />
            <Checkbox {...register('lockAfterPosting')} label="Lock number after posting" />
          </div>
        </ErpCardSection>

        <ErpCardSection id="cs-permissions" title="Permissions" subtitle="Admin / ERP Manager configure; users consume generated codes." icon={Shield} accent="green" collapsible defaultOpen>
          <ul className="col-span-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(CODE_SERIES_PERMISSION_LABELS).map(([key, label]) => (
              <li key={key} className="rounded-md border border-erp-border px-3 py-2 text-sm">
                <span className="font-mono text-xs text-erp-muted">{key}</span>
                <p>{label}</p>
                <p className="text-xs text-erp-muted">{canCodeSeriesPermission(key as keyof typeof CODE_SERIES_PERMISSION_LABELS) ? 'Granted' : 'Restricted'}</p>
              </li>
            ))}
          </ul>
        </ErpCardSection>

        <ErpCardSection id="cs-history" title="Audit History" subtitle="Creates, updates, resets, reservations." icon={History} accent="slate" collapsible defaultOpen>
          <div className="col-span-2 overflow-hidden rounded-md border border-erp-border">
            <table className="erp-table w-full text-sm">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>When</th>
                  <th>By</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {seriesAudit.length ? seriesAudit.map((a) => (
                  <tr key={a.id}>
                    <td>{a.action}</td>
                    <td>{formatDate(a.at.slice(0, 10))}</td>
                    <td>{a.by}</td>
                    <td>{a.detail ?? a.reason ?? '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="text-erp-muted">No audit entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {isEdit && canCodeSeriesPermission('codeSeries.create') ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-sm text-erp-primary hover:underline"
              onClick={() => id && duplicateSeries(id, getSessionUser().name)}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate series
            </button>
          ) : null}
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function CodeSeriesDetailPage() {
  const { id } = useParams()
  const record = useCodeSeriesStore((s) => (id ? s.getSeries(id) : undefined))
  const auditLog = useCodeSeriesStore((s) => s.auditLog.filter((a) => a.seriesId === id).slice(0, 10))
  if (!record) return <MasterNotFound message="Code series not found." />

  let nextCode = '—'
  try {
    nextCode = previewNextCode(record.entityType)
  } catch {
    nextCode = previewFormat(record)
  }

  return (
    <DetailLayout
      backTo="/masters/code-series"
      backLabel="Code Series"
      masterGroupId="administration"
      title={record.seriesName}
      subtitle={record.seriesCode}
      editTo={`/masters/code-series/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Module" value={CODE_SERIES_MODULE_LABELS[record.module]} />
          <DetailField label="Entity Type" value={CODE_SERIES_ENTITY_LABELS[record.entityType]} />
          <DetailField label="Format Preview" value={<span className="font-mono">{previewFormat(record)}</span>} />
          <DetailField label="Next Code Preview" value={<span className="font-mono">{nextCode}</span>} />
          <DetailField label="Current Number" value={String(record.currentNumber)} />
          <DetailField label="Reset Rule" value={RESET_FREQUENCY_LABELS[record.resetFrequency]} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Audit">
        <DetailGrid>
          <DetailField label="Created By" value={record.createdBy} />
          <DetailField label="Created Date" value={formatDate(record.createdAt.slice(0, 10))} />
          <DetailField label="Modified By" value={record.modifiedBy} />
          <DetailField label="Modified Date" value={formatDate(record.updatedAt.slice(0, 10))} />
          <DetailField label="Last Used Number" value={record.lastUsedNumber ? String(record.lastUsedNumber) : '—'} />
          <DetailField label="Last Used Date" value={record.lastUsedDate ?? '—'} />
        </DetailGrid>
      </DetailSection>
      {auditLog.length > 0 ? (
        <DetailSection title="Recent History">
          <DetailGrid>
            {auditLog.map((a) => (
              <DetailField key={a.id} label={a.action} value={`${formatDate(a.at.slice(0, 10))} · ${a.by} · ${a.detail ?? a.reason ?? ''}`} />
            ))}
          </DetailGrid>
        </DetailSection>
      ) : null}
    </DetailLayout>
  )
}
